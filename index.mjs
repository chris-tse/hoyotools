import {HonkaiStarRail, GenshinImpact, LanguageEnum} from 'hoyoapi'
import 'dotenv/config'

const cookie = process.env.COOKIE
const hsr = new HonkaiStarRail({
  cookie,
  lang: LanguageEnum.ENGLISH, // optional
  uid: 600_250_848,
})
const genshin = new GenshinImpact({
  cookie,
  lang: LanguageEnum.ENGLISH,
  uid: 652_041_600
})

const apps = [{name: 'hsr', app: hsr}, {name: 'genshin', app: genshin}]

apps.forEach(async ({name, app}) => {
  try {
    console.log(`Attempting to claim ${name} reward...`)
    app.daily.claim().then(dailyClaim => {
      const {info, status} = dailyClaim

      if (status === 'OK') {
        console.log(`${name} reward claimed successfully`)
        return
      }

      console.log(status)
      console.log(`You have claimed ${info.total_sign_day} rewards this month.`)
    }).catch(() => {
      console.error(e)
    })

  } catch (e) {
    console.log(e.message)
  }

})
