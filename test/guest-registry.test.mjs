/**
 * The reviewed-source guest registry contract.
 *
 * The registry duplicates information that already lives in the evidence files —
 * which speaker said what, and which archetypes a principle serves. Duplication
 * is only safe while something forces the two copies to agree, so coverage is
 * asserted in BOTH directions: every speaker in the evidence files has a
 * registry entry, and every principle id a registry entry claims exists.
 *
 * The other property under test is the boundary the registry must not cross. A
 * guest entry indexes a public transcript. It is not endorsement and never a
 * licence to impersonate, so no composed persona may carry a guest's name.
 *
 * All tests use a temp PERSONA_LAB_HOME — never the user's real library.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  GUEST_REGISTRY, GUEST_CATEGORY_IDS, listGuests, findGuest, informedBy,
  assistsWith, principlesForGuests, recommendedGuests,
} from '../lib/guests.mjs';
import { reviewedPrinciples, phrasePresent } from '../lib/sources.mjs';
import { composePersona } from '../lib/archetypes.mjs';
import { savePersona, validatePersona, listPersonas, searchPersonas } from '../lib/library.mjs';
import { ARCHETYPE_CATALOG } from '../lib/archetypes.mjs';
import { planOrchestration } from '../lib/orchestrator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'bin/persona.mjs');

function withTempHome(fn) {
  const previous = process.env.PERSONA_LAB_HOME;
  const home = mkdtempSync(path.join(tmpdir(), 'persona-guests-'));
  process.env.PERSONA_LAB_HOME = home;
  try {
    return fn(home);
  } finally {
    if (previous === undefined) delete process.env.PERSONA_LAB_HOME; else process.env.PERSONA_LAB_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
}

test('registry and evidence files cover each other in both directions', () => {
  const principles = reviewedPrinciples();
  const speakers = new Set(principles.map((p) => p.source.speaker));
  const registered = new Map(GUEST_REGISTRY.guests.map((g) => [g.name, g]));

  // Direction 1 — no speaker may exist only inside the evidence files.
  for (const speaker of speakers) {
    assert.ok(registered.has(speaker),
      `${speaker} appears in the evidence files with no entry in lib/data/lenny-guests.json`);
  }
  // Direction 2 — no registry entry may claim a principle that does not exist.
  const byId = new Map(principles.map((p) => [p.id, p]));
  for (const guest of GUEST_REGISTRY.guests) {
    assert.ok(speakers.has(guest.name), `${guest.slug} names a speaker with no reviewed principles`);
    assert.ok(guest.principle_ids.length > 0, `${guest.slug} must claim at least one principle`);
    for (const id of guest.principle_ids) {
      const principle = byId.get(id);
      assert.ok(principle, `${guest.slug} claims a principle that does not exist: ${id}`);
      assert.equal(principle.source.speaker, guest.name, `${id} belongs to ${principle.source.speaker}, not ${guest.name}`);
    }
  }
  // Every principle is claimed exactly once, so informedBy can never be ambiguous.
  const claims = GUEST_REGISTRY.guests.flatMap((g) => g.principle_ids);
  assert.equal(new Set(claims).size, claims.length, 'a principle is claimed by more than one guest');
  assert.equal(claims.length, principles.length, 'some reviewed principle belongs to no guest');
});

test('the category enum is closed, and every category is used', () => {
  assert.equal(new Set(GUEST_CATEGORY_IDS).size, GUEST_CATEGORY_IDS.length, 'duplicate category id');
  for (const guest of GUEST_REGISTRY.guests) {
    assert.ok(GUEST_CATEGORY_IDS.includes(guest.expert_category),
      `${guest.slug} uses an unlisted expert_category: ${guest.expert_category}`);
    assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(guest.slug), `${guest.slug} must be a slug`);
    assert.ok(guest.source_note.includes('not endorsement'), `${guest.slug} must carry the source note`);
  }
  const used = new Set(GUEST_REGISTRY.guests.map((g) => g.expert_category));
  for (const id of GUEST_CATEGORY_IDS) {
    assert.ok(used.has(id), `category ${id} is declared but no guest uses it`);
  }
  assert.throws(() => listGuests({ category: 'vibes' }), /Unknown expert category/);
  assert.throws(() => findGuest('nobody'), /Unknown guest/);
});

test('every assists_with area is supported by that guest own principles', () => {
  const principles = reviewedPrinciples();
  for (const guest of GUEST_REGISTRY.guests) {
    const mine = principles.filter((p) => guest.principle_ids.includes(p.id));
    const specialties = new Set(mine.flatMap((p) => p.specialties));
    const text = mine.map((p) => `${p.principle} ${p.use_when} ${p.avoid_when}`).join(' ');
    assert.ok(guest.assists_with.length > 0, `${guest.slug} claims no areas`);
    assert.ok(guest.assists_with.length <= 24, `${guest.slug} exceeds the 24-area cap`);
    for (const area of guest.assists_with) {
      assert.ok(area.length <= 40 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(area), `${guest.slug} area ${area} must be a short slug`);
      assert.ok(specialties.has(area) || phrasePresent(text, area.replaceAll('-', ' ')) || phrasePresent(text, area),
        `${guest.slug} claims "${area}" with nothing in its own principles to support it`);
    }
    // The archetype union must match the principles, or a seat inherits areas it never earned.
    const archetypes = [...new Set(mine.flatMap((p) => p.archetypes))].sort();
    assert.deepEqual(guest.archetypes, archetypes, `${guest.slug} archetypes drifted from its principles`);
    for (const id of guest.archetypes) {
      assert.ok(ARCHETYPE_CATALOG.archetypes.some((a) => a.id === id), `${guest.slug} names unknown archetype ${id}`);
    }
  }
});

test('compose --guest attaches only that guest principles and records informed_by', () => {
  withTempHome(() => {
    const larson = composePersona({ archetypes: ['engineer'], guests: ['will-larson'] });
    assert.deepEqual(larson.guest_filter, ['will-larson']);
    assert.deepEqual(larson.persona.informed_by.map((i) => i.guest_slug), ['will-larson']);
    assert.ok(larson.principles.length > 0);
    for (const principle of larson.principles) {
      assert.equal(principle.source.speaker, 'Will Larson');
    }
    // Unrestricted composition of the same archetype pulls in other speakers,
    // which is what makes the restriction meaningful rather than incidental.
    const open = composePersona({ archetypes: ['engineer'] });
    assert.ok(open.persona.informed_by.length > 1, 'baseline engineer draws on several guests');
    assert.throws(() => composePersona({ archetypes: ['engineer'], guests: ['not-a-guest'] }), /Unknown guest/);
  });
});

test('a persona informed by a guest is never named after the guest', () => {
  withTempHome(() => {
    const names = GUEST_REGISTRY.guests.map((g) => g.name.toLowerCase());
    for (const archetype of ARCHETYPE_CATALOG.archetypes) {
      const { persona } = composePersona({ archetypes: [archetype.id] });
      const haystack = `${persona.name} ${persona.role} ${persona.archetype}`.toLowerCase();
      for (const name of names) {
        assert.ok(!haystack.includes(name), `${archetype.id} persona is named after ${name}`);
      }
      assert.deepEqual(validatePersona(persona), { ok: true, errors: [] }, archetype.id);
      assert.ok(Array.isArray(persona.assists_with));
      assert.ok(Array.isArray(persona.informed_by));
      assert.ok(persona.anti_goals.some((g) => /Impersonating a podcast guest/.test(g)), archetype.id);
    }
  });
});

test('a persona saved before the guest registry existed is still valid', () => {
  withTempHome(() => {
    const { persona } = composePersona({ archetypes: ['designer'] });
    delete persona.assists_with;
    delete persona.informed_by;
    assert.deepEqual(validatePersona(persona), { ok: true, errors: [] });
    assert.ok(savePersona(persona).id);
  });
});

test('assists_with and informed_by are rejected when malformed', () => {
  withTempHome(() => {
    const { persona } = composePersona({ archetypes: ['designer'] });
    const bad = (mutation) => validatePersona({ ...persona, ...mutation });
    assert.ok(bad({ assists_with: ['Not A Slug'] }).errors.some((e) => /assists_with entries must be slugs/.test(e)));
    assert.ok(bad({ assists_with: Array.from({ length: 25 }, (_, i) => `area-${i}`) }).errors.some((e) => /at most 24/.test(e)));
    assert.ok(bad({ assists_with: ['dupe', 'dupe'] }).errors.some((e) => /must not repeat/.test(e)));
    assert.ok(bad({ informed_by: [{ guest_slug: 'x', name: 'X' }] }).errors.some((e) => /principle_ids must be a non-empty/.test(e)));
    assert.ok(bad({ informed_by: [{ guest_slug: 'x', name: 'X', principle_ids: ['a'], extra: 1 }] }).errors.some((e) => /unknown field/.test(e)));
  });
});

test('list --assists and search reach the new fields', () => {
  withTempHome(() => {
    const saved = savePersona(composePersona({ archetypes: ['marketer'], specialties: 'positioning' }).persona);
    const area = saved.assists_with[0];
    assert.ok(area, 'a positioning marketer must claim at least one area');
    assert.ok(listPersonas({ assists: area }).some((p) => p.id === saved.id));
    assert.equal(listPersonas({ assists: 'no-such-area' }).length, 0);
    const guestName = saved.informed_by[0].name;
    assert.ok(searchPersonas(guestName).some((p) => p.id === saved.id), `search must reach informed_by (${guestName})`);
    assert.ok(searchPersonas(area).some((p) => p.id === saved.id));
  });
});

test('recommended guests answer the two tasks the registry exists to answer', () => {
  withTempHome(() => {
    const positioning = planOrchestration('reposition our B2B SaaS onboarding for enterprise buyers');
    assert.ok(positioning.recommended_guests.some((g) => g.guest_slug === 'april-dunford'),
      'a positioning question must surface the positioning source even from another lane');
    for (const guest of positioning.recommended_guests) {
      assert.ok(guest.source_note.includes('not endorsement'));
      assert.ok(Array.isArray(guest.principle_ids) && guest.principle_ids.length > 0);
    }
    assert.match(positioning.guest_use_note, /never impersonate/);

    const feedback = planOrchestration('give feedback to a struggling engineering manager');
    const slugs = feedback.recommended_guests.map((g) => g.guest_slug);
    assert.ok(slugs.includes('kim-scott') || slugs.includes('claire-hughes-johnson'),
      `a feedback question must surface a feedback source, got ${slugs.join(', ')}`);

    // A task with no matching area and no lane categories recommends nobody
    // rather than padding the list with whoever sorts first.
    assert.deepEqual(recommendedGuests('xyzzy plugh', { categories: [] }), []);
  });
});

test('CLI guests round-trips as JSON and filters', () => {
  withTempHome((home) => {
    const env = { ...process.env, PERSONA_LAB_HOME: home };
    const all = JSON.parse(execFileSync('node', [cli, 'guests', '--json'], { env, encoding: 'utf8' }));
    assert.equal(all.count, GUEST_REGISTRY.guests.length);
    assert.deepEqual(all.categories.map((c) => c.id), GUEST_CATEGORY_IDS);

    const filtered = JSON.parse(execFileSync('node', [cli, 'guests', '--category', 'positioning-and-marketing', '--json'], { env, encoding: 'utf8' }));
    assert.deepEqual(filtered.guests.map((g) => g.slug), ['april-dunford']);

    const byArea = JSON.parse(execFileSync('node', [cli, 'guests', '--assists', 'retention', '--json'], { env, encoding: 'utf8' }));
    assert.ok(byArea.guests.every((g) => g.assists_with.includes('retention')));
    assert.ok(byArea.count >= 2);

    const human = execFileSync('node', [cli, 'guests', '--category', 'management-and-feedback'], { env, encoding: 'utf8' });
    assert.match(human, /Kim Scott \(kim-scott\)/);
    assert.match(human, /not endorsement/);

    const composed = JSON.parse(execFileSync('node', [cli, 'compose', 'engineer', '--guest', 'will-larson'], { env, encoding: 'utf8' }));
    assert.deepEqual(composed.persona.informed_by.map((i) => i.guest_slug), ['will-larson']);
  });
});

test('helper contracts hold on empty and partial input', () => {
  assert.deepEqual(informedBy([]), []);
  assert.deepEqual(assistsWith([], []), []);
  assert.deepEqual(principlesForGuests([]), []);
  // An archetype filter that matches no guest yields no areas rather than everything.
  assert.deepEqual(assistsWith(principlesForGuests(['kim-scott']), ['engineer']), []);
});
