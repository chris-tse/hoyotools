import { BunRuntime } from '@effect/platform-bun';
import { Console, Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { games, HoyoLab, hoyoLayer } from './daily.ts';
import { CollectionFailed } from './collector.ts';

const program = Effect.gen(function* () {
  const hoyo = yield* HoyoLab;
  const checks = yield* Effect.forEach(games, game => Effect.gen(function* () {
    const status = yield* hoyo.info(game).pipe(Effect.match({
      onSuccess: data => ({ game: game.name, endpoint: 'info', success: true, isSign: data.is_sign, totalSignDays: data.total_sign_day }),
      onFailure: error => ({ game: game.name, endpoint: 'info', success: false, error: error.message }),
    }));
    yield* Console.log(JSON.stringify(status));
    const rewards = yield* hoyo.rewards(game).pipe(Effect.match({
      onSuccess: data => ({ game: game.name, endpoint: 'home', success: true, rewardCount: data.length }),
      onFailure: error => ({ game: game.name, endpoint: 'home', success: false, error: error.message }),
    }));
    yield* Console.log(JSON.stringify(rewards));
    if (!Bun.argv.includes('--claim')) return status.success && rewards.success;
    const claim = yield* hoyo.claim(game).pipe(Effect.match({
      onSuccess: data => ({ endpoint: 'sign', ...data }),
      onFailure: error => ({ game: game.name, endpoint: 'sign', success: false, error: error.message }),
    }));
    yield* Console.log(JSON.stringify(claim));
    return status.success && rewards.success && claim.success;
  }));
  if (!checks.every(Boolean)) return yield* new CollectionFailed({ message: 'Endpoint verification failed' });
});

BunRuntime.runMain(program.pipe(Effect.provide(hoyoLayer.pipe(Layer.provide(FetchHttpClient.layer)))));
