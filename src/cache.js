/** @typedef {import('cache-manager').Cache} Cache */
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');

const distributionsLeague = 'distributions_league';
const distributionsX = 'distributions_x';
const cacheKeys = {
  [distributionsLeague]: distributionsLeague,
  [distributionsX]: distributionsX,
};

const MAX_SAFE_DATE = 8.64e15;

// Filesystem cache without TTL
const diskCache = cacheManager.caching({
  store: fsStore,
  options: {
    ttl: MAX_SAFE_DATE,
    path: 'cache/cache-manager',
    preventfill: true,
  },
});

const { get, set, del, wrap } = diskCache;

const Cache = { keys: cacheKeys, get, set, del, wrap };
module.exports = Cache;
