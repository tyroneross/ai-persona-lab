import {discussionError} from './discussion.mjs';
/** Check the target independently of Origin to reject DNS-rebinding hosts. */
export function assertDiscussionHost(host) {
  let target;
  try {target = new URL(`http://${host}`);}
  catch {throw discussionError('Invalid discussion request host',403);}
  if (!host || !['localhost','127.0.0.1','[::1]'].includes(target.hostname) || target.host !== host) throw discussionError('Discussions require a loopback app address',403);
  return target;
}
export function assertDiscussionWrite(request) {
  const target = assertDiscussionHost(request.headers.get('host'));
  const origin = request.headers.get('origin');
  if (origin ? origin !== target.origin : request.headers.get('sec-fetch-site') !== 'same-origin') throw discussionError('Cross-origin discussion writes are not allowed',403);
}
