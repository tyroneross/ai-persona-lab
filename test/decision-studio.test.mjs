import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
let child, childExit, dataDir, base;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'decision-studio-'));
  child = spawn('python3', ['modules/decision-studio/studio.py', '--port', '0', '--data-dir', dataDir, '--quiet'], { cwd: root, stdio: ['ignore', 'pipe', 'inherit'] });
  childExit = new Promise(resolve => child.once('exit', resolve));
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Decision Studio server did not start within 5 seconds')), 5_000);
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Decision Studio server exited during startup (${code})`)));
    child.stdout.once('data', chunk => {
      const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
      if (!match) return reject(new Error('Decision Studio server did not print a loopback URL'));
      clearTimeout(timer);
      resolve(match[0]);
    });
  });
});

after(async () => {
  if (child && child.exitCode === null) child.kill();
  if (childExit) await childExit;
  await rm(dataDir, { recursive: true, force: true });
});

const request = {
  version: 1, baseRevision: 0, mode: 'request-reviews', templateId: 'readme', title: 'Choose project README',
  question: 'Which draft best explains the project?', sourceRefs: ['README.md', 'drafts/second.md'],
  roles: [{ label: 'New user', brief: 'Test the first-use path.', selected: true }, { label: 'Maintainer', brief: '', selected: true }, { label: 'Editor', brief: 'Check every claim.', selected: false }], alternatives: [],
  comparisonUnits: [{ label: 'Opening', included: true }, { label: 'Setup', included: false }], notes: 'Preserve the omitted setup unit.'
};

test('serves only allowlisted setup resources with security headers', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Save review request/);
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  assert.equal((await fetch(base + '/studio.py')).status, 404);
  const templates = await (await fetch(base + '/api/templates')).json();
  assert.deepEqual(templates.templates.map(item => item.id), ['readme', 'ui-ux', 'writing', 'custom']);
  assert.ok(templates.templates.every(item => !item.selectedRoles));
});

test('validates roles and saves exact editable choices', async () => {
  const invalid = structuredClone(request);
  invalid.roles[1].selected = false;
  assert.equal((await fetch(base + '/api/request', { method: 'POST', body: JSON.stringify(invalid) })).status, 400);

  const savedResponse = await fetch(base + '/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
  assert.equal(savedResponse.status, 200);
  const saved = (await savedResponse.json()).request;
  assert.equal(saved.revision, 1);
  assert.deepEqual(saved.roles, request.roles);
  assert.deepEqual(saved.comparisonUnits, request.comparisonUnits);
  assert.deepEqual(saved.sourceRefs, request.sourceRefs);
  const reloaded = await (await fetch(base + '/api/request')).json();
  assert.deepEqual(reloaded, saved);
  assert.deepEqual(JSON.parse(await readFile(path.join(dataDir, 'review-request.json'), 'utf8')), saved);
  assert.equal((await (await fetch(base + '/api/request?revision=1')).json()).title, request.title);
});

test('rejects stale revisions without overwriting the saved request', async () => {
  const stale = { ...request, title: 'Stale edit' };
  const response = await fetch(base + '/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stale) });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).revision, 1);
  assert.equal((await (await fetch(base + '/api/request')).json()).title, request.title);
});

test('rejects cross-origin writes and accepts explicit omission of all units', async () => {
  const crossOrigin = await fetch(base + '/api/request', { method: 'POST', headers: { Origin: 'https://example.com' }, body: JSON.stringify({ ...request, baseRevision: 1 }) });
  assert.equal(crossOrigin.status, 403);
  const hiddenDraft = [{ label: 'Unfinished option', sourceRef: '', content: '' }, { label: '', sourceRef: 'drafts/later.md', content: '' }];
  const allOmitted = { ...request, baseRevision: 1, alternatives: hiddenDraft, comparisonUnits: request.comparisonUnits.map(unit => ({ ...unit, included: false })) };
  const response = await fetch(base + '/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(allOmitted) });
  assert.equal(response.status, 200);
  const saved = (await response.json()).request;
  assert.ok(saved.comparisonUnits.every(unit => !unit.included));
  assert.deepEqual(saved.alternatives, hiddenDraft);
});

test('saves existing alternatives without reviewer roles', async () => {
  const existing = { ...request, baseRevision: 2, mode: 'compare-existing', roles: [], alternatives: [
    { label: 'Current draft', sourceRef: 'drafts/current.md', content: '' },
    { label: 'Proposed draft', sourceRef: '', content: '  # Proposed\n\n    indented code\n' }
  ] };
  const incomplete = structuredClone(existing);
  incomplete.alternatives[1].content = '';
  assert.equal((await fetch(base + '/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(incomplete) })).status, 400);
  const response = await fetch(base + '/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(existing) });
  assert.equal(response.status, 200);
  const saved = (await response.json()).request;
  assert.equal(saved.mode, 'compare-existing');
  assert.deepEqual(saved.roles, []);
  assert.deepEqual(saved.alternatives, existing.alternatives);
  assert.equal(saved.alternatives[1].content, '  # Proposed\n\n    indented code\n');
});

test('retains immutable revisions and exposes bounded history metadata', async () => {
  const first = await (await fetch(base + '/api/request?revision=1')).json();
  const second = await (await fetch(base + '/api/request?revision=2')).json();
  const third = await (await fetch(base + '/api/request?revision=3')).json();
  assert.equal(first.title, 'Choose project README');
  assert.ok(second.comparisonUnits.every(unit => !unit.included));
  assert.equal(third.mode, 'compare-existing');

  const history = await (await fetch(base + '/api/history')).json();
  assert.equal(history.latestRevision, 3);
  assert.deepEqual(history.requests.map(item => item.revision), [1, 2, 3]);
  assert.deepEqual(Object.keys(history.requests[0]), ['revision', 'title', 'mode', 'templateId', 'savedAt']);

  assert.equal((await fetch(base + '/api/request?revision=0')).status, 400);
  assert.equal((await fetch(base + '/api/request?revision=abc')).status, 400);
  assert.equal((await fetch(base + '/api/request?revision=999')).status, 404);
});

test('finishes an interrupted archival retry without replacing its snapshot', async () => {
  const retry = { ...request, baseRevision: 3, title: 'Recovered archived request' };
  const archived = { ...retry, revision: 4, savedAt: 123456789 };
  delete archived.baseRevision;
  const snapshot = path.join(dataDir, 'history', 'revision-4.json');
  await writeFile(snapshot, JSON.stringify(archived, null, 2) + '\n', { mode: 0o600 });
  await chmod(snapshot, 0o600);

  const response = await fetch(base + '/api/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(retry) });
  assert.equal(response.status, 200);
  const reply = await response.json();
  assert.equal(reply.request.savedAt, archived.savedAt);
  assert.equal(reply.requestUrl, '/api/request?revision=4');
  assert.deepEqual(await (await fetch(base + reply.requestUrl)).json(), archived);
  assert.deepEqual(JSON.parse(await readFile(snapshot, 'utf8')), archived);
});

 test('decision files and backups are owner-only', async () => {
  assert.equal((await stat(dataDir)).mode & 0o777, 0o700);
  for (const name of ['review-request.json', 'review-request.previous.json']) {
    assert.equal((await stat(path.join(dataDir, name))).mode & 0o777, 0o600);
  }
  assert.equal((await stat(path.join(dataDir, 'history'))).mode & 0o777, 0o700);
  for (const revision of [1, 2, 3, 4]) {
    assert.equal((await stat(path.join(dataDir, 'history', `revision-${revision}.json`))).mode & 0o777, 0o600);
  }
});
