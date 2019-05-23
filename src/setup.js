const fetch = require('node-fetch');
const fs = require('fs');
const config = require('../config');
const { populateDatabase } = require('./populate_database');

const uiLocalization = require('./ui-localization');

const downloadLocales = (statInkWeapons) => {
  const languages = ['ja', 'en'];
  languages.forEach(async (lang) => {
    const locale = { ja: 'ja_JP', en: 'en_US' }[lang];
    const cacheDir = 'cache/locale';

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    const cachePath = `${cacheDir}/${lang}.json`;
    if (!fs.existsSync(cachePath)) {
      const res = await fetch(`https://splatoon2.ink/data/locale/${lang}.json`,
        { headers: { 'User-Agent': config.THIRDPARTY_API_USERAGENT } });
      const localeData = await res.json();

      // Find and complete missing translations
      statInkWeapons
        .filter(weapon => !localeData.weapons[weapon.splatnet])
        .forEach((weapon) => {
          localeData.weapons[weapon.splatnet] = { name: weapon.name[locale] };
        });

      if (lang in uiLocalization) {
        Object.assign(localeData, { ui: uiLocalization[lang] });
      }

      fs.writeFileSync(cachePath, JSON.stringify(localeData));
    }
  });
};

(async function () { // eslint-disable-line func-names
  const res = await fetch('https://stat.ink/api/v2/weapon',
    { headers: { 'User-Agent': config.THIRDPARTY_API_USERAGENT } });
  const statInkWeapons = await res.json();

  downloadLocales(statInkWeapons);
  populateDatabase(statInkWeapons);
}());
