import 'dotenv/config';
import { games, requestDaily, claimDailyReward } from './daily.mjs';

const options = { cookie: process.env.COOKIE };
let failed = false;
for (const game of games) {
  for (const endpoint of ['info', 'home']) {
    try {
      const { data } = await requestDaily(game, endpoint, options);
      console.log(JSON.stringify({
        game: game.name,
        endpoint,
        success: true,
        ...(endpoint === 'info'
          ? { isSign: data.is_sign, totalSignDays: data.total_sign_day }
          : { rewardCount: data.awards.length }),
      }));
    } catch (error) {
      failed = true;
      console.log(JSON.stringify({ game: game.name, endpoint, success: false, error: error.message }));
    }
  }
  if (process.argv.includes('--claim')) {
    const result = await claimDailyReward(game, options);
    failed ||= !result.success;
    console.log(JSON.stringify({ endpoint: 'sign', ...result }));
  }
}
process.exitCode = failed ? 1 : 0;
