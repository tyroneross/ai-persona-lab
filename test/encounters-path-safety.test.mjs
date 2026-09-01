import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { saveEncounter, listEncounters, encountersDir } from "../lib/encounters.mjs";
import { savePersona } from "../lib/library.mjs";
import { writeRun } from "../lib/runs.mjs";

function freshHome() {
  const dir = mkdtempSync(path.join(tmpdir(), "persona-lab-test-"));
  process.env.PERSONA_LAB_HOME = dir;
  return dir;
}

/**
 * Every file under `dir`, recursively, as absolute paths. Used to prove a
 * refusal leaves NOTHING behind — not the persona's folder, not a stray
 * root file, and not an atomic-write `.tmp` orphan (the write path renames
 * a `.tmp` into place, so a bug that throws between write and rename would
 * otherwise leak a temp file this check would miss if it only looked at
 * `encounters/`).
 */
function walkFiles(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(abs));
    else out.push(abs);
  }
  return out;
}

function validEncounter(overrides = {}) {
  return {
    persona_id: "persona_test_ab12cd34",
    started_at: "2026-08-31T00:00:00.000Z",
    artifact: { slug: "checkout", label: "Checkout" },
    blind: true,
    conditions: { viewports: ["desktop-1440"] },
    verbatim: "It worked fine, no complaints.",
    ...overrides,
  };
}

function validPersonaInput(overrides = {}) {
  return {
    name: "Marcus Oyelaran",
    archetype: "Skeptical operator",
    role: "Ops lead",
    summary: "A veteran operator who distrusts new tools until they prove themselves in production.",
    primary_goal: "Ship without breaking anything at 2am.",
    goals: ["Ship safely"],
    frustrations: ["Flaky tools"],
    motivations: ["Reliability"],
    behaviors: ["Reads logs first"],
    needs: ["Clear error messages"],
    scenarios: [{ title: "Deploy", description: "Deploys a hotfix under time pressure." }],
    evidence: [{ id: "evidence_seed_00000000", source_type: "synthetic", summary: "seed", confidence: 0.4 }],
    confidence: 0.4,
    ...overrides,
  };
}

function validRunInput(overrides = {}) {
  return {
    schema_version: "1.0.0",
    run_id: "run_checkout_2026-08-31_ab12cd",
    request: "Judge the new checkout flow",
    started_at: "2026-08-31T00:00:00.000Z",
    status: "open",
    artifact: { slug: "checkout", label: "Checkout", version: "v1", frozen: true },
    roster: ["persona_test_ab12cd34"],
    ...overrides,
  };
}

test("saveEncounter refuses persona_id '.' and writes nothing to disk", () => {
  const home = freshHome();
  assert.throws(
    () => saveEncounter(validEncounter({ persona_id: "." })),
    (err) => {
      assert.match(err.message, /persona_id/);
      return true;
    }
  );
  const leaked = walkFiles(home);
  assert.deepEqual(leaked, [], `refusal must write nothing under the library home, found: ${JSON.stringify(leaked)}`);
});

test("saveEncounter names the missing field when persona_id is absent", () => {
  freshHome();
  const { persona_id, ...withoutPersonaId } = validEncounter();
  assert.throws(
    () => saveEncounter(withoutPersonaId),
    (err) => {
      assert.match(err.message, /persona_id is required/);
      return true;
    }
  );
});

test("saveEncounter's recovery hint resolves a real persona id from persona_name", () => {
  freshHome();
  const persona = savePersona(validPersonaInput());
  const { persona_id, ...rest } = validEncounter();
  assert.throws(
    () => saveEncounter({ ...rest, persona_name: persona.name }),
    (err) => {
      assert.match(err.message, new RegExp(persona.id));
      return true;
    }
  );
});

test("saveEncounter happy path still saves under encounters/<persona_id>/", () => {
  freshHome();
  const e = validEncounter();
  const { path: file } = saveEncounter(e);
  assert.ok(file.includes(path.join("encounters", e.persona_id)));
  assert.ok(existsSync(file));

  const rows = listEncounters();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].persona_id, e.persona_id);
});

test("listEncounters survives a stray file dropped directly into encounters/", () => {
  freshHome();
  const e = validEncounter();
  saveEncounter(e);

  const root = encountersDir();
  mkdirSync(root, { recursive: true });
  writeFileSync(path.join(root, "stray.json"), "{}\n", "utf8");

  const rows = listEncounters();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].persona_id, e.persona_id);
});

test("listEncounters refuses a malformed persona_id even when encounters/ does not exist yet", () => {
  const home = freshHome();
  assert.ok(!existsSync(path.join(home, "encounters")), "precondition: fresh home has no encounters/ dir");
  assert.throws(
    () => listEncounters({ persona_id: "." }),
    (err) => {
      assert.match(err.message, /persona_id/);
      return true;
    }
  );
});

test("listEncounters returns [] for a well-formed persona_id with no history, even on a fresh home", () => {
  const home = freshHome();
  assert.ok(!existsSync(path.join(home, "encounters")), "precondition: fresh home has no encounters/ dir");
  assert.deepEqual(listEncounters({ persona_id: "persona_absent_ab12cd34" }), []);
});

test("writeRun refuses run_id '..' and names run_id", () => {
  freshHome();
  assert.throws(
    () => writeRun(validRunInput({ run_id: ".." })),
    (err) => {
      assert.match(err.message, /run_id/);
      return true;
    }
  );
});
