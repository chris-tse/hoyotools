# Hoyo Daily Claimer

Claim daily HoYoLAB web check-in rewards for Genshin Impact, Honkai: Star Rail, Honkai Impact 3rd, and Zenless Zone Zero.

## Configure authentication

Install Bun, then run `bun install --frozen-lockfile`.

Copy `.env.example` to `.env`. Set `COOKIE` to your HoYoLAB cookie string, including `ltoken_v2` and `ltuid_v2`. You can preserve existing legacy cookies in the same string. Obtain the values from your browser's DevTools under Application → Cookies after signing into HoYoLAB. Keep the cookie private.

Game UIDs are not needed. Set `AXIOM_TOKEN` to send collection results to the `hoyo-claimer` dataset.

## Run the collector

- `bun run collect` starts the daily schedule at 11:00 in the process timezone.
- `bun run collect:now` claims immediately, then keeps the daily schedule running. Docker uses this command.
- `bun run collect:once` claims once and exits. A failed claim or Axiom report gives a nonzero exit code.

All four games run each time. Already-claimed rewards count as success. Each claim is followed by a status request to confirm check-in and read the monthly total. A CAPTCHA response requires a manual HoYoLAB check-in.

## Verify endpoints

Run `bun run verify` to check authentication, check-in status, and monthly reward lists without claiming. Run `bun run verify --claim` to also POST a claim for every game and confirm the resulting status. Neither command prints cookies.

Run `bun run test` for automated tests of successful claims, already-claimed responses, authentication errors, CAPTCHA responses, malformed responses, and network failures.

See [verified endpoints](docs/endpoints.md) for routes and live verification results.

## Update Docker

Build the image with `docker build -t hoyo-rewards:latest .`. Supply `COOKIE` through the container environment or a mounted `.env` file. The image excludes `.env`.

In the existing culturalserver deployment, `/mnt/user/appdata/compose/apps/.env` stores `HOYO_COOKIE`. Compose passes it to the service as `COOKIE`. After updating that file or rebuilding the image, recreate the service:

```bash
cd /mnt/user/appdata/compose/apps
docker compose up -d --no-deps --force-recreate hoyo-rewards
```
