import {HonkaiStarRail, GenshinImpact, LanguageEnum} from 'hoyoapi'

const cookie = 'G_AUTHUSER_H=1; _MHYUUID=1172459a-ced7-497f-817c-d61d587297cc; mi18nLang=en-us; G_ENABLED_IDPS=google; DEVICEFP_SEED_ID=9deb4da0378d144b; DEVICEFP_SEED_TIME=1691786087000; DEVICEFP=38d7ee6f94c31; ltoken=J9VE48CDHOp6l4sR4xiH81LaxVwELmx8pHB40GLK; ltuid=237933731; cookie_token=cJnk4Qb4ig5h4bQbYJHja3TZiBwME4t0Z5e8U5MQ; account_id=237933731; amp_adc4c4=DIldbfK2zy77UWihL7EY5Y.NGNlUG0yVjhLM1Z4S0dsdGdjdzBtSjlUcUZpMg==..1h7j4u2hv.1h7j4vkj0.0.4.4'
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
        console.log('Reward claimed successfully')
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
