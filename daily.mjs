export const games = [
  { name: 'genshin', base: 'https://sg-hk4e-api.hoyolab.com/event/sol', actId: 'e202102251931481', signGame: 'hk4e' },
  { name: 'hsr', base: 'https://sg-public-api.hoyolab.com/event/luna/hkrpg/os', actId: 'e202303301540311', signGame: 'hkrpg' },
  { name: 'hi3', base: 'https://sg-public-api.hoyolab.com/event/mani', actId: 'e202110291205111', signGame: 'bh3' },
  { name: 'zzz', base: 'https://sg-act-nap-api.hoyolab.com/event/luna/zzz/os', actId: 'e202406031448091', signGame: 'zzz' },
];

export async function requestDaily(game, endpoint, { cookie, fetchImpl = fetch }) {
  if (!cookie?.trim()) throw new Error('COOKIE is required');
  const url = new URL(`${game.base}/${endpoint}`);
  url.search = new URLSearchParams({ lang: 'en-us', act_id: game.actId });
  let response;
  try {
    response = await fetchImpl(url, {
      method: endpoint === 'sign' ? 'POST' : 'GET',
      headers: {
        Cookie: cookie,
        Accept: 'application/json',
        Origin: 'https://act.hoyolab.com',
        Referer: 'https://act.hoyolab.com/',
        'User-Agent': 'Mozilla/5.0',
        'x-rpc-client_type': '5',
        'x-rpc-platform': '4',
        'x-rpc-signgame': game.signGame,
      },
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    throw new Error(`${endpoint}: ${error.name === 'TimeoutError' ? 'request timed out' : 'network request failed'}`);
  }
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`);
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`${endpoint}: invalid JSON response`);
  }
  if (!result || !Number.isInteger(result.retcode)) throw new Error(`${endpoint}: missing API return code`);
  if (result.retcode !== 0 && !(endpoint === 'sign' && result.retcode === -5003)) {
    throw new Error(`${endpoint}: API ${result.retcode}: ${result.message}`);
  }
  if (result.data?.is_risk || result.data?.risk_code > 0 || result.data?.challenge) {
    throw new Error(`${endpoint}: verification required; check in manually on HoYoLAB`);
  }
  if (endpoint === 'info' && (typeof result.data?.is_sign !== 'boolean' || !Number.isInteger(result.data?.total_sign_day) || result.data.total_sign_day < 0)) {
    throw new Error('info: invalid check-in status');
  }
  if (endpoint === 'home' && !Array.isArray(result.data?.awards)) throw new Error('home: missing reward list');
  return result;
}

export async function claimDailyReward(game, options) {
  try {
    const claim = await requestDaily(game, 'sign', options);
    const { data } = await requestDaily(game, 'info', options);
    if (!data.is_sign) throw new Error('info: check-in was not confirmed after claim');
    return {
      game: game.name,
      success: true,
      status: claim.retcode === -5003 ? 'ALREADY_CLAIMED' : 'OK',
      totalSignDays: data.total_sign_day,
    };
  } catch (error) {
    return { game: game.name, success: false, error: error.message };
  }
}
