// This code is based on @hymm's SquidTracks (Released under the MIT License)
// https://github.com/hymm/squid-tracks/blob/ccc63e82dec32191a6d94f14d77b34b9932b5b0b/public/main/splatnet2.js
const Request = require('request-promise-native');
const config = require('../config');
const { NintendoAPIError } = require('./errors');

const splatnetUrl = 'https://app.splatoon2.nintendo.net';

const jar = Request.jar();
const request = Request.defaults({ jar });
const cookie = request.cookie(`iksm_session=${config.IKSM_SESSION}`);
jar.setCookie(cookie, splatnetUrl);

const getSplatnetApi = path => new Promise((resolve, reject) => {
  const uri = `${splatnetUrl}/api/${path}`;
  request({
    method: 'GET',
    uri,
    headers: {
      Accept: '*/*',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': config.USER_LANGUAGE,
      'User-Agent': config.NINTENDO_API_USERAGENT,
      Connection: 'keep-alive',
    },
    json: true,
    gzip: true,
  })
    .then(res => resolve(res))
    .catch((err) => {
      const nintendoApiError = new NintendoAPIError(`Request to ${uri} failed. Status code: ${err.statusCode}`);
      nintendoApiError.statusCode = err.statusCode;
      return reject(nintendoApiError);
    });
});

module.exports = { splatnetUrl, getSplatnetApi };
