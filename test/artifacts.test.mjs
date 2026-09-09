import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { freezeArtifact, verifyArtifact } from "../lib/artifacts.mjs";

function fixture(t) {
  const temp = realpathSync(mkdtempSync(path.join(os.tmpdir(), "persona-artifacts-")));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = path.join(temp, "source");
  mkdirSync(path.join(root, "a"), { recursive: true });
  mkdirSync(path.join(root, "b"));
  writeFileSync(path.join(root, "a", "same.bin"), Buffer.from([0, 128, 255]));
  writeFileSync(path.join(root, "b", "same.bin"), "second");
  const destination = path.join(temp, "snapshot");
  return { temp, root, destination, files: ["a/same.bin", "b/same.bin"] };
}

test("snapshot preserves byte files and directory paths and survives source deletion", (t) => {
  const f = fixture(t);
  const m = freezeArtifact(f);
  assert.equal(m.sha256.length, 64);
  assert.deepEqual(m.source.git, { commit: null, dirty: null, status_sha256: null });
  assert.deepEqual(m.files.map((r) => r.path), f.files);
  assert.deepEqual(readFileSync(path.join(f.destination, "files/a/same.bin")), Buffer.from([0, 128, 255]));
  rmSync(f.root, { recursive: true });
  assert.deepEqual(verifyArtifact(m), { ok: true, errors: [] });
});

test("verification detects a one-byte edit and a missing file", (t) => {
  const f = fixture(t), m = freezeArtifact(f);
  writeFileSync(path.join(f.destination, "files/a/same.bin"), Buffer.from([0, 128, 254]));
  unlinkSync(path.join(f.destination, "files/b/same.bin"));
  const result = verifyArtifact(m);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors.join(" "), /digest mismatch.*a\/same.bin/);
});

test("git identity distinguishes committed clean input and dirty source", (t) => {
  const f = fixture(t);
  const git = (...args) => execFileSync("git", ["-C", f.root, ...args], { stdio: "pipe" }).toString().trim();
  git("init"); git("add", ".");
  git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "-m", "fixture");
  const clean = freezeArtifact(f);
  assert.equal(clean.source.git.commit, git("rev-parse", "HEAD"));
  assert.equal(clean.source.git.dirty, false);
  writeFileSync(path.join(f.root, "a/same.bin"), "dirty");
  const dirty = freezeArtifact({ ...f, destination: path.join(f.temp, "dirty") });
  assert.equal(dirty.source.git.dirty, true);
  assert.notEqual(dirty.source.git.status_sha256, clean.source.git.status_sha256);
});

test("freeze rejects implicit scope, traversal, duplicate outputs and directories", (t) => {
  const f = fixture(t);
  for (const files of [undefined, [], ["../outside"], ["a/../b/same.bin"], ["/etc/hosts"], ["a\\same.bin"], ["C:/file"], ["a/same.bin", "a/same.bin"], ["a"]]) {
    assert.throws(() => freezeArtifact({ ...f, files }));
  }
  assert.throws(() => freezeArtifact({ ...f, destination: f.root }), /snapshot/);
  assert.throws(() => freezeArtifact({ ...f, destination: path.join(f.root, "a") }), /snapshot into itself/);
});

test("freeze refuses preexisting destination without changing it", (t) => {
  const f = fixture(t);
  mkdirSync(f.destination);
  writeFileSync(path.join(f.destination, "sentinel"), "preserve");
  assert.throws(() => freezeArtifact(f), /EEXIST/);
  assert.equal(readFileSync(path.join(f.destination, "sentinel"), "utf8"), "preserve");
});

test("freeze rejects source and destination symlinks, including parents", (t) => {
  const f = fixture(t);
  symlinkSync(path.join(f.root, "a/same.bin"), path.join(f.root, "link"));
  symlinkSync(path.join(f.root, "a"), path.join(f.root, "linked-dir"));
  symlinkSync(f.temp, path.join(f.temp, "parent-link"));
  for (const files of [["link"], ["linked-dir/same.bin"]]) assert.throws(() => freezeArtifact({ ...f, files }), /symlink/);
  assert.throws(() => freezeArtifact({ ...f, destination: path.join(f.temp, "parent-link", "snapshot") }), /symlink/);
});

test("special source files are rejected before opening", (t) => {
  const f = fixture(t);
  execFileSync("mkfifo", [path.join(f.root, "fifo")]);
  assert.throws(() => freezeArtifact({ ...f, files: ["fifo"] }), /not a regular file/);
});

test("verification rejects malformed, traversing and duplicate manifest records", (t) => {
  const f = fixture(t), m = freezeArtifact(f);
  for (const bad of [null, {}, { ...m, files: [{ ...m.files[0], path: "../escape" }] },
    { ...m, files: [{ ...m.files[0], path: "/etc/hosts" }] }, { ...m, files: [m.files[0], m.files[0]] },
    { ...m, files: [{ ...m.files[0], size_bytes: -1 }] }, { ...m, sha256: "0".repeat(64) }]) {
    assert.equal(verifyArtifact(bad).ok, false);
  }
  writeFileSync(path.join(f.destination, "manifest.json"), JSON.stringify({ ...m, files: [] }));
  assert.equal(verifyArtifact(m).ok, false);
});

test("verification rejects symlink replacement of bytes, directories and manifest", (t) => {
  const f = fixture(t), m = freezeArtifact(f);
  const file = path.join(f.destination, "files/a/same.bin");
  unlinkSync(file); symlinkSync(path.join(f.root, "a/same.bin"), file);
  assert.match(verifyArtifact(m).errors.join(" "), /symlink/);
  unlinkSync(file); writeFileSync(file, Buffer.from([0, 128, 255]));
  rmSync(path.join(f.destination, "files/a"), { recursive: true });
  symlinkSync(path.join(f.root, "a"), path.join(f.destination, "files/a"));
  assert.match(verifyArtifact(m).errors.join(" "), /symlink/);
  const manifestPath = path.join(f.destination, "manifest.json");
  const external = path.join(f.temp, "external-manifest.json");
  renameSync(manifestPath, external); symlinkSync(external, manifestPath);
  assert.match(verifyArtifact(m).errors.join(" "), /symlink/);
});

test("snapshot can be relocated with explicit locator updates and unchanged identity", (t) => {
  const f = fixture(t), m = freezeArtifact(f), originalHash = m.sha256;
  const moved = path.join(f.temp, "moved");
  renameSync(f.destination, moved);
  assert.equal(verifyArtifact(m).ok, false);
  m.snapshot_root = moved;
  writeFileSync(path.join(moved, "manifest.json"), JSON.stringify(m));
  assert.equal(verifyArtifact(m).ok, true);
  assert.equal(m.sha256, originalHash);
});
