import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validate } from "./helpers/jsonschema.mjs";

const cli = fileURLToPath(new URL("../bin/persona.mjs", import.meta.url));
const encounterSchema = JSON.parse(readFileSync(new URL("../schemas/encounter.schema.json", import.meta.url)));

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "journey-packet-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, "library");
  mkdirSync(home);
  const persona = { id: "p1", name: "Curious newcomer", role: "Operations lead", summary: "A first-time visitor learning practical AI concepts before evaluating a product.", primary_goal: "Understand RAG well enough to judge Atomize.", goals: ["Learn the concept", "Find a concrete example"], frustrations: ["Unexplained jargon"], behaviors: ["Uses visible navigation"] };
  writeFileSync(path.join(home, "personas.json"), JSON.stringify({ personas: [persona] }));
  const study = { objective: "Learn RAG and assess Atomize from the visible site.", target_concepts: ["embeddings", "vector database", "retrieval-augmented generation"], tasks: [{ id: "find-learning", instruction: "Find a learning path from the home page." }], questions: [{ id: "q1", prompt: "Explain RAG in your own words.", type: "relationship", expected_concepts: ["retrieve evidence before generation"], max_score: 2, rubric: "2 = correct order and evidence purpose; 1 = partial; 0 = wrong or absent." }] };
  const studyPath = path.join(root, "study.json");
  writeFileSync(studyPath, JSON.stringify(study));
  const call = (args, expected = 0) => { const result = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", env: { ...process.env, PERSONA_LAB_HOME: home } }); assert.equal(result.status, expected, result.stderr); return JSON.parse(result.stdout); };
  const run = call(["run", "new", "Test visible comprehension", "--artifact", "site", "--label", "Site", "--url", "https://example.test", "--version", "live-1", "--personas", "p1", "--study", studyPath, "--json"]);
  return { root, home, call, run };
}

test("journey packet separates persona-visible instructions from assessor answers", (t) => {
  const f = fixture(t);
  const result = f.call(["run", "journey", f.run.run_id, "p1", "--viewports", "390x844", "--tools", "computer-use,screenshot", "--json"]);
  const packet = JSON.parse(readFileSync(path.join(result.path, "packet.json")));
  const assessor = JSON.parse(readFileSync(result.assessor_path));
  const goal = readFileSync(path.join(result.path, "GOAL.md"), "utf8");
  const soul = readFileSync(path.join(result.path, "SOUL.md"), "utf8");
  assert.equal(packet.questions[0].expected_concepts, undefined);
  assert.equal(packet.questions[0].rubric, undefined);
  assert.deepEqual(assessor.questions[0].expected_concepts, ["retrieve evidence before generation"]);
  assert.doesNotMatch(goal, /retrieve evidence before generation/);
  assert.match(soul, /visible interface/);
  assert.match(soul, /Do not inspect source code/);
  assert.match(readFileSync(path.join(result.path, "CAPABILITIES.md"), "utf8"), /working capabilities, not a description/);
  assert.deepEqual(packet.protocol.required_capabilities, ["navigate", "interact", "inspect", "viewport", "snapshot"]);
  assert.equal(Object.values(packet.encounter_template.conditions.capabilities).every((capability) => capability.status === "unverified"), true);
  assert.equal(validate(encounterSchema, packet.encounter_template).ok, true);
});

test("journey packet requires a study", (t) => {
  const f = fixture(t);
  const noStudy = f.call(["run", "new", "No study", "--artifact", "plain", "--url", "https://example.test", "--version", "live-1", "--personas", "p1", "--json"]);
  const result = spawnSync(process.execPath, [cli, "run", "journey", noStudy.run_id, "p1", "--json"], { encoding: "utf8", env: { ...process.env, PERSONA_LAB_HOME: f.home } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /created with --study/);
});
