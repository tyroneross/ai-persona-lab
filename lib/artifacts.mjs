/** Frozen explicit-file inputs. Hashes prove byte identity, not author authenticity.
 * Locators are excluded from identity: after moving a snapshot, update
 * snapshot_root in both the caller's record and manifest.json. Relative file
 * paths and the digest remain portable; source.root is historical context.
 * These checks assume the local filesystem is not concurrently replaced by an
 * adversary (Node has no portable directory-descriptor-relative open API).
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digestPattern = /^[a-f0-9]{64}$/;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const canonical = (v) => JSON.stringify(v, (_, value) => object(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value);
const identity = (m) => ({ schema_version: m.schema_version, created_at: m.created_at,
  source: { git: m.source.git }, files: m.files });

function relativeFile(value) {
  if (typeof value !== "string" || !value || value.includes("\\") || value.includes("\0") || value.includes(":")) {
    throw new Error("file path must be a non-empty portable relative path");
  }
  if (path.posix.isAbsolute(value) || value.split("/").some((p) => !p || p === "." || p === "..")) {
    throw new Error(`unsafe relative file path: ${value}`);
  }
  return value;
}

// Check every existing component, including a link used as a parent directory.
function checkedPath(value, { missing = false } = {}) {
  if (typeof value !== "string" || !value.trim() || value.includes("\0")) throw new Error("path is required");
  const absolute = path.resolve(value);
  let current = path.parse(absolute).root;
  const parts = absolute.slice(current.length).split(path.sep).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = lstatSync(current); } catch (error) {
      if (missing && error.code === "ENOENT") return absolute;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`symlink is not allowed: ${current}`);
    if (i < parts.length - 1 && !stat.isDirectory()) throw new Error(`not a directory: ${current}`);
  }
  return absolute;
}

function readRegular(file) {
  checkedPath(file);
  if (!lstatSync(file).isFile()) throw new Error(`not a regular file: ${file}`);
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(fd).isFile()) throw new Error(`not a regular file: ${file}`);
    return readFileSync(fd);
  } finally { closeSync(fd); }
}

function gitIdentity(root) {
  const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  try {
    git("rev-parse", "--show-toplevel");
    const status = git("status", "--porcelain=v1", "-z", "--untracked-files=all");
    let commit = null;
    try { commit = git("rev-parse", "--verify", "HEAD").trim(); } catch { /* Unborn repository. */ }
    return { commit, dirty: status.length > 0, status_sha256: hash(status) };
  } catch { return { commit: null, dirty: null, status_sha256: null }; }
}

/** destination must not exist; files must explicitly name regular files. */
export function freezeArtifact({ root, files, destination } = {}) {
  const sourceRoot = checkedPath(root);
  if (!lstatSync(sourceRoot).isDirectory()) throw new Error("root must be a directory");
  if (!Array.isArray(files) || files.length === 0) throw new Error("files must be an explicit non-empty array");
  const paths = files.map(relativeFile).sort();
  if (new Set(paths).size !== paths.length) throw new Error("duplicate file path/output collision");
  const snapshotRoot = checkedPath(destination, { missing: true });
  if (sourceRoot === snapshotRoot || sourceRoot.startsWith(snapshotRoot + path.sep)) throw new Error("snapshot cannot contain its source root");
  for (const relative of paths) {
    const file = path.join(sourceRoot, relative);
    if (file === snapshotRoot || file.startsWith(snapshotRoot + path.sep)) throw new Error("cannot copy snapshot into itself");
  }
  // Read before creating destination: a failed input never leaves a partial snapshot.
  const inputs = paths.map((relative) => ({ path: relative, bytes: readRegular(path.join(sourceRoot, relative)) }));
  const manifest = {
    schema_version: "1.0.0", created_at: new Date().toISOString(),
    source: { root: sourceRoot, git: gitIdentity(sourceRoot) }, snapshot_root: snapshotRoot,
    files: inputs.map(({ path: file, bytes }) => ({ path: file, size_bytes: bytes.length, sha256: hash(bytes) })),
  };
  manifest.sha256 = hash(canonical(identity(manifest)));
  mkdirSync(path.dirname(snapshotRoot), { recursive: true });
  mkdirSync(snapshotRoot); // Exclusive ownership: never overwrite an existing output.
  try {
    for (const input of inputs) {
      const output = path.join(snapshotRoot, "files", input.path);
      mkdirSync(path.dirname(output), { recursive: true });
      writeFileSync(output, input.bytes, { flag: "wx" });
    }
    writeFileSync(path.join(snapshotRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    return manifest;
  } catch (error) {
    rmSync(snapshotRoot, { recursive: true, force: true });
    throw error;
  }
}

function validateManifest(m) {
  if (!object(m) || m.schema_version !== "1.0.0") throw new Error("unsupported artifact manifest");
  if (typeof m.created_at !== "string" || !Number.isFinite(Date.parse(m.created_at))) throw new Error("invalid created_at");
  if (!object(m.source) || typeof m.source.root !== "string" || !object(m.source.git)) throw new Error("invalid source identity");
  const g = m.source.git;
  if (!(g.commit === null || typeof g.commit === "string" && /^[a-f0-9]{40,64}$/.test(g.commit)) ||
      !(g.dirty === null || typeof g.dirty === "boolean") ||
      !(g.status_sha256 === null || typeof g.status_sha256 === "string" && digestPattern.test(g.status_sha256))) throw new Error("invalid git identity");
  if (typeof m.snapshot_root !== "string" || !path.isAbsolute(m.snapshot_root)) throw new Error("snapshot_root must be absolute");
  if (!Array.isArray(m.files) || !m.files.length) throw new Error("manifest files must be non-empty");
  const seen = new Set();
  for (const f of m.files) {
    if (!object(f)) throw new Error("invalid file record");
    relativeFile(f.path);
    if (seen.has(f.path)) throw new Error("duplicate manifest file path");
    seen.add(f.path);
    if (!Number.isSafeInteger(f.size_bytes) || f.size_bytes < 0 || typeof f.sha256 !== "string" || !digestPattern.test(f.sha256)) throw new Error("invalid file digest or size");
  }
  if (typeof m.sha256 !== "string" || !digestPattern.test(m.sha256) || hash(canonical(identity(m))) !== m.sha256) throw new Error("manifest sha256 mismatch");
}

/** Verify against the caller's recorded digest and the durable manifest. */
export function verifyArtifact(manifest) {
  const errors = [];
  try {
    validateManifest(manifest);
    const root = checkedPath(manifest.snapshot_root);
    const stored = JSON.parse(readRegular(path.join(root, "manifest.json")).toString("utf8"));
    validateManifest(stored);
    if (canonical(identity(stored)) !== canonical(identity(manifest)) || stored.sha256 !== manifest.sha256) throw new Error("stored manifest identity mismatch");
    if (stored.snapshot_root !== manifest.snapshot_root) throw new Error("stored snapshot locator mismatch");
    for (const f of manifest.files) {
      try {
        const bytes = readRegular(path.join(root, "files", f.path));
        if (bytes.length !== f.size_bytes || hash(bytes) !== f.sha256) errors.push(`file digest mismatch: ${f.path}`);
      } catch (error) { errors.push(`${f.path}: ${error.message}`); }
    }
  } catch (error) { errors.push(error.message); }
  return { ok: errors.length === 0, errors };
}
