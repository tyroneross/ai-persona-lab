/**
 * idpath — the guard between a validated id and a filesystem path segment.
 *
 * `persona_id` and `run_id` both carry two jobs: an identity string, AND a
 * folder name under a shared store root. Every store in this repo validates
 * only the first job ("non-empty string") and then hands the value straight
 * to `path.join()`. A value that is not a single safe path segment — ".",
 * "..", "sub/dir", a leading dot — silently redirects the write into the
 * shared parent, a sibling folder, or outside the store entirely. The write
 * still reports success; the failure surfaces later, elsewhere, as an
 * unrelated stack trace. This module is the one place that check lives, so
 * every store that mints a folder from an id calls it before `path.join`.
 */

/**
 * Return a human reason `value` cannot be used as a single store folder
 * name, or `null` if it can. Order matters: each rule below is a path-safety
 * property the current "non-empty string" check does not cover, and the
 * first violation found is the one reported — a value can fail more than one
 * rule, but only one reason is ever useful to the caller.
 */
export function pathSegmentProblem(value) {
  if (typeof value !== "string") return "must be a string";
  if (value.trim().length === 0) return "is required";
  if (value !== value.trim()) return "has leading or trailing whitespace";
  if (value.includes("/") || value.includes("\\")) return "contains a path separator";
  if (value.includes("\0")) return "contains a NUL byte";
  if (value === "." || value === "..") return "is a relative path reference";
  if (value.startsWith(".")) return "starts with a dot, which hides the folder";
  return null;
}

/**
 * Throw if `value` cannot be used as a store folder name. Two message
 * shapes on purpose: "missing" is a different failure than "present but
 * unsafe" and the fix is different too (supply the field vs. fix the
 * value), so the reader should not have to parse a shared sentence to tell
 * them apart.
 */
export function assertIdSegment(field, value, { missingClause, hint } = {}) {
  const reason = pathSegmentProblem(value);
  if (reason === null) return;

  // "Missing" (nothing was supplied, or it was blank) gets a different
  // message than "present but unsafe" — the fix in each case is different
  // (supply the field vs. fix the value). `undefined`/`null` fail the
  // "must be a string" rule before ever reaching the blank check below, so
  // this is checked directly rather than by matching on `reason`'s text.
  const missing = value === undefined || value === null ||
    (typeof value === "string" && value.trim().length === 0);

  let message;
  if (missing) {
    message = `${field} is required — ${missingClause || "there is no folder to file this record under."}`;
  } else {
    message = `${field} is not a usable identifier: ${reason}. Value: ${JSON.stringify(value)}`;
  }
  // `hint` may be a plain string or a zero-arg function. It is resolved HERE,
  // only on the throw path — a caller like saveEncounter's recovery hint can
  // cost a full personas.json read, and the happy path (every valid save)
  // must not pay for a hint it will never see.
  if (hint) message += `\n${typeof hint === "function" ? hint() : hint}`;
  throw new Error(message);
}
