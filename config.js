const defaults = {
  PORT: 3000,
  POSTGRES_URL: 'postgresql://postgres:postgres@localhost/sranking',
  INIT_POSTGRES_HOST: 'localhost',
  THIRDPARTY_API_USERAGENT: `@Yukinkling's League Battle Stats app/${process.env.npm_package_version}`,
  // These values are used for Splatnet 2 API.
  NINTENDO_API_USERAGENT: 'com.nintendo.znca/1.5.0 (Android/4.4.2)',
  USER_LANGUAGE: 'ja-JP',
  IKSM_SESSION: '',
};

Object.keys(defaults).forEach((key) => {
  defaults[key] = (key in process.env) ? process.env[key] : defaults[key];
});

if (!('NODE_ENV' in process.env)) {
  process.env.NODE_ENV = 'development';
} else if (process.env.NODE_ENV === 'test') {
  process.env.PORT = '';
  process.env.POSTGRES_URL = process.env.POSTGRES_TEST_URL;
}

module.exports = defaults;
