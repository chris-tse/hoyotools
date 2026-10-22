# Hoyo Daily Claimer

Claim daily HoYoLAB web check-in rewards for Genshin Impact, Honkai: Star Rail, Honkai Impact 3rd, and Zenless Zone Zero.

## Configure authentication

Install Bun, then run `bun install --frozen-lockfile`. The app uses TypeScript and Effect 4.0.6. Bun loads `.env` at startup.

Copy `.env.example` to `.env`. Set `COOKIE` to your HoYoLAB cookie string, including `ltoken_v2` and `ltuid_v2`. You can preserve existing legacy cookies in the same string. Obtain the values from your browser's DevTools under Application → Cookies after signing into HoYoLAB. Keep the cookie private.

Game UIDs are not needed. Set `AXIOM_TOKEN` to send collection results to the `hoyo-claimer` dataset.

## Run the collector

- `bun run collect` starts the daily schedule at 11:00 in `TZ`, or the process timezone when `TZ` is unset.
- `bun run collect:now` claims immediately, then keeps the daily schedule running. Docker uses this command.
- `bun run collect:once` claims once and exits. A failed claim or Axiom report gives a nonzero exit code.

All four games run concurrently each time. Already-claimed rewards count as success. Each claim is followed by a status request to confirm check-in and read the monthly total. A CAPTCHA response requires a manual HoYoLAB check-in.

Effect owns the daily cron schedule, request deadlines, and shutdown. Scheduled runs do not overlap or replay check-ins missed during downtime. Expected game or Axiom failures are logged without stopping future scheduled runs. Requests have a 25-second deadline that also covers response decoding. Claims are not retried automatically.

## Verify endpoints

Run `bun run verify` to check authentication, check-in status, and monthly reward lists without claiming. Run `bun run verify --claim` to also POST a claim for every game and confirm the resulting status. Neither command prints cookies.

Run `bun run typecheck` for strict TypeScript checks. Run `bun run test` for Effect-aware tests of API failures, batch reporting, cancellation, and daily scheduling. Schedule and timeout tests use a virtual clock.

See [verified endpoints](docs/endpoints.md) for routes and live verification results.

## Update Docker

Build the image with `docker build -t hoyo-rewards:latest .`. Supply `COOKIE` through the container environment or a mounted `.env` file. The image excludes `.env`.

In the existing culturalserver deployment, `/mnt/user/appdata/compose/apps/.env` stores `HOYO_COOKIE`. Compose passes it to the service as `COOKIE`. After updating that file or rebuilding the image, recreate the service:

```bash
cd /mnt/user/appdata/compose/apps
docker compose up -d --no-deps --force-recreate hoyo-rewards
```

## Read the implementation

- `daily.ts` defines the HoYoLAB service, endpoint settings, response schemas, and scoped HTTP requests.
- `collector.ts` coordinates claims and optional Axiom reporting.
- `scheduler.ts` uses Effect cron scheduling. `index.ts` wires the layers and Bun runtime.
- `verify.ts` exercises the same HoYoLAB service as the collector.

Effect and its Bun runtime adapter are pinned to 4.0.6. The HTTP and runtime adapters have upstream unstable APIs, so upgrades should run the type check, tests, and live endpoint verifier.

The optional reference clones in `vendor/` are excluded from Git and Docker builds.
