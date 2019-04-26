const fetch = require('node-fetch');
const fs = require('fs');
const config = require('../config');
const { populateDatabase } = require('./populate_database');

const downloadLocales = (cb) => {
  const languages = ['ja', 'en'];
  languages.forEach(async (lang) => {
    const cacheDir = 'cache/locale';
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cachePath = `${cacheDir}/${lang}.json`;
    if (!fs.existsSync(cachePath)) {
      const res = await fetch(`https://splatoon2.ink/data/locale/${lang}.json`,
        { headers: { 'User-Agent': config.THIRDPARTY_API_USERAGENT } });
      const fileStream = fs.createWriteStream(cachePath);
      await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', (err) => {
          reject(err);
        });
        fileStream.on('finish', () => {
          resolve();
        });
      });
    }
  });
};

downloadLocales();
populateDatabase();
