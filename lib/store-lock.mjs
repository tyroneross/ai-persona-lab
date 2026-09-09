import {mkdirSync,openSync,closeSync,unlinkSync} from 'node:fs';
import path from 'node:path';

/** Bounded local transaction lock. Never steals a paused or crashed writer's lock. */
export function withStoreLock(file, work, timeoutMs = 5000) {
  mkdirSync(path.dirname(file), {recursive:true});
  const deadline = Date.now() + timeoutMs;
  let fd;
  while (fd === undefined) {
    try { fd = openSync(file, 'wx', 0o600); }
    catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() >= deadline) throw new Error(`store is busy; retry after its writer finishes (lock: ${file})`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try { return work(); }
  finally { closeSync(fd); unlinkSync(file); }
}
