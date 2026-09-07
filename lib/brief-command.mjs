import { REVIEW_PRESETS, buildReviewBrief } from './review-presets.mjs';
import { getPersona } from './library.mjs';

/** Strict parsing for planning commands; no library writes or model calls. */
export function parsePlanningArgs(args, options) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('-')) { positional.push(arg); continue; }
    const key = arg.slice(2);
    if (!arg.startsWith('--') || !Object.hasOwn(options, key)) throw new Error(`unknown option: ${arg}`);
    if (Object.hasOwn(flags, key)) throw new Error(`duplicate option: --${key}`);
    if (options[key] === 'boolean') { flags[key] = true; continue; }
    const value = args[++i];
    if (value === undefined || value.startsWith('--') || !value.trim()) throw new Error(`--${key} requires a value`);
    flags[key] = value;
  }
  return { positional, flags };
}

export function createBriefPlan(positional, flags) {
  if (positional.length !== 1) throw new Error('usage: persona brief <handoff|interface|decision> --artifact <locator@version> --question <text>');
  const preset = REVIEW_PRESETS.find((p) => p.id === positional[0]);
  if (!preset) throw new Error(`unknown preset: ${positional[0]}; choose handoff, interface, or decision`);
  if (!flags.artifact || !/^.+@[^@]+$/.test(flags.artifact.trim()) || !flags.artifact.slice(flags.artifact.lastIndexOf('@') + 1).trim()) {
    throw new Error('--artifact requires a locator@version');
  }
  if (!flags.question) throw new Error('--question is required');
  const mode = flags.mode ?? 'single';
  if (!['single', 'panel'].includes(mode)) throw new Error(`unknown mode: ${mode}; choose single or panel`);
  const ids = flags.personas === undefined ? [] : flags.personas.split(',').map((id) => id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('--personas requires distinct, nonempty comma-separated saved persona IDs');
  const personas = ids.map((id) => {
    const persona = getPersona(id);
    if (!persona) throw new Error(`unknown saved persona ID: ${id}`);
    return persona;
  });
  const passes = mode === 'single' ? 1 : preset.lenses.length;
  return {
    execution: 'plan-only', model_calls: 0, writes: false,
    preset: preset.id, preset_version: preset.version, mode,
    artifact: flags.artifact.trim(), question: flags.question.trim(),
    constraints: flags.constraints?.trim() ?? '',
    requested_review_passes: flags.mode === undefined ? null : passes,
    effective_review_passes: passes,
    additional_model_passes: 0,
    saved_references: ids,
    brief: buildReviewBrief(preset, {
      artifact: flags.artifact, decision: flags.question,
      constraints: flags.constraints, mode, personas,
    }),
  };
}
