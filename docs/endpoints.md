# Verified HoYoLAB daily endpoints

Verified from the running `hoyo-rewards` container on culturalserver on 2026-10-22, using its configured cookie. No cookie values are recorded here.

Each base URL supports `GET /info`, `GET /home`, and `POST /sign`. All requests include `lang=en-us` and the activity ID as query parameters. Claims have no request body and require no game UID.

| Game | Base URL | Activity ID | x-rpc-signgame |
| --- | --- | --- | --- |
| Genshin Impact | `https://sg-hk4e-api.hoyolab.com/event/sol` | `e202102251931481` | `hk4e` |
| Honkai: Star Rail | `https://sg-public-api.hoyolab.com/event/luna/hkrpg/os` | `e202303301540311` | `hkrpg` |
| Honkai Impact 3rd | `https://sg-public-api.hoyolab.com/event/mani` | `e202110291205111` | `bh3` |
| Zenless Zone Zero | `https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os` | `e202406031448091` | `zzz` |

All four info endpoints returned `retcode: 0`, `is_sign: true`, and monthly totals. All four home endpoints returned `retcode: 0` and 31 rewards. All four sign endpoints returned `retcode: -5003`, confirming already claimed. A previous ZZZ claim with the updated cookie returned `retcode: 0` and succeeded. A fresh unclaimed-day success has not yet been observed for the other three direct claim endpoints.

Authentication uses the `Cookie` header. The deployment retains legacy cookies and includes `ltoken_v2` and `ltuid_v2`. Legacy cookies alone worked for Genshin but returned `-100` for ZZZ. Requests also set Origin and Referer to `https://act.hoyolab.com`, client type `5`, platform `4`, and the sign-game header above.

HTTP 200 does not establish API success. The collector accepts API return codes `0` and, for claims only, `-5003`. It rejects risk challenges and confirms `is_sign` through `/info` after a claim.

The repeatable check is `bun run verify --claim`, using the same API module as the collector. Omit `--claim` for read-only verification.

Endpoint references: [genshin.py routes](https://github.com/seriaati/genshin.py/blob/master/genshin/client/routes.py), [genshin.py request headers](https://github.com/seriaati/genshin.py/blob/master/genshin/client/components/daily.py), and [NickAwrist ZZZ check-in](https://github.com/NickAwrist/Dailycheckin_Bot/blob/main/src/games/zenless_zone_zero/checkin_zenless.ts). These are community implementations of HoYoLAB website endpoints, not a supported public developer API contract.
