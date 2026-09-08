import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const skill = fileURLToPath(new URL('../skills/persona-output-comparison/', import.meta.url));
const generator = join(skill, 'scripts/create_dashboard.py');
const fixture = join(skill, 'examples/release-plan.json');

test('comparison generation preserves task units and rejects replacement of saved work', () => {
  const dir = mkdtempSync(join(tmpdir(), 'persona-comparison-'));
  try {
    const out = join(dir, 'output');
    execFileSync('python3', [generator, fixture, '--out', out]);
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json')));
    assert.equal(Object.keys(manifest.labels).length, 3);
    assert.equal(manifest.drafts.length, 2);
    for (const draft of manifest.drafts) assert.equal(draft.sections.length, 3);
    writeFileSync(join(out, 'selections.json'), '{"keep":true}');
    assert.notEqual(spawnSync('python3', [generator, fixture, '--out', out]).status, 0);
    assert.equal(readFileSync(join(out, 'selections.json'), 'utf8'), '{"keep":true}');
    const config = JSON.parse(readFileSync(fixture));
    config.task.title = 'Literal /*APP*/ and {{description}} </script>';
    writeFileSync(join(dir, 'markers.json'), JSON.stringify(config));
    execFileSync('python3', [generator, join(dir, 'markers.json'), '--out', join(dir, 'markers')]);
    const html = readFileSync(join(dir, 'markers/index.html'), 'utf8');
    assert.ok(html.includes('<title>Literal /*APP*/ and {{description}} &lt;/script&gt;</title>'));
    assert.equal((html.match(/<script>/g) || []).length, 1);
    config.task.linkBase = 'javascript:alert(1)';
    writeFileSync(join(dir, 'bad.json'), JSON.stringify(config));
    assert.notEqual(spawnSync('python3', [generator, join(dir, 'bad.json'), '--out', join(dir, 'bad')]).status, 0);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('local selection API preserves custom output and omissions and rejects stale or foreign writes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'persona-comparison-api-'));
  const out = join(dir, 'output');
  execFileSync('python3', [generator, fixture, '--out', out]);
  const child = spawn('python3', [join(out, 'serve.py')], {stdio: ['ignore', 'pipe', 'pipe']});
  try {
    const line = await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => {throw Error('Server exited');})]);
    const url = line[0].toString().match(/http:\/\/127.0.0.1:\d+/)[0];
    const manifest = JSON.parse(readFileSync(join(out, 'manifest.json')));
    const keys = Object.keys(manifest.labels), id = manifest.drafts[0].id;
    const payload = {version: manifest.version, sourceCommit: manifest.sourceCommit, draftHashes: Object.fromEntries(manifest.drafts.map(d => [d.id, d.hash])), savedAt: Date.now(), base: id,
      sections: {[keys[0]]: id}, omitted: [keys[1]], custom: 'User wording\n', assembledMarkdown: 'User wording\n'};
    const post = (body, headers = {}) => fetch(url+'/api/selections', {method: 'POST', headers: {'Content-Type':'application/json', ...headers}, body: JSON.stringify(body)});
    assert.equal((await post(payload)).status, 200);
    assert.deepEqual(await (await fetch(url+'/api/selections')).json(), payload);
    assert.equal(readFileSync(join(out, 'selected-output.md'), 'utf8'), payload.custom);
    assert.equal((await post({...payload, savedAt: payload.savedAt - 1})).status, 409);
    assert.equal((await post({...payload, notes: 'Collision'})).status, 409);
    assert.equal((await post(payload)).status, 200);
    assert.equal((await post({...payload, custom: null})).status, 400);
    assert.equal((await post({...payload, assembledMarkdown: 'Different'})).status, 400);
    assert.equal((await post(payload, {Origin:'https://foreign.example'})).status, 403);
    assert.equal((await post({...payload, version:'wrong'})).status, 400);
    assert.equal((await post({...payload, omitted:keys})).status, 400);
    assert.equal((await post({...payload, savedAt:null})).status, 400);
    assert.equal((await fetch(url+'/selections.json')).status, 404);
    assert.deepEqual(await (await fetch(url+'/api/selections')).json(), payload);
    const mechanical = {...payload, savedAt: payload.savedAt + 1, custom: null,
      assembledMarkdown: manifest.drafts[0].sections.find(s => s.key === keys[0]).markdown + '\n'};
    assert.equal((await post(mechanical)).status, 200);
    assert.equal(readFileSync(join(out, 'selected-output.md'), 'utf8'), mechanical.assembledMarkdown);
  } finally { child.kill(); await once(child, 'exit'); rmSync(dir, {recursive: true, force: true}); }
});
