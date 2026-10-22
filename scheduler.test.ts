import { expect, it } from '@effect/vitest';
import { Cron, Deferred, Effect, Queue, Ref } from 'effect';
import { TestClock } from 'effect/testing';
import { dailyCron, runSchedule } from './scheduler.ts';

it.effect('waits for 11:00 without running at startup', () => Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse('2026-10-22T10:59:59Z'));
  const runs = yield* Ref.make(0);
  const cron = yield* Effect.fromResult(dailyCron('UTC'));
  yield* runSchedule(Ref.update(runs, n => n + 1), cron, false).pipe(Effect.forkScoped);
  yield* TestClock.adjust('999 millis');
  expect(yield* Ref.get(runs)).toBe(0);
  yield* TestClock.adjust('1 milli');
  expect(yield* Ref.get(runs)).toBe(1);
  yield* TestClock.adjust('1 day');
  expect(yield* Ref.get(runs)).toBe(2);
}));

it.effect('runs immediately when requested, then waits for the cron time', () => Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse('2026-10-22T10:59:59Z'));
  const runs = yield* Ref.make(0);
  const observations = yield* Queue.unbounded<number>();
  const pass = Ref.updateAndGet(runs, n => n + 1).pipe(Effect.flatMap(n => Queue.offer(observations, n)));
  const cron = yield* Effect.fromResult(dailyCron('UTC'));
  yield* runSchedule(pass, cron, true).pipe(Effect.forkScoped);
  expect(yield* Queue.take(observations)).toBe(1);
  yield* TestClock.adjust('1 second');
  expect(yield* Queue.take(observations)).toBe(2);
}));

it.effect('does not overlap a long run or replay a missed day', () => Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse('2026-10-22T10:59:59Z'));
  const runs = yield* Ref.make(0);
  const release = yield* Deferred.make<void>();
  const observations = yield* Queue.unbounded<number>();
  const pass = Effect.gen(function* () {
    const n = yield* Ref.updateAndGet(runs, n => n + 1);
    yield* Queue.offer(observations, n);
    yield* Deferred.await(release);
  });
  const cron = yield* Effect.fromResult(dailyCron('UTC'));
  yield* runSchedule(pass, cron, false).pipe(Effect.forkScoped);
  yield* TestClock.adjust('1 second');
  expect(yield* Queue.take(observations)).toBe(1);
  yield* TestClock.adjust('1 day');
  expect(yield* Ref.get(runs)).toBe(1);
  yield* Deferred.succeed(release, undefined);
  yield* TestClock.adjust('0 millis');
  expect(yield* Ref.get(runs)).toBe(1);
  yield* TestClock.adjust('1 day');
  expect(yield* Queue.take(observations)).toBe(2);
}));

for (const [now, expected] of [
  ['2026-03-07T18:00:00Z', '2026-03-08T16:00:00.000Z'],
  ['2026-10-31T18:00:00Z', '2026-11-01T17:00:00.000Z'],
]) {
  it.effect(`keeps 11:00 local time across daylight saving from ${now}`, () => Effect.gen(function* () {
    const cron = yield* Effect.fromResult(dailyCron('America/Chicago'));
    expect(Cron.next(cron, now).toISOString()).toBe(expected);
  }));
}

it.effect('rejects an invalid timezone', () => Effect.gen(function* () {
  const error = yield* Effect.fromResult(dailyCron('Invalid/Timezone')).pipe(Effect.flip);
  expect(error._tag).toBe('CronParseError');
}));
