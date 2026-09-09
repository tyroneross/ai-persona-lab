import path from 'node:path';
import {lstatSync} from 'node:fs';
import {libraryHome} from './library.mjs';
import {assertIdSegment} from './idpath.mjs';

/** Refuse symlinks below the caller-selected library root. */
export function safeStorePath(...segments) {
  let current=libraryHome();
  for (const segment of segments) {
    assertIdSegment('path segment',segment);
    current=path.join(current,segment);
    try {if(lstatSync(current).isSymbolicLink()) throw new Error(`symlink is not allowed: ${current}`);}
    catch(err){if(err.code!=='ENOENT')throw err;}
  }
  return current;
}
