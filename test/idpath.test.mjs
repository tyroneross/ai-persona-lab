import test from "node:test";
import assert from "node:assert/strict";
import { pathSegmentProblem, assertIdSegment } from "../lib/idpath.mjs";

const UNSAFE = ["", "  ", ".", "..", "./", "a/..", "../escape", "sub/dir", "  x  ", ".hidden", "a\\b"];
const SAFE = ["persona_marcus-oyelaran_adhoc", "run_checkout_2026-08-31_ab12cd", "p1"];

test("pathSegmentProblem rejects every unsafe value", () => {
  for (const v of UNSAFE) {
    const reason = pathSegmentProblem(v);
    assert.notEqual(reason, null, `expected a reason for ${JSON.stringify(v)}`);
    assert.equal(typeof reason, "string");
  }
});

test("pathSegmentProblem accepts every safe value", () => {
  for (const v of SAFE) {
    assert.equal(pathSegmentProblem(v), null, `expected no reason for ${JSON.stringify(v)}`);
  }
});

test("pathSegmentProblem rejects non-string input", () => {
  assert.notEqual(pathSegmentProblem(undefined), null);
  assert.notEqual(pathSegmentProblem(null), null);
  assert.notEqual(pathSegmentProblem(42), null);
});

test("pathSegmentProblem rejects a NUL byte", () => {
  assert.notEqual(pathSegmentProblem("a\0b"), null);
});

test("assertIdSegment does not throw for a safe value", () => {
  assert.doesNotThrow(() => assertIdSegment("persona_id", "persona_marcus-oyelaran_adhoc"));
});

test("assertIdSegment names the field and the missing clause when absent", () => {
  assert.throws(
    () => assertIdSegment("persona_id", "", { missingClause: "no folder to file it under." }),
    (err) => {
      assert.match(err.message, /persona_id is required/);
      assert.match(err.message, /no folder to file it under\./);
      return true;
    }
  );
});

test("assertIdSegment names the field, the reason, and the value when unsafe", () => {
  assert.throws(
    () => assertIdSegment("run_id", ".."),
    (err) => {
      assert.match(err.message, /run_id is not a usable identifier/);
      assert.match(err.message, /relative path reference/);
      assert.match(err.message, /"\.\."/);
      return true;
    }
  );
});

test("assertIdSegment appends the hint on its own line when supplied", () => {
  assert.throws(
    () => assertIdSegment("persona_id", ".", { hint: "Did you mean persona_id \"p1\"?" }),
    (err) => {
      assert.match(err.message, /Did you mean persona_id "p1"\?/);
      return true;
    }
  );
});

test("assertIdSegment accepts a zero-arg function hint and calls it only on the throw path", () => {
  let calls = 0;
  const hint = () => {
    calls += 1;
    return "Did you mean persona_id \"p1\"?";
  };

  assert.throws(
    () => assertIdSegment("persona_id", ".", { hint }),
    (err) => {
      assert.match(err.message, /Did you mean persona_id "p1"\?/);
      return true;
    }
  );
  assert.equal(calls, 1, "the hint function must run exactly once when the guard throws");
});

test("assertIdSegment does NOT invoke a function hint when the value is a valid segment", () => {
  let calls = 0;
  const hint = () => {
    calls += 1;
    return "should never run";
  };

  assert.doesNotThrow(() => assertIdSegment("persona_id", "persona_marcus-oyelaran_adhoc", { hint }));
  assert.equal(calls, 0, "a passing assertIdSegment call must never evaluate the hint");
});
