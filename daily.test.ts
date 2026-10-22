import { expect, it } from '@effect/vitest';
import { ConfigProvider, Deferred, Effect, Fiber, Layer, Redacted } from 'effect';
import { HttpClient, HttpClientError, HttpClientRequest, HttpClientResponse } from 'effect/http';
import { TestClock } from 'effect/testing';
import { ConfigurationError, games, HoyoLab, hoyoLayer } from './daily.ts';

const game = games.find(game => game.name === 'zzz');
if (!game) throw new Error('ZZZ configuration is missing');
const cookie = 'ltoken_v2=test; ltuid_v2=test;';
const info = { retcode: 0, data: { is_sign: true, total_sign_day: 7 } };
type Handler = (request: HttpClientRequest.HttpClientRequest, url: URL, signal: AbortSignal) => Effect.Effect<Response, HttpClientError.HttpClientError>;

function testLayer(handler: Handler, env: Record<string, string> = { COOKIE: cookie }) {
  const http = HttpClient.make((request, url, signal) => handler(request, url, signal).pipe(
    Effect.map(response => HttpClientResponse.fromWeb(request, response)),
  ));
  return hoyoLayer.pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, http)),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
  );
}
const json = (value: unknown) => Effect.succeed(Response.json(value));

for (const retcode of [0, -5003]) {
  it.effect(`confirms claim ${retcode} with a status request`, () => {
    const calls: Array<{ request: HttpClientRequest.HttpClientRequest; url: URL }> = [];
    return Effect.gen(function* () {
      const client = yield* HoyoLab;
      expect(yield* client.claim(game)).toEqual({ game: 'zzz', success: true, status: retcode ? 'ALREADY_CLAIMED' : 'OK', totalSignDays: 7 });
      expect(calls.map(call => call.request.method)).toEqual(['POST', 'GET']);
      const first = calls.at(0);
      expect(first?.url.searchParams.get('act_id')).toBe(game.actId);
      expect(first?.request.body._tag).toBe('Empty');
      expect(first?.request.headers.cookie).toBe(cookie);
      expect(first?.request.headers['x-rpc-signgame']).toBe('zzz');
    }).pipe(Effect.provide(testLayer((request, url) => {
      calls.push({ request, url });
      return json(calls.length === 1 ? { retcode, data: { risk_code: 0, success: 0, is_risk: false } } : info);
    })));
  });
}

for (const [name, payload, expected] of [
  ['authentication error', { retcode: -100, message: 'Not logged in', data: null }, 'API -100: Not logged in'],
  ['CAPTCHA flag', { retcode: 0, data: { is_risk: true } }, 'verification required'],
  ['CAPTCHA code', { retcode: 0, data: { risk_code: 1 } }, 'verification required'],
  ['CAPTCHA challenge', { retcode: 0, data: { challenge: 'captcha' } }, 'verification required'],
  ['missing return code', {}, 'invalid JSON or API response'],
  ['noninteger return code', { retcode: '0' }, 'invalid JSON or API response'],
]) {
  it.effect(`rejects ${name}`, () => Effect.gen(function* () {
    const client = yield* HoyoLab;
    const error = yield* client.claim(game).pipe(Effect.flip);
    expect(error._tag).toBe('HoyoError');
    expect(error.message).toContain(expected);
  }).pipe(Effect.provide(testLayer(() => json(payload)))));
}

it.effect('rejects a successful claim if status does not confirm it', () => Effect.gen(function* () {
  const client = yield* HoyoLab;
  const error = yield* client.claim(game).pipe(Effect.flip);
  expect(error.message).toContain('not confirmed');
}).pipe(Effect.provide(testLayer((_request, url) => json(url.pathname.endsWith('/info')
  ? { retcode: 0, data: { is_sign: false, total_sign_day: 0 } }
  : { retcode: 0, data: {} })))));

for (const [name, payload] of [
  ['missing status', {}],
  ['string status', { is_sign: 'true', total_sign_day: 7 }],
  ['negative count', { is_sign: true, total_sign_day: -1 }],
]) {
  it.effect(`rejects ${name}`, () => Effect.gen(function* () {
    const client = yield* HoyoLab;
    const error = yield* client.info(game).pipe(Effect.flip);
    expect(error.message).toBe('invalid check-in status');
  }).pipe(Effect.provide(testLayer(() => json({ retcode: 0, data: payload })))));
}

it.effect('rejects HTTP errors before decoding the body', () => Effect.gen(function* () {
  const client = yield* HoyoLab;
  expect((yield* client.info(game).pipe(Effect.flip)).message).toBe('HTTP 503');
}).pipe(Effect.provide(testLayer(() => Effect.succeed(new Response('unavailable', { status: 503 }))))));

it.effect('rejects malformed JSON', () => Effect.gen(function* () {
  const client = yield* HoyoLab;
  expect((yield* client.info(game).pipe(Effect.flip)).message).toBe('invalid JSON or API response');
}).pipe(Effect.provide(testLayer(() => Effect.succeed(new Response('<html>'))))));

it.effect('validates reward lists', () => Effect.gen(function* () {
  const client = yield* HoyoLab;
  expect((yield* client.rewards(game).pipe(Effect.flip)).message).toBe('missing reward list');
}).pipe(Effect.provide(testLayer(() => json({ retcode: 0, data: {} })))));

it.effect('does not expose transport credentials in errors', () => Effect.gen(function* () {
  const client = yield* HoyoLab;
  const error = yield* client.info(game).pipe(Effect.flip);
  expect(error.message).toBe('network request failed');
  expect(JSON.stringify(error)).not.toContain(cookie);
}).pipe(Effect.provide(testLayer(request => Effect.fail(new HttpClientError.HttpClientError({
  reason: new HttpClientError.TransportError({ request, cause: new Error(cookie) }),
}))))));

const invalidEnvironments: ReadonlyArray<Record<string, string>> = [{}, { COOKIE: '' }, { COOKIE: '   ' }];
for (const env of invalidEnvironments) {
  it.effect(`rejects missing or empty COOKIE: ${JSON.stringify(env)}`, () => Effect.gen(function* () {
    const error = yield* Effect.provide(HoyoLab, testLayer(() => Effect.die('unexpected HTTP request'), env)).pipe(Effect.flip);
    expect(error).toBeInstanceOf(ConfigurationError);
    expect(error.message).toBe('COOKIE is required');
  }));
}

it.effect('redacts cookie configuration values', () => Effect.gen(function* () {
  const secret = Redacted.make(cookie);
  expect(JSON.stringify(secret)).not.toContain(cookie);
}));

it.effect('times out at 25 seconds and aborts the HTTP request', () => Effect.gen(function* () {
  const started = yield* Deferred.make<AbortSignal>();
  const layer = testLayer((_request, _url, signal) => Deferred.succeed(started, signal).pipe(Effect.andThen(Effect.never)));
  const client = yield* HoyoLab.pipe(Effect.provide(layer));
  const fiber = yield* client.info(game).pipe(Effect.flip, Effect.forkScoped);
  const signal = yield* Deferred.await(started);
  yield* TestClock.adjust('24 seconds');
  expect(signal.aborted).toBe(false);
  yield* TestClock.adjust('1 second');
  expect((yield* Fiber.join(fiber)).message).toBe('request timed out');
  expect(signal.aborted).toBe(true);
}));

it.effect('aborts an in-flight HTTP request when its fiber is interrupted', () => Effect.gen(function* () {
  const started = yield* Deferred.make<AbortSignal>();
  const client = yield* HoyoLab.pipe(Effect.provide(testLayer((_request, _url, signal) =>
    Deferred.succeed(started, signal).pipe(Effect.andThen(Effect.never)))));
  const fiber = yield* client.info(game).pipe(Effect.forkScoped);
  const signal = yield* Deferred.await(started);
  yield* Fiber.interrupt(fiber);
  expect(signal.aborted).toBe(true);
}));

it.effect('keeps the deadline active while reading the response body', () => Effect.gen(function* () {
  const started = yield* Deferred.make<AbortSignal>();
  const client = yield* HoyoLab.pipe(Effect.provide(testLayer((_request, _url, signal) =>
    Deferred.succeed(started, signal).pipe(Effect.andThen(Effect.sync(() => new Response(new ReadableStream({
      start(controller) {
        signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
      },
    }))))))));
  const fiber = yield* client.info(game).pipe(Effect.flip, Effect.forkScoped);
  const signal = yield* Deferred.await(started);
  yield* TestClock.adjust('25 seconds');
  expect((yield* Fiber.join(fiber)).message).toBe('request timed out');
  expect(signal.aborted).toBe(true);
}));
