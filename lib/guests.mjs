/**
 * guests — the reviewed-source registry behind every composed persona.
 *
 * `lib/data/lenny-*-evidence.json` records principles and names the speaker in
 * `source.speaker`. That made the guest implicit: you could read a principle and
 * see who said it, but you could not ask "who informs a positioning seat" or
 * "which areas does this source actually cover". This registry makes the guest a
 * first-class record with an expert category, the areas the guest's own
 * principles support, and the exact principle ids that back it.
 *
 * The boundary the registry exists to hold: a guest entry is a reading of a
 * public transcript. It is not endorsement, not proof of competence, and never a
 * licence to impersonate. A persona informed by these principles is named for
 * its lens — "Positioning specialist, informed by reviewed principles" — never
 * for the person who said them.
 */
import { readFileSync } from 'node:fs';
import { reviewedPrinciples, phrasePresent } from './sources.mjs';

export const GUEST_REGISTRY = JSON.parse(readFileSync(new URL('./data/lenny-guests.json', import.meta.url), 'utf8'));

export const GUEST_CATEGORY_IDS = GUEST_REGISTRY.categories.map(c => c.id);

/** Every guest, or the subset matching a free-text query, a category, and an assists-with area. */
export function listGuests({ query, category, assists } = {}) {
  if (category !== undefined && category !== null && !GUEST_CATEGORY_IDS.includes(category)) {
    throw new Error(`Unknown expert category: ${category}. Known: ${GUEST_CATEGORY_IDS.join(', ')}`);
  }
  const text = String(query || '').trim().toLowerCase();
  const area = String(assists || '').trim().toLowerCase();
  return GUEST_REGISTRY.guests.filter(g => {
    if (category && g.expert_category !== category) return false;
    if (area && !g.assists_with.some(a => a === area || phrasePresent(a.replaceAll('-', ' '), area.replaceAll('-', ' ')))) return false;
    if (text && !`${g.slug} ${g.name} ${g.expert_category} ${g.assists_with.join(' ')} ${g.archetypes.join(' ')}`.toLowerCase().includes(text)) return false;
    return true;
  });
}

export function findGuest(slug) {
  const found = GUEST_REGISTRY.guests.find(g => g.slug === slug);
  if (!found) throw new Error(`Unknown guest: ${slug}. Use persona guests to browse.`);
  return found;
}

/** The guest whose registry entry claims this principle id, or null when the principle is unregistered. */
export function guestForPrinciple(principleId) {
  return GUEST_REGISTRY.guests.find(g => g.principle_ids.includes(principleId)) || null;
}

/**
 * The `informed_by` block for a set of attached principles: which guests those
 * principles came from, and exactly which principle ids were attached. Never a
 * claim that the guest reviewed anything.
 */
export function informedBy(principles = []) {
  const byGuest = new Map();
  for (const principle of principles) {
    const guest = guestForPrinciple(principle.id);
    if (!guest) continue;
    if (!byGuest.has(guest.slug)) byGuest.set(guest.slug, { guest_slug: guest.slug, name: guest.name, principle_ids: [] });
    byGuest.get(guest.slug).principle_ids.push(principle.id);
  }
  return [...byGuest.values()]
    .map(entry => ({ ...entry, principle_ids: [...new Set(entry.principle_ids)].sort() }))
    .sort((a, b) => a.guest_slug.localeCompare(b.guest_slug));
}

/**
 * Areas a persona can credibly assist with, given the principles actually
 * attached to it and the archetypes it was composed from. A guest's full area
 * list is narrowed to the archetypes in play, so an engineering seat informed by
 * a go-to-market guest does not inherit that guest's sales areas.
 */
export function assistsWith(principles = [], archetypeIds = []) {
  const wanted = new Set(archetypeIds);
  const support = new Map();
  for (const entry of informedBy(principles)) {
    const guest = findGuest(entry.guest_slug);
    if (wanted.size && !guest.archetypes.some(id => wanted.has(id))) continue;
    for (const area of guest.assists_with) support.set(area, (support.get(area) || 0) + entry.principle_ids.length);
  }
  // The schema caps the list at 24. Rank by how many attached principles back an
  // area before truncating, so a broad archetype keeps its best-supported areas
  // instead of whatever happens to sort first.
  return [...support.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 24)
    .map(([area]) => area)
    .sort();
}

/** Principles restricted to the named guests. Throws on an unknown slug rather than returning an empty set. */
export function principlesForGuests(slugs = [], principles = reviewedPrinciples()) {
  const ids = new Set((Array.isArray(slugs) ? slugs : String(slugs).split(',')).map(s => s.trim()).filter(Boolean)
    .flatMap(slug => findGuest(slug).principle_ids));
  return principles.filter(p => ids.has(p.id));
}

/**
 * Guests worth consulting for one task in one lane. Category membership is the
 * lane's claim; the task's own words are what rank them, so a lane never
 * silently recommends every guest it lists.
 */
export function recommendedGuests(task, { categories = [], limit = 5 } = {}) {
  const text = String(task || '');
  const wanted = new Set(categories);
  // A lane's categories are a prior, not a filter. A guest whose own areas match
  // the task's words is worth naming even from outside the lane — the whole
  // point of scoring against the task is that a positioning question can arrive
  // dressed as an onboarding screen.
  return GUEST_REGISTRY.guests
    .map(g => {
      const matched = g.assists_with.filter(area => phrasePresent(text, area.replaceAll('-', ' ')) || phrasePresent(text, area));
      return {
        guest_slug: g.slug,
        name: g.name,
        expert_category: g.expert_category,
        in_lane_category: wanted.size === 0 || wanted.has(g.expert_category),
        assists_with: g.assists_with,
        matched_areas: matched,
        principle_ids: g.principle_ids,
        score: matched.length,
      };
    })
    .filter(g => g.score > 0 || (wanted.size > 0 && g.in_lane_category))
    .sort((a, b) => (b.score * 2 + (b.in_lane_category ? 1 : 0)) - (a.score * 2 + (a.in_lane_category ? 1 : 0))
      || a.guest_slug.localeCompare(b.guest_slug))
    .slice(0, limit)
    .map(g => ({ ...g, source_note: GUEST_REGISTRY.source_note }));
}
