/** Compare adjudicated review findings against an explicitly observed reference. */
function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
}
function text(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be nonempty text`);
}
function uniqueIds(items, name) {
  if (!Array.isArray(items)) throw new Error(`${name} must be an array`);
  const ids = items.map((item, i) => {
    object(item, `${name}[${i}]`);
    text(item.id, `${name}[${i}].id`);
    return item.id;
  });
  if (new Set(ids).size !== ids.length) throw new Error(`${name} contains duplicate IDs`);
  return ids;
}
function usage(value, name) {
  if (value === undefined) return { cost_usd: null, total_tokens: null };
  object(value, name);
  const result = {};
  for (const field of ['cost_usd', 'total_tokens']) {
    const amount = value[field] ?? null;
    if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || (field === 'total_tokens' && !Number.isInteger(amount)))) {
      throw new Error(`${name}.${field} must be a nonnegative ${field === 'total_tokens' ? 'integer' : 'number'} or null`);
    }
    result[field] = amount;
  }
  for (const field of Object.keys(value)) if (!Object.hasOwn(result, field)) throw new Error(`unknown ${name} field: ${field}`);
  return result;
}

export function evaluatePanel(input) {
  object(input, 'evaluation');
  if (input.schema_version !== '1') throw new Error('schema_version must be 1');
  text(input.artifact, 'artifact');
  if (!/^.+@[^@]+$/.test(input.artifact)) throw new Error('artifact must be locator@version');
  text(input.question, 'question');
  object(input.reference, 'reference');
  if (!['human-observation', 'expert-review', 'none'].includes(input.reference.kind)) throw new Error('reference.kind must be human-observation, expert-review, or none');
  const referenceIds = uniqueIds(input.reference.issues, 'reference.issues');
  for (const [i, issue] of input.reference.issues.entries()) text(issue.summary, `reference.issues[${i}].summary`);
  if (input.reference.kind === 'none' && referenceIds.length) throw new Error('reference.kind none cannot contain issues');
  const referenceSet = new Set(referenceIds);
  object(input.review_status, 'review_status');
  for (const method of ['baseline', 'panel']) {
    if (!['pending', 'complete'].includes(input.review_status[method])) throw new Error(`review_status.${method} must be pending or complete`);
  }

  if (!Array.isArray(input.personas) || !input.personas.length) throw new Error('personas must be a nonempty array');
  for (const [i, id] of input.personas.entries()) text(id, `personas[${i}]`);
  if (new Set(input.personas).size !== input.personas.length) throw new Error('personas contains duplicate IDs');
  const personaSet = new Set(input.personas);
  uniqueIds(input.findings, 'findings');
  const groups = { baseline: [], panel: [] };
  for (const [i, finding] of input.findings.entries()) {
    const name = `findings[${i}]`;
    text(finding.summary, `${name}.summary`);
    if (!['baseline', 'panel'].includes(finding.method)) throw new Error(`${name}.method must be baseline or panel`);
    if (input.review_status[finding.method] !== 'complete') throw new Error(`${name} belongs to a pending review`);
    if (!['supported', 'refuted', 'unresolved'].includes(finding.status)) throw new Error(`${name}.status must be supported, refuted, or unresolved`);
    if (finding.method === 'panel') {
      if (!personaSet.has(finding.persona_id)) throw new Error(`${name}.persona_id must name a listed persona`);
    } else if (finding.persona_id !== undefined) throw new Error(`${name}.persona_id is only for panel findings`);
    if (finding.status !== 'unresolved') text(finding.evidence, `${name}.evidence`);
    const links = finding.reference_issue_ids ?? [];
    if (!Array.isArray(links) || new Set(links).size !== links.length) throw new Error(`${name}.reference_issue_ids must be distinct IDs`);
    if (links.length && finding.status !== 'supported') throw new Error(`${name} may link reference issues only when supported`);
    for (const id of links) if (!referenceSet.has(id)) throw new Error(`${name} links unknown reference issue: ${id}`);
    groups[finding.method].push(finding);
  }
  const matched = (findings) => new Set(findings.filter(f => f.status === 'supported').flatMap(f => f.reference_issue_ids ?? []));
  const baseline = matched(groups.baseline);
  const panel = matched(groups.panel);
  const count = (findings) => Object.fromEntries(['supported', 'refuted', 'unresolved'].map(status => [status, findings.filter(f => f.status === status).length]));
  const reportedUsage = {
    baseline: usage(input.usage?.baseline, 'usage.baseline'),
    panel: usage(input.usage?.panel, 'usage.panel'),
  };
  if (input.usage !== undefined) {
    object(input.usage, 'usage');
    for (const key of Object.keys(input.usage)) if (!['baseline', 'panel'].includes(key)) throw new Error(`unknown usage field: ${key}`);
  }
  const comparable = referenceIds.length > 0;
  const baselineComplete = input.review_status.baseline === 'complete';
  const panelComplete = input.review_status.panel === 'complete';
  const bothComplete = baselineComplete && panelComplete;
  return {
    schema_version: '1', artifact: input.artifact, question: input.question,
    reference_kind: input.reference.kind,
    review_status: { baseline: input.review_status.baseline, panel: input.review_status.panel },
    calibration: comparable && bothComplete ? (input.reference.kind === 'human-observation' ? 'human-observed' : 'expert-reviewed') : 'unavailable',
    reference_issue_count: referenceIds.length,
    baseline: { findings: count(groups.baseline), matched_issue_ids: [...baseline], coverage: comparable && baselineComplete ? baseline.size / referenceIds.length : null },
    panel: { findings: count(groups.panel), matched_issue_ids: [...panel], coverage: comparable && panelComplete ? panel.size / referenceIds.length : null },
    incremental_issue_ids: bothComplete ? [...panel].filter(id => !baseline.has(id)) : null,
    missed_issue_ids: comparable && panelComplete ? referenceIds.filter(id => !panel.has(id)) : null,
    personas: input.personas.map(id => {
      const findings = groups.panel.filter(f => f.persona_id === id);
      return { id, finding_counts: count(findings), findings: findings.map(f => ({
        id: f.id, summary: f.summary, status: f.status, reference_issue_ids: f.reference_issue_ids ?? [],
      })), matched_issue_ids: [...matched(findings)] };
    }),
    usage: reportedUsage,
    panel_extra_cost_usd: !bothComplete || reportedUsage.baseline.cost_usd === null || reportedUsage.panel.cost_usd === null
      ? null : reportedUsage.panel.cost_usd - reportedUsage.baseline.cost_usd,
    note: 'Persona differences remain visible. Coverage counts only explicitly linked, supported findings; it does not score or penalize variance.',
  };
}
