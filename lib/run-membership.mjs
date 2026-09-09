/** Validate both explicit links and backlink recovery with the same contract. */
export function encounterMembershipProblem(run, e) {
  if (!e) return 'encounter not found';
  const memberships = (run.lanes || []).filter(l => (l.encounter_ids || []).includes(e.encounter_id));
  if (memberships.some(l => l.kind !== (e.blind ? 'blind' : 'debate'))) return 'lane does not match encounter blind state';
  if (e.run_id && e.run_id !== run.run_id) return 'encounter belongs to another run';
  if (!(run.roster || []).includes(e.persona_id)) return 'persona is not in run roster';
  if (e.artifact?.slug !== run.artifact?.slug) return 'artifact slug does not match run';
  if (e.artifact?.version !== run.artifact?.version) return 'artifact version does not match run';
  if (run.artifact?.manifest && e.artifact?.sha256 !== run.artifact.manifest.sha256) return 'artifact digest does not match run';
  return null;
}

