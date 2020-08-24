// This code is based on @hymm's SquidTracks (Released under the MIT License)
// https://github.com/hymm/squid-tracks/blob/ccc63e82dec32191a6d94f14d77b34b9932b5b0b/public/main/splatnet2.js

const http = require('https');
const { default: fetch } = require('node-fetch');

const config = require('../config');
const { NintendoAPIError } = require('./errors');

const splatnetUrl = 'https://app.splatoon2.nintendo.net';

const Cookie = `iksm_session=${config.IKSM_SESSION}`;

const getSplatnetApi = async (path) => {
  const uri = `${splatnetUrl}/api/${path}`;

  const res = await fetch(uri, {
    agent: new http.Agent({
      keepAlive: true,
    }),
    method: 'GET',
    headers: {
      'Accept-Language': config.USER_LANGUAGE,
      'User-Agent': config.NINTENDO_API_USERAGENT,
      Cookie,
      Connection: 'keep-alive',
    },
  });

  if (res.ok) {
    return res.json();
  }

  const nintendoApiError = new NintendoAPIError(`Request to ${uri} failed. Status code: ${res.status}`);
  nintendoApiError.statusCode = res.status;
  throw nintendoApiError;
};

module.exports = { splatnetUrl, getSplatnetApi };
