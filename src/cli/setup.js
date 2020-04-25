const fetch = require('node-fetch');
const fs = require('fs');
const commandLineArgs = require('command-line-args');
const config = require('../../config');
const { populateDatabase } = require('../populate_database');
const { cacheImageFromNintendoAPI } = require('../cron-job');

const uiLocalization = require('../ui-localization');

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

const fetchSalmonAssets = () => {
  const assetClasses = {
    'salmon-boss': [
      [3, '/images/bundled/9b2673de42f00d4fd836bd4684741505.png'],
      [6, '/images/bundled/337dde2c83705a75263aefdc15740f1c.png'],
      [9, '/images/bundled/631ea65c8cc2d9fd04f6c7458914d030.png'],
      [12, '/images/bundled/79d75f769115befab060b27401538402.png'],
      [13, '/images/bundled/2466752cf11ef6326e2add430101bff6.png'],
      [14, '/images/bundled/862656b37d071e75ad31750c9e18ed15.png'],
      [15, '/images/bundled/367e6e1c33ab3ae2a1c857f4c75f017e.png'],
      [16, '/images/bundled/7f8e44737240e3caa52d6c4f457164d9.png'],
      [21, '/images/bundled/7ecdec1e23a3d0089b38038b0217827c.png'],
    ],
    weapon: [
      [-1, '/images/coop_weapons/746f7e90bc151334f0bf0d2a1f0987e311b03736.png'], // green `?`
      [-2, '/images/coop_weapons/7076c8181ab5c49d2ac91e43a2d945a46a99c17d.png'], // golden `?`
      [20000, '/images/weapon/85ac26a4ba7f6a264c3832138380f19354016da5.png'], // blaster
      [20010, '/images/weapon/4e70c142250569814e5164fd687678a4af1e82a0.png'], // brella
      [20020, '/images/weapon/6d9246d994614a666aca4f24864c69d660b395dd.png'], // charger
      [20030, '/images/weapon/7eaa5e6a2eb6a03d31b72945d4fb94b67a478ce9.png'], // slosher
    ],
  };

  Object.entries(assetClasses).forEach(([key, assets]) => {
    assets.forEach((asset) => {
      const cachePath = `cache/images/${key}/${asset[0]}.png`;
      cacheImageFromNintendoAPI(asset[1], cachePath);
    });
  });
};

(async function () { // eslint-disable-line func-names
  // Can't set --arg=false due to command-line-args's limitation
  // c.f. https://github.com/75lb/command-line-args/issues/71
  const options = commandLineArgs([
    {
      name: 'no-locale',
      type: Boolean,
      defaultValue: false,
    },
    {
      name: 'no-database',
      type: Boolean,
      defaultValue: false,
    },
    {
      name: 'salmon',
      type: Boolean,
      defaultValue: false,
    },
  ]);

  const res = await fetch('https://stat.ink/api/v2/weapon',
    { headers: { 'User-Agent': config.THIRDPARTY_API_USERAGENT } });
  const statInkWeapons = await res.json();

  if (!options['no-locale']) {
    downloadLocales(statInkWeapons);
  }

  if (!options['no-database']) {
    populateDatabase(statInkWeapons);
  }

  if (options.salmon) {
    fetchSalmonAssets();
  }
}());
