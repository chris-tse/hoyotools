import { Axiom } from '@axiomhq/js';
import { Clock, Config, Context, Effect, Layer, Redacted, Schema } from 'effect';
import { Claim, games, HoyoLab } from './daily.ts';

const FailedClaim = Schema.Struct({ game: Claim.fields.game, success: Schema.Literal(false), error: Schema.String });
const CollectionEvent = Schema.Struct({
  _time: Schema.String,
  level: Schema.Literals(['info', 'error']),
  success: Schema.Boolean,
  results: Schema.Array(Schema.Union([Claim, FailedClaim])),
});
export interface CollectionEvent extends Schema.Schema.Type<typeof CollectionEvent> {}

export class ReportingError extends Schema.TaggedError<ReportingError>()('ReportingError', { message: Schema.String }) {}
export class CollectionFailed extends Schema.TaggedError<CollectionFailed>()('CollectionFailed', { message: Schema.String }) {}

export class Reporter extends Context.Service<Reporter, {
  readonly report: (event: CollectionEvent) => Effect.Effect<void, ReportingError>;
}>()('hoyotools/Reporter') {}

export const reporterLayer = Layer.effect(Reporter, Effect.gen(function* () {
  const token = yield* Config.Redacted('AXIOM_TOKEN').pipe(Config.withDefault(Redacted.make('')));
  const axiom = Redacted.value(token) ? new Axiom({ token: Redacted.value(token) }) : undefined;
  const report = Effect.fn('Reporter.report')(function* (event: CollectionEvent) {
    if (!axiom) return;
    yield* Effect.tryPromise({
      try: async () => {
        axiom.ingest('hoyo-claimer', [event]);
        await axiom.flush();
      },
      catch: () => new ReportingError({ message: 'Axiom reporting failed' }),
    });
  });
  return Reporter.of({ report });
}));

export const collectRewards = Effect.fn('Collector.collectRewards')(function* () {
  const hoyo = yield* HoyoLab;
  const reporter = yield* Reporter;
  yield* Effect.logInfo('Collecting daily rewards');
  const results = yield* Effect.forEach(games, game => hoyo.claim(game).pipe(
    Effect.match({
      onSuccess: claim => claim,
      onFailure: error => FailedClaim.make({ game: game.name, success: false, error: `${error.endpoint}: ${error.message}` }),
    }),
  ), { concurrency: 4 });
  for (const result of results) {
    yield* (result.success
      ? Effect.logInfo('Check-in confirmed', { game: result.game, status: result.status, totalSignDays: result.totalSignDays })
      : Effect.logError('Check-in failed', { game: result.game, error: result.error }));
  }
  const success = results.every(result => result.success);
  const now = yield* Clock.currentTimeMillis;
  yield* reporter.report({ _time: new Date(now).toISOString(), level: success ? 'info' : 'error', success, results });
  if (!success) return yield* new CollectionFailed({ message: 'One or more games failed to check in' });
});

export const scheduledCollection = collectRewards().pipe(
  Effect.catchTags({
    CollectionFailed: error => Effect.logError(error.message),
    ReportingError: error => Effect.logError(error.message),
  }),
);
