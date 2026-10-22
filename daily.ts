import { Config, Context, Effect, Layer, Redacted, Schema } from 'effect';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http';

const GameName = Schema.Literals(['genshin', 'hsr', 'hi3', 'zzz']);
const Game = Schema.Struct({
  name: GameName,
  base: Schema.String,
  actId: Schema.String,
  signGame: Schema.String,
});
export interface Game extends Schema.Schema.Type<typeof Game> {}

export const games: ReadonlyArray<Game> = [
  { name: 'genshin', base: 'https://sg-hk4e-api.hoyolab.com/event/sol', actId: 'e202102251931481', signGame: 'hk4e' },
  { name: 'hsr', base: 'https://sg-public-api.hoyolab.com/event/luna/hkrpg/os', actId: 'e202303301540311', signGame: 'hkrpg' },
  { name: 'hi3', base: 'https://sg-public-api.hoyolab.com/event/mani', actId: 'e202110291205111', signGame: 'bh3' },
  { name: 'zzz', base: 'https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os', actId: 'e202406031448091', signGame: 'zzz' },
];

const Endpoint = Schema.Literals(['sign', 'info', 'home']);
type Endpoint = typeof Endpoint.Type;

export class HoyoError extends Schema.TaggedError<HoyoError>()('HoyoError', {
  game: GameName,
  endpoint: Endpoint,
  message: Schema.String,
}) {}

export class ConfigurationError extends Schema.TaggedError<ConfigurationError>()('ConfigurationError', {
  message: Schema.String,
}) {}

const Envelope = Schema.Struct({
  retcode: Schema.Int,
  message: Schema.optionalKey(Schema.String),
  data: Schema.optionalKey(Schema.Unknown),
});
const Risk = Schema.NullOr(Schema.Struct({
  is_risk: Schema.optionalKey(Schema.Boolean),
  risk_code: Schema.optionalKey(Schema.Int),
  challenge: Schema.optionalKey(Schema.String),
}));
const Status = Schema.Struct({ is_sign: Schema.Boolean, total_sign_day: Schema.Natural });
export interface Status extends Schema.Schema.Type<typeof Status> {}
const Rewards = Schema.Struct({ awards: Schema.Array(Schema.Unknown) });

export const Claim = Schema.Struct({
  game: GameName,
  success: Schema.Literal(true),
  status: Schema.Literals(['OK', 'ALREADY_CLAIMED']),
  totalSignDays: Schema.Natural,
});
export interface Claim extends Schema.Schema.Type<typeof Claim> {}

export class HoyoLab extends Context.Service<HoyoLab, {
  readonly info: (game: Game) => Effect.Effect<Status, HoyoError>;
  readonly rewards: (game: Game) => Effect.Effect<ReadonlyArray<unknown>, HoyoError>;
  readonly claim: (game: Game) => Effect.Effect<Claim, HoyoError>;
}>()('hoyotools/HoyoLab') {}

export const hoyoLayer = Layer.effect(HoyoLab, Effect.gen(function* () {
  const cookie = yield* Config.Redacted('COOKIE').pipe(
    Effect.mapError(() => new ConfigurationError({ message: 'COOKIE is required' })),
  );
  if (!Redacted.value(cookie).trim()) return yield* new ConfigurationError({ message: 'COOKIE is required' });
  const http = HttpClient.withScope(yield* HttpClient.HttpClient);

  const request = Effect.fn('HoyoLab.request')(function* (game: Game, endpoint: Endpoint) {
    const error = (message: string) => new HoyoError({ game: game.name, endpoint, message });
    const req = HttpClientRequest.make(endpoint === 'sign' ? 'POST' : 'GET')(`${game.base}/${endpoint}`, {
      urlParams: { lang: 'en-us', act_id: game.actId },
      headers: {
        Cookie: Redacted.value(cookie),
        Accept: 'application/json',
        Origin: 'https://act.hoyolab.com',
        Referer: 'https://act.hoyolab.com/',
        'User-Agent': 'Mozilla/5.0',
        'x-rpc-client_type': '5',
        'x-rpc-platform': '4',
        'x-rpc-signgame': game.signGame,
      },
    });
    const response = yield* http.execute(req).pipe(
      Effect.mapError(() => error('network request failed')),
    );
    if (response.status < 200 || response.status >= 300) return yield* error(`HTTP ${response.status}`);
    const result = yield* HttpClientResponse.schemaBodyJson(Envelope)(response).pipe(
      Effect.mapError(() => error('invalid JSON or API response')),
    );
    if (result.retcode !== 0 && !(endpoint === 'sign' && result.retcode === -5003)) {
      return yield* error(`API ${result.retcode}: ${result.message ?? 'request rejected'}`);
    }
    const risk = yield* Schema.decodeUnknownEffect(Risk)(result.data ?? null).pipe(
      Effect.mapError(() => error('invalid risk response')),
    );
    if (risk?.is_risk || (risk?.risk_code ?? 0) > 0 || risk?.challenge) {
      return yield* error('verification required; check in manually on HoYoLAB');
    }
    return result;
  }, (effect, game, endpoint) => effect.pipe(
    Effect.scoped,
    Effect.timeoutOrElse({
      duration: '25 seconds',
      orElse: () => Effect.fail(new HoyoError({ game: game.name, endpoint, message: 'request timed out' })),
    }),
  ));

  const info = Effect.fn('HoyoLab.info')(function* (game: Game) {
    const result = yield* request(game, 'info');
    return yield* Schema.decodeUnknownEffect(Status)(result.data).pipe(
      Effect.mapError(() => new HoyoError({ game: game.name, endpoint: 'info', message: 'invalid check-in status' })),
    );
  });
  const rewards = Effect.fn('HoyoLab.rewards')(function* (game: Game) {
    const result = yield* request(game, 'home');
    const data = yield* Schema.decodeUnknownEffect(Rewards)(result.data).pipe(
      Effect.mapError(() => new HoyoError({ game: game.name, endpoint: 'home', message: 'missing reward list' })),
    );
    return data.awards;
  });
  const claim = Effect.fn('HoyoLab.claim')(function* (game: Game): Effect.fn.Return<Claim, HoyoError> {
    const result = yield* request(game, 'sign');
    const status = yield* info(game);
    if (!status.is_sign) return yield* new HoyoError({ game: game.name, endpoint: 'info', message: 'check-in was not confirmed after claim' });
    return { game: game.name, success: true, status: result.retcode === -5003 ? 'ALREADY_CLAIMED' : 'OK', totalSignDays: status.total_sign_day };
  });
  return HoyoLab.of({ info, rewards, claim });
}));
