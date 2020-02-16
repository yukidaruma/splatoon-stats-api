const defaults = {
  PORT: 3000,
  POSTGRES_URL: 'postgresql://postgres:postgres@postgres/sranking',
  THIRDPARTY_API_USERAGENT: `https://github.com/yukidaruma/splatoon-stats/${process.env.npm_package_version}`,
  FRONTEND_ORIGIN: 'http://localhost:8080',
  // Cache duration for reverse proxy (shared cache). Set to 0 if unnecessary.
  GET_REQUEST_CACHE_DURATION: 86400,

  DO_NOT_FETCH_SPLATFEST: true,

  // These values are used for Splatnet 2 API.
  NINTENDO_API_USERAGENT: 'com.nintendo.znca/1.5.2 (Android/4.4.2)',
  USER_LANGUAGE: 'ja-JP',
  IKSM_SESSION: '',

  // These values are used for Twitter API (scheduled tweets).
  ENABLE_SCHEDULED_TWEETS: true,
  TWITTER_API_CONSUMER_KEY: '',
  TWITTER_API_CONSUMER_SECRET: '',
  TWITTER_API_TOKEN_KEY: '',
  TWITTER_API_TOKEN_SECRET: '',
};

Object.keys(defaults).forEach((key) => {
  if (key in process.env) {
    if (typeof defaults[key] === 'boolean') {
      switch (process.env[key]) {
        case 'true': defaults[key] = true; break;
        case 'false': defaults[key] = false; break;
        default: throw new TypeError(`Error parsing .env: Config for Boolean option ${key} must be 'true' or 'false'.`);
      }
    } else if (typeof defaults[key] === 'number') {
      defaults[key] = Number(process.env[key]);
    } else {
      // string
      defaults[key] = process.env[key];
    }
  }
});

if (!('NODE_ENV' in process.env)) {
  process.env.NODE_ENV = 'development';
} else if (process.env.NODE_ENV === 'test') {
  process.env.PORT = '';
  process.env.POSTGRES_URL = process.env.POSTGRES_TEST_URL;
}

module.exports = defaults;
