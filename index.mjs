import 'dotenv/config';
import { schedule } from 'node-cron';
import { Axiom } from '@axiomhq/js';
import { games, claimDailyReward } from './daily.mjs';

const cookie = process.env.COOKIE;
if (!cookie?.trim()) {
  console.error('COOKIE is required. Set it in the environment or .env.');
  process.exit(1);
}

const axiom = process.env.AXIOM_TOKEN ? new Axiom({ token: process.env.AXIOM_TOKEN }) : null;
let running = false;

async function collectRewards() {
  if (running) return;
  running = true;
  try {
    console.log(`[${new Date().toISOString()}] Collecting daily rewards`);
    const results = await Promise.all(games.map(game => claimDailyReward(game, { cookie })));
    for (const result of results) {
      console.log(result.success
        ? `[${result.game}] ${result.status}; total check-ins this month: ${result.totalSignDays}`
        : `[${result.game}] ERROR: ${result.error}`);
    }
    const success = results.every(result => result.success);
    if (axiom) {
      try {
        axiom.ingest('hoyo-claimer', [{
          _time: new Date().toISOString(),
          level: success ? 'info' : 'error',
          success,
          results,
        }]);
        await axiom.flush();
      } catch {
        console.error('Axiom reporting failed');
        return false;
      }
    }
    return success;
  } finally {
    running = false;
  }
}

if (process.argv.includes('--once')) {
  process.exitCode = await collectRewards() ? 0 : 1;
} else {
  schedule('0 11 * * *', collectRewards);
  console.log('Daily collection scheduled for 11:00 in the process timezone.');
  if (process.env.GET_REWARDS_NOW === 'true') await collectRewards();
}
