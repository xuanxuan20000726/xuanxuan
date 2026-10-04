import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

test('local Instagram scheduler exposes a credential-safe status endpoint', async () => {
  const port = 43179;
  const child = spawn(process.execPath, ['scripts/instagram-scheduler.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, IG_SCHEDULER_PORT: String(port), META_ACCESS_TOKEN: '', IG_USER_ID: '' },
    stdio: 'ignore'
  });
  try {
    let response;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try { response = await fetch(`http://127.0.0.1:${port}/api/status`); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 50)); }
    }
    assert.equal(response?.status, 200);
    const data = await response.json();
    assert.equal(data.online, true);
    assert.equal(data.username, 'xuan.xuan20000726');
    assert.equal('accessToken' in data, false);
    assert.equal(typeof data.facebook.configured, 'boolean');
    assert.equal('facebookPageToken' in data.facebook, false);
    assert.deepEqual(Object.keys(data.jobs[0]?.channels || {}).sort(), ['facebookReel','instagramReel','instagramStory'].sort());
  } finally { child.kill('SIGTERM'); }
});
