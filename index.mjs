import {HonkaiStarRail, GenshinImpact, HonkaiImpact, LanguageEnum} from 'hoyoapi'
import 'dotenv/config'
import {schedule} from "node-cron";

const cookie = process.env.COOKIE
const hsr = new HonkaiStarRail({
  cookie,
  lang: LanguageEnum.ENGLISH, // optional
  uid: process.env.HSR_UID,
})
const genshin = new GenshinImpact({
  cookie,
  lang: LanguageEnum.ENGLISH,
  uid: process.env.GENSHIN_UID
})
const hi3 = new HonkaiImpact({
  cookie,
  lang: LanguageEnum.ENGLISH,
  uid: process.env.HI3_UID
})

const apps = [{name: 'hsr', app: hsr}, {name: 'genshin', app: genshin}, {name: 'hi3', app: hi3}]

function formatTimestamp () {
  const now = new Date()
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$1/$2')
}

async function getDailyRewards() {
  console.log(`\n[${formatTimestamp()}] 🎯 Starting daily rewards collection...\n`)

  await Promise.all(apps.map(async ({name, app}) => {
    const prefix = `[${name}]`.padEnd(10)

    console.log(`${prefix} ⏳ Attempting to claim reward...`)
    try {
      const dailyClaim = await app.daily.claim()
      const {info, status} = dailyClaim

      if (status === 'OK') {
        console.log(`${prefix} ✅ Successfully claimed reward`)
        console.log(`${prefix} 📊 Total rewards this month: ${info.total_sign_day}`)
      } else {
        console.log(`${prefix} ⚠️  Claim status: ${status}`)
      }
    } catch (e) {
      console.log(`${prefix} ❌ Error: ${e.message}`)
    }
    console.log('') // Add spacing between apps
  }))

  console.log(`[${formatTimestamp()}] ✨ Daily rewards collection completed\n`)
}


if (process.env.GET_REWARDS_NOW === 'true') {
    void getDailyRewards()
}

schedule('0 11 * * *', getDailyRewards)

