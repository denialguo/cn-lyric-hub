const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fetchRows } = require('./build-fetch.cjs');

test('build reads recover from a gateway timeout, bound retries, and reject permanent/bad responses', async () => {
  let calls = 0;
  const waits = [];
  const options = {
    wait: async ms => waits.push(ms),
    fetchImpl: async () => ++calls === 1 ? new Response('Gateway Timeout', { status: 504 }) : Response.json([{ id: 1 }]),
  };
  assert.deepEqual(await fetchRows('https://example.test', {}, options), [{ id: 1 }]);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [1000]);
  calls = 0;
  options.fetchImpl = async () => { calls++; return new Response('', { status: 503 }); };
  await assert.rejects(fetchRows('https://example.test', {}, options), /503/);
  assert.equal(calls, 3);
  calls = 0;
  options.fetchImpl = async () => { calls++; return new Response('', { status: 401 }); };
  await assert.rejects(fetchRows('https://example.test', {}, options), /401/);
  assert.equal(calls, 1);
  options.fetchImpl = async () => Response.json({ message: 'error' });
  await assert.rejects(fetchRows('https://example.test', {}, options), /not an array/);
});
