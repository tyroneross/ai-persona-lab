/**
 * Round-trip regression: the encounter writer (saveEncounter/scaffoldEncounter
 * in lib/encounters.mjs) and schemas/encounter.schema.json must never
 * silently disagree again. This is the exact failure the "1.0" vs "1.0.0"
 * schema_version mismatch would have caught, had it existed at the time.
 *
 * All tests use a temp PERSONA_LAB_HOME — never the user's real library.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { validate } from "./helpers/jsonschema.mjs";
import { saveEncounter, scaffoldEncounter, ENCOUNTER_SCHEMA_VERSION } from "../lib/encounters.mjs";

const schema = JSON.parse(
  readFileSync(new URL("../schemas/encounter.schema.json", import.meta.url), "utf8")
);

function freshHome() {
  const dir = mkdtempSync(path.join(tmpdir(), "persona-lab-test-"));
  process.env.PERSONA_LAB_HOME = dir;
  return dir;
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

function readBack(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

test("validator throws on an unrecognised JSON Schema keyword (self-check)", () => {
  assert.throws(
    () => validate({ type: "string", pattern: "^a" }, "abc"),
    (err) => {
      assert.match(err.message, /pattern/);
      return true;
    }
  );
});

test("validator throws for an unsupported keyword on a property the instance omits", () => {
  // The guarantee has to hold schema-wide, not just along the path the test
  // data happens to walk. An unsupported keyword buried in an optional
  // property must still throw when that property is absent — otherwise the
  // suite goes green on a schema rule nobody is actually checking.
  assert.throws(
    () => validate(
      { type: "object", properties: { url: { type: "string", minLength: 3 } } },
      { }
    ),
    (err) => {
      assert.match(err.message, /minLength/);
      assert.match(err.message, /\/properties\/url/);
      return true;
    }
  );
});

test("minimal encounter round-trips through saveEncounter and validates", () => {
  freshHome();
  const { path: file, encounter } = saveEncounter(validEncounter());

  const inMemory = validate(schema, encounter);
  assert.equal(inMemory.ok, true, `in-memory encounter failed schema validation: ${JSON.stringify(inMemory.errors)}`);

  const onDisk = validate(schema, readBack(file));
  assert.equal(onDisk.ok, true, `on-disk encounter failed schema validation: ${JSON.stringify(onDisk.errors)}`);

  // The exact regression a "const": "1.0" schema would have failed: the
  // writer's real schema_version value must both match the exported
  // constant AND satisfy the schema.
  assert.equal(encounter.schema_version, ENCOUNTER_SCHEMA_VERSION);
  const versionOnly = validate(
    { type: "object", properties: { schema_version: schema.properties.schema_version } },
    { schema_version: encounter.schema_version }
  );
  assert.equal(versionOnly.ok, true, `schema_version "${encounter.schema_version}" does not satisfy the schema: ${JSON.stringify(versionOnly.errors)}`);
});

test("maximal encounter, exercising every optional property, round-trips and validates", () => {
  freshHome();
  const input = validEncounter({
    ended_at: "2026-08-31T01:00:00.000Z",
    run_id: "run_checkout_2026-08-31_ab12cd",
    artifact: {
      slug: "checkout",
      label: "Checkout",
      url: "https://example.test/checkout",
      version: "v1.2.3",
      frozen: true, // requires artifact.version, set above
      project: "storefront",
    },
    blind: false,
    prior_encounters_shown: ["enc_persona-test_checkout_2026-08-30_abc123"],
    conditions: {
      viewports: ["desktop-1440", "phone-390"],
      driver: "real browser session",
      time_budget: "four minutes",
    },
    findings: [
      {
        kind: "defect",
        claim: "The submit button does nothing on phone-390.",
        quote: "I tapped it three times and nothing happened.",
        locus: "checkout submit button",
        viewport: "phone-390",
        severity: "major",
        verified: "confirmed",
        verification_note: "Reproduced: click handler is never attached below 400px.",
      },
    ],
    decisions: [
      { action: "Tried resizing the window to desktop width", rationale: "To see if the bug was viewport-specific", gave_up: false },
    ],
    unanswered: ["Does this also break on tablet widths?"],
    outcome: {
      understood_purpose: true,
      would_recommend: false,
      score: 2.5,
      verdict: "fails",
    },
  });

  const { path: file } = saveEncounter(input);
  const result = validate(schema, readBack(file));
  assert.equal(result.ok, true, `maximal encounter failed schema validation: ${JSON.stringify(result.errors)}`);
});

test("filled scaffold round-trips and validates", () => {
  freshHome();
  const scaffold = scaffoldEncounter({
    persona_id: "persona_test_ab12cd34",
    artifact: { slug: "checkout", label: "Checkout" },
  });

  scaffold.verbatim = "The checkout flow was clear except the promo code field, which I could not find.";
  scaffold.findings[0].claim = "No visible promo code field on the checkout page.";
  // scaffoldEncounter emits outcome.understood_purpose: null; the schema
  // types it as boolean. Set it explicitly here rather than relax the
  // schema or the test — see the null-default hazard noted below.
  scaffold.outcome.understood_purpose = true;

  const { path: file } = saveEncounter(scaffold);
  const result = validate(schema, readBack(file));
  assert.equal(result.ok, true, `filled scaffold failed schema validation: ${JSON.stringify(result.errors)}`);
});

test("validator rejects a mutated encounter (negative control)", () => {
  freshHome();
  const { path: file } = saveEncounter(validEncounter());
  const saved = readBack(file);

  const badVersion = { ...saved, schema_version: "1.0" };
  const versionResult = validate(schema, badVersion);
  assert.equal(versionResult.ok, false, "mutating schema_version to the old value must fail validation");

  const badExtraKey = { ...saved, nonsense: true };
  const extraKeyResult = validate(schema, badExtraKey);
  assert.equal(extraKeyResult.ok, false, "an unknown top-level key must fail validation under additionalProperties: false");
});
