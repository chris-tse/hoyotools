import { BunRuntime } from '@effect/platform-bun';
import { Config, Cron, Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { collectRewards, reporterLayer, scheduledCollection } from './collector.ts';
import { ConfigurationError, hoyoLayer } from './daily.ts';
import { dailyCron, runSchedule } from './scheduler.ts';

const services = Layer.merge(
  hoyoLayer.pipe(Layer.provide(FetchHttpClient.layer)),
  reporterLayer,
);

const program = Effect.gen(function* () {
  if (Bun.argv.includes('--once')) return yield* collectRewards();
  const timeZone = yield* Config.String('TZ').pipe(Config.withDefault(Intl.DateTimeFormat().resolvedOptions().timeZone));
  const cron = yield* Effect.fromResult(dailyCron(timeZone)).pipe(
    Effect.mapError(() => new ConfigurationError({ message: 'Invalid timezone for daily schedule' })),
  );
  const immediate = yield* Config.Boolean('GET_REWARDS_NOW').pipe(Config.withDefault(false));
  yield* Effect.logInfo('Daily collection scheduled', { timeZone, nextRun: Cron.next(cron).toISOString() });
  yield* runSchedule(scheduledCollection, cron, immediate);
});

BunRuntime.runMain(program.pipe(Effect.provide(services)));
