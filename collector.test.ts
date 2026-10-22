import { expect, it } from '@effect/vitest';
import { Effect, Layer, Queue } from 'effect';
import { TestClock } from 'effect/testing';
import { Claim, games, HoyoError, HoyoLab } from './daily.ts';
import { CollectionEvent, collectRewards, Reporter, ReportingError, scheduledCollection } from './collector.ts';
import { dailyCron, runSchedule } from './scheduler.ts';

const successfulClaim = (game: typeof games[number]) => Effect.succeed(Claim.make({
  game: game.name, success: true, status: 'ALREADY_CLAIMED', totalSignDays: 7,
}));
function clientLayer(claim: HoyoLab['Service']['claim'] = successfulClaim) {
  return Layer.succeed(HoyoLab, HoyoLab.of({
    claim,
    info: () => Effect.die('unexpected status request'),
    rewards: () => Effect.die('unexpected rewards request'),
  }));
}

it.effect('reports all four successful games in the existing Axiom event shape', () => {
  const events: CollectionEvent[] = [];
  return collectRewards().pipe(
    Effect.provide(clientLayer()),
    Effect.provideService(Reporter, Reporter.of({ report: event => Effect.sync(() => { events.push(event); }) })),
    Effect.andThen(() => Effect.sync(() => {
      expect(events).toHaveLength(1);
      expect(events[0]?.success).toBe(true);
      expect(events[0]?.level).toBe('info');
      expect(events[0]?.results.map(result => result.game)).toEqual(games.map(game => game.name));
    })),
  );
});

it.effect('isolates a game failure and reports outcomes for every game', () => {
  const events: CollectionEvent[] = [];
  return Effect.gen(function* () {
    const error = yield* collectRewards().pipe(Effect.flip);
    expect(error._tag).toBe('CollectionFailed');
    const event = events.at(0);
    expect(event?.success).toBe(false);
    expect(event?.level).toBe('error');
    expect(event?.results).toHaveLength(4);
    expect(event?.results.filter(result => result.success)).toHaveLength(3);
    expect(event?.results.find(result => result.game === 'hsr')).toEqual({
      game: 'hsr', success: false, error: 'sign: Not logged in',
    });
  }).pipe(
    Effect.provide(clientLayer(game => game.name === 'hsr'
      ? Effect.fail(new HoyoError({ game: game.name, endpoint: 'sign', message: 'Not logged in' }))
      : successfulClaim(game))),
    Effect.provideService(Reporter, Reporter.of({ report: event => Effect.sync(() => { events.push(event); }) })),
  );
});

it.effect('propagates reporting failures to one-shot callers', () => Effect.gen(function* () {
  const error = yield* collectRewards().pipe(Effect.flip);
  expect(error._tag).toBe('ReportingError');
}).pipe(
  Effect.provide(clientLayer()),
  Effect.provideService(Reporter, Reporter.of({ report: () => Effect.fail(new ReportingError({ message: 'Axiom reporting failed' })) })),
));

it.effect('continues the daily schedule after an expected collection failure', () => Effect.gen(function* () {
  yield* TestClock.setTime(Date.parse('2026-10-22T10:59:59Z'));
  const events = yield* Queue.unbounded<CollectionEvent>();
  const cron = yield* Effect.fromResult(dailyCron('UTC'));
  const pass = scheduledCollection.pipe(
    Effect.provide(clientLayer(game => Effect.fail(new HoyoError({ game: game.name, endpoint: 'sign', message: 'Not logged in' })))),
    Effect.provideService(Reporter, Reporter.of({ report: event => Queue.offer(events, event).pipe(Effect.asVoid) })),
  );
  yield* runSchedule(pass, cron, true).pipe(Effect.forkScoped);
  expect((yield* Queue.take(events)).success).toBe(false);
  yield* TestClock.adjust('1 second');
  expect((yield* Queue.take(events)).success).toBe(false);
}));
