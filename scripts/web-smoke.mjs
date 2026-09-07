#!/usr/bin/env node
// Exercise the built app and shared CLI library using disposable data, no LLMs.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'apps/web');
const temp = mkdtempSync(path.join(tmpdir(), 'persona-web-smoke-'));
process.env.PERSONA_LAB_HOME = path.join(temp, 'library');
process.env.PERSONA_COUNCIL_DATA_DIR = path.join(temp, 'councils');
const { savePersona, getPersona, validatePersona } = await import('../lib/library.mjs');
const socket = createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise(resolve => socket.close(resolve));
let server;
let logs = '';
try {
  const people = Array.from({ length: 8 }, (_, i) => savePersona({
    name: `Smoke Person ${i}`, archetype: 'Product reviewer', role: 'Product reviewer',
    summary: 'A synthetic test persona for verifying the shared library integration.',
    primary_goal: 'Complete the review', job_to_be_done: 'When reviewing, I want evidence so I can decide.',
    goals: ['Review clearly'], frustrations: ['Missing evidence'], motivations: ['Clarity'],
    behaviors: ['Read the facts'], needs: ['Evidence'], anti_goals: ['Unsupported claims'],
    scenarios: [{ title: 'Review', description: 'Review a synthetic artifact.' }],
    evidence: [{ id: 'evidence_smoke', source_type: 'synthetic', summary: 'Test fixture only.', confidence: 0.4 }],
    confidence: 0.4, provenance: 'synthetic-assumed', tags: ['smoke'],
  }));
  const planner = JSON.parse(execFileSync(process.execPath,
    [path.resolve(web, '../../scripts/persona-plan.mjs'), '--json', '--count', '3', 'Review onboarding'],
    { cwd: web, encoding: 'utf8' }));
  assert.equal(planner.personas.length, 3);
  assert.ok(planner.personas.every(p => p.primaryQuestion));
  server = spawn(process.execPath, [path.join(web, 'node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1', '-p', String(port)],
    { cwd: web, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { logs = (logs + chunk).slice(-12000); });
  server.stderr.on('data', chunk => { logs = (logs + chunk).slice(-12000); });
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${logs}`);
    try { if ((await fetch(`${base}/api/personas`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready, `Server did not become ready: ${logs}`);
  async function request(route, method = 'GET', body) {
    const response = await fetch(base + route, { method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) });
    const data = await response.json();
    assert.ok(response.ok, `${method} ${route}: ${response.status} ${JSON.stringify(data)}`);
    return data;
  }
  assert.equal((await request('/api/personas')).personas.length, 8);
  const updated = await request(`/api/personas/${people[0].id}`, 'PUT', { ...people[0], name: 'Updated by web' });
  assert.equal(updated.persona.name, 'Updated by web');
  assert.equal(getPersona(people[0].id).name, 'Updated by web');
  assert.equal(getPersona(people[0].id).recall, people[0].recall);
  assert.equal(getPersona(people[0].id).lifespan, people[0].lifespan);
  const created = await request('/api/personas', 'POST', { ...people[1], id: undefined, name: 'Created by web' });
  assert.equal(validatePersona(getPersona(created.persona.id)).ok, true);
  const { roster } = await request('/api/councils/rosters', 'POST', {
    name: 'Smoke roster', repo_path: temp, persona_ids: people.map(p => p.id),
  });
  const { bundle } = await request('/api/councils/runs', 'POST', {
    roster_id: roster.id, request: 'Review synthetic onboarding', level: 'low', runs_per_persona: 1,
  });
  assert.ok(bundle.run.id);
  assert.equal((await request(`/api/councils/${bundle.run.id}`)).bundle.run.id, bundle.run.id);
  for (const route of ['/', '/personas/new', `/personas/${people[0].id}`, '/councils', `/councils/${bundle.run.id}`]) {
    const response = await fetch(base + route, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, route);
    assert.match(await response.text(), /<html/);
  }
  console.log('PASS: shared planner; CLI-to-web read; web-to-CLI create/update; recall preservation; council create/read; five pages. No model calls.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    const killTimer = setTimeout(() => server.kill('SIGKILL'), 5000);
    await stopped;
    clearTimeout(killTimer);
  }
  rmSync(temp, { recursive: true, force: true });
}
