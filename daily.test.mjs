import test from 'node:test';
import assert from 'node:assert/strict';
import { games, requestDaily, claimDailyReward } from './daily.mjs';

const game = games[3];
const cookie = 'ltoken_v2=test; ltuid_v2=test;';
const json = value => Response.json(value);
const info = { retcode: 0, data: { is_sign: true, total_sign_day: 7 } };

for (const retcode of [0, -5003]) {
  test(`claim ${retcode} is successful only after status confirms it`, async () => {
    const calls = [];
    const result = await claimDailyReward(game, { cookie, fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return json(calls.length === 1 ? { retcode, data: { risk_code: 0, success: 0, is_risk: false } } : info);
    } });
    assert.deepEqual(result, { game: 'zzz', success: true, status: retcode ? 'ALREADY_CLAIMED' : 'OK', totalSignDays: 7 });
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.body, undefined);
    assert.equal(calls[0].options.headers.Cookie, cookie);
    assert.equal(calls[0].options.headers['x-rpc-signgame'], 'zzz');
    assert.equal(calls[0].url.searchParams.get('act_id'), game.actId);
    assert.equal(calls[1].url.pathname.endsWith('/info'), true);
    assert.equal(calls[1].options.method, 'GET');
  });
}

test('HTTP 200 with authentication error fails without querying status', async () => {
  let calls = 0;
  const result = await claimDailyReward(game, { cookie, fetchImpl: async () => {
    calls++;
    return json({ retcode: -100, message: 'Not logged in', data: null });
  } });
  assert.equal(result.success, false);
  assert.match(result.error, /API -100: Not logged in/);
  assert.equal(calls, 1);
});

for (const data of [{ is_risk: true }, { risk_code: 1 }, { challenge: 'captcha' }]) {
  test(`CAPTCHA response fails: ${JSON.stringify(data)}`, async () => {
    const result = await claimDailyReward(game, { cookie, fetchImpl: async () => json({ retcode: 0, data }) });
    assert.equal(result.success, false);
    assert.match(result.error, /verification required/);
  });
}

test('unconfirmed status fails even when claim reports success', async () => {
  const result = await claimDailyReward(game, { cookie, fetchImpl: async url => json(url.pathname.endsWith('/info')
    ? { retcode: 0, data: { is_sign: false, total_sign_day: 0 } }
    : { retcode: 0, data: {} }) });
  assert.equal(result.success, false);
  assert.match(result.error, /not confirmed/);
});

for (const [name, response, expected] of [
  ['HTTP error', () => new Response('unavailable', { status: 503 }), /HTTP 503/],
  ['invalid JSON', () => new Response('<html>'), /invalid JSON/],
  ['missing retcode', () => json({}), /missing API return code/],
  ['invalid status', () => json({ retcode: 0, data: {} }), /invalid check-in status/],
]) {
  test(name, async () => {
    await assert.rejects(requestDaily(game, 'info', { cookie, fetchImpl: async () => response() }), expected);
  });
}

test('missing cookie fails before a network call', async () => {
  await assert.rejects(requestDaily(game, 'sign', { cookie: '', fetchImpl: () => assert.fail('unexpected request') }), /COOKIE is required/);
});

test('network failures do not expose request credentials', async () => {
  const result = await claimDailyReward(game, { cookie, fetchImpl: async () => { throw new Error(cookie); } });
  assert.equal(result.success, false);
  assert.equal(result.error, 'sign: network request failed');
});

test('timeout is reported', async () => {
  await assert.rejects(requestDaily(game, 'info', { cookie, fetchImpl: async () => { throw new DOMException('expired', 'TimeoutError'); } }), /request timed out/);
});
