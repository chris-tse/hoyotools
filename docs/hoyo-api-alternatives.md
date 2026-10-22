# HoYoLab API alternatives

## NickAwrist comparison

[`NickAwrist/Dailycheckin_Bot`](https://github.com/NickAwrist/Dailycheckin_Bot/blob/main/src/games/zenless_zone_zero/checkin_zenless.ts) calls ZZZ directly with native `fetch`, without a HoYoLab wrapper. It sends a bodyless POST to the same `sg-act-nap-api` sign endpoint, with `lang=en-us` and `act_id=e202406031448091` in the query. It authenticates with `ltoken_v2` and `ltuid_v2`, and sets `x-rpc-signgame: zzz`, client type `5`, platform `4`, Origin, and Referer. No game UID is sent for check-in.

Two details should not be copied blindly: its manual Host header names `sg-public-api.hoyolab.com` while the URL names `sg-act-nap-api.hoyolab.com`, and it reports completion without checking the API's `retcode`. Our live unauthenticated POST returned HTTP 200 with `retcode: -100`, `message: Not logged in`, so HTTP success alone does not establish a successful claim. No authenticated attempt was possible because this checkout had no `.env` and no `COOKIE` environment variable.

Checked 2026-10-22. This is source and package research; no authenticated requests or reward claims were run.

## Closest successor

[`node-hoyolab`](https://github.com/iseizuu/node-hoyolab) explicitly describes itself as a fork of the unmaintained `vermaysha/hoyoapi`. Its README lists daily check-in and battle chronicles for Genshin Impact, Honkai Impact 3rd, Honkai: Star Rail, and Zenless Zone Zero. Its latest npm release is **2.0.2, published 2024-08-25**, so the successor exists but the published package is old. [npm registry](https://registry.npmjs.org/node-hoyolab)

The published package exports `ZenlessZoneZero`, retains the existing `HonkaiImpact`, `GenshinImpact`, `HonkaiStarRail`, and `LanguageEnum` names, and has the same `daily.claim()` response fields used here: `status` and `info.total_sign_day`. The likely migration is changing the package import/dependency and adding a `ZenlessZoneZero` instance to `apps`. This is a compatibility inference from package declarations, not a tested migration. [published declarations](https://unpkg.com/node-hoyolab@2.0.2/dist/types/client/index.d.ts), [ZZZ client](https://unpkg.com/node-hoyolab@2.0.2/dist/types/client/zzz/zzz.d.ts), [daily response](https://unpkg.com/node-hoyolab@2.0.2/dist/types/module/daily/daily.interface.d.ts)

There are reasons to inspect it before adopting it. The published ZZZ region enum maps `USA` to the same `prod_gf_jp` value as `ASIA`, while the newer fork below uses `prod_gf_us`. Its `claim()` implementation also reads `response.data.code.toString()` before returning success, which deserves checking against current HoYoLab responses. Neither observation proves current daily claims fail. [region enum](https://unpkg.com/node-hoyolab@2.0.2/dist/types/client/zzz/zzz.interface.d.ts), [claim implementation](https://unpkg.com/node-hoyolab@2.0.2/dist/cjs/module/daily/daily.js)

## Newer scoped package

[`@yeci226/hoyoapi`](https://www.npmjs.com/package/@yeci226/hoyoapi) is another candidate. The npm registry reports **1.4.0, published 2026-05-06**. Its published artifact exports `ZenlessZoneZero` and the original game clients, including `HonkaiImpact`, with the same `DailyModule`/`daily.claim()` structure. The metadata still points at the original `vermaysha/hoyoapi` repository, but a separate [yeci226/hoyoapi repository](https://github.com/yeci226/hoyoapi) exists and its [ZZZ source](https://github.com/yeci226/hoyoapi/blob/master/src/client/zzz/zzz.ts) also defines `ZenlessZoneZero` with a daily module. [registry metadata](https://registry.npmjs.org/@yeci226%2Fhoyoapi), [client exports](https://unpkg.com/@yeci226/hoyoapi@1.4.0/dist/types/client/index.d.ts), [ZZZ client](https://unpkg.com/@yeci226/hoyoapi@1.4.0/dist/types/client/zzz/zzz.d.ts), [HI3 client](https://unpkg.com/@yeci226/hoyoapi@1.4.0/dist/types/client/hi/hi.d.ts)

## Independent ZZZ API implementations

[`sglkc/hoyolab-auto-daily`](https://github.com/sglkc/hoyolab-auto-daily/blob/main/index.js) implements ZZZ daily check-in directly. Its ZZZ configuration posts to `https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os/sign?act_id=e202406031448091` and sends `x-rpc-signgame: zzz`. This is useful evidence for adding one small direct client to this daily-claim script instead of replacing its wrapper.

[`seriaati/genshin.py`](https://github.com/seriaati/genshin.py) independently implements ZZZ rewards and broader ZZZ account records in Python. Its [reward routes](https://github.com/seriaati/genshin.py/blob/master/genshin/client/routes.py) use `sg-public-api.hoyolab.com/event/luna/zzz/os` with activity ID `e202406031448091`; its [daily reward code](https://github.com/seriaati/genshin.py/blob/master/genshin/client/components/daily.py) sets the ZZZ sign-game header. Its [ZZZ chronicles implementation](https://github.com/seriaati/genshin.py/blob/master/genshin/client/components/chronicle/zzz.py) provides broader account-data support. These are community implementations of HoYoLab endpoints, not evidence of a supported public developer API contract.
