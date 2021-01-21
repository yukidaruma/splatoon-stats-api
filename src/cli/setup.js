const fetch = require('node-fetch');
const fs = require('fs');
const commandLineArgs = require('command-line-args');
const config = require('../../config');
const { populateDatabase } = require('../populate_database');
const { cacheImageFromNintendoAPI } = require('../cron-job');

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
      const res = await fetch(`https://splatoon2.ink/data/locale/${lang}.json`, {
        headers: { 'User-Agent': config.THIRDPARTY_API_USERAGENT },
      });
      const localeData = await res.json();

      // Find and complete missing translations
      statInkWeapons
        .filter((weapon) => !localeData.weapons[weapon.splatnet])
        .forEach((weapon) => {
          localeData.weapons[weapon.splatnet] = { name: weapon.name[locale] };
        });

      fs.writeFileSync(cachePath, JSON.stringify(localeData));
    }
  });
};

const downloadImages = async (useSalmon) => {
  const assetClasses = {
    stages: [
      '/images/stage/8c95053b3043e163cbfaaf1ec1e5f3eb770e5e07.png', // エンガワ河川敷
      '/images/stage/5c030a505ee57c889d3e5268a4b10c1f1f37880a.png', // 海女美術大学
      '/images/stage/d9f0f6c330aaa3b975e572637b00c4c0b6b89f7d.png', // ザトウマーケット
      '/images/stage/23259c80272f45cea2d5c9e60bc0cedb6ce29e46.png', // デボン海洋博物館
      '/images/stage/0907fc7dc325836a94d385919fe01dc13848612a.png', // ホッケふ頭
      '/images/stage/1430e5ac7ae9396a126078eeab824a186b490b5a.png', // アンチョビットゲームズ
      '/images/stage/83acec875a5bb19418d7b87d5df4ba1e38ceac66.png', // フジツボスポーツクラブ
      '/images/stage/828e49a8414a4bbc0a5da3e61454ab148a9f4063.png', // ショッツル鉱山
      '/images/stage/555c356487ac3edb0088c416e8045576c6b37fcc.png', // スメーシーワールド
      '/images/stage/96fd8c0492331a30e60a217c94fd1d4c73a966cc.png', // タチウオパーキング
      '/images/stage/dcf332bdcc80f566f3ae59c1c3a29bc6312d0ba8.png', // アロワナモール
      '/images/stage/758338859615898a59e93b84f7e1ca670f75e865.png', // Ｂバスパーク
      '/images/stage/8cab733d543efc9dd561bfcc9edac52594e62522.png', // アジフライスタジアム
      '/images/stage/070d7ee287fdf3c5df02411950c2a1ce5b238746.png', // マンタマリア号
      '/images/stage/a12e4bf9f871677a5f3735d421317fbbf09e1a78.png', // モズク農園
      '/images/stage/132327c819abf2bd44d0adc0f4a21aad9cc84bb2.png', // ムツゴ楼
      '/images/stage/fc23fedca2dfbbd8707a14606d719a4004403d13.png', // コンブトラック
      '/images/stage/98a7d7a4009fae9fb7479554535425a5a604e88e.png', // ホテルニューオートロ
      '/images/stage/98baf21c0366ce6e03299e2326fe6d27a7582dce.png', // バッテラストリート
      '/images/stage/187987856bf575c4155d021cb511034931d06d24.png', // ガンガゼ野外音楽堂
      '/images/stage/65c99da154295109d6fe067005f194f681762f8c.png', // ハコフグ倉庫
      '/images/stage/e4c4800be9fff23112334b193abb0fdf36e05933.png', // モンガラキャンプ場
      '/images/stage/bc794e337900afd763f8a88359f83df5679ddf12.png', // チョウザメ造船
    ],
  };

  if (useSalmon) {
    assetClasses['salmon-boss'] = [
      [3, '/images/bundled/9b2673de42f00d4fd836bd4684741505.png'],
      [6, '/images/bundled/337dde2c83705a75263aefdc15740f1c.png'],
      [9, '/images/bundled/631ea65c8cc2d9fd04f6c7458914d030.png'],
      [12, '/images/bundled/79d75f769115befab060b27401538402.png'],
      [13, '/images/bundled/2466752cf11ef6326e2add430101bff6.png'],
      [14, '/images/bundled/862656b37d071e75ad31750c9e18ed15.png'],
      [15, '/images/bundled/367e6e1c33ab3ae2a1c857f4c75f017e.png'],
      [16, '/images/bundled/7f8e44737240e3caa52d6c4f457164d9.png'],
      [21, '/images/bundled/7ecdec1e23a3d0089b38038b0217827c.png'],
    ];
    assetClasses.weapon = [
      [-1, '/images/coop_weapons/746f7e90bc151334f0bf0d2a1f0987e311b03736.png'], // green `?`
      [-2, '/images/coop_weapons/7076c8181ab5c49d2ac91e43a2d945a46a99c17d.png'], // golden `?`
      [20000, '/images/weapon/85ac26a4ba7f6a264c3832138380f19354016da5.png'], // blaster
      [20010, '/images/weapon/4e70c142250569814e5164fd687678a4af1e82a0.png'], // brella
      [20020, '/images/weapon/6d9246d994614a666aca4f24864c69d660b395dd.png'], // charger
      [20030, '/images/weapon/7eaa5e6a2eb6a03d31b72945d4fb94b67a478ce9.png'], // slosher
    ];
  }

  const downloadArgs = Object.entries(assetClasses).flatMap(([key, assets]) => {
    return assets.map((asset) => {
      if (Array.isArray(asset)) {
        // Salmon
        const cachePath = `cache/images/${key}/${asset[0]}.png`;
        return [asset[1], cachePath];
      }

      return [asset, `cache${asset}`];
    });
  });

  // Download files sequentially
  for (let i = 0; i < downloadArgs.length; i += 1) {
    const args = downloadArgs[i];
    const [url, cachePath] = args;

    if (fs.existsSync(cachePath)) {
      console.log(`${url} already exists as ${cachePath}. Skipped downloading.`);
    } else {
      console.log(`Downloading ${url} into ${cachePath}.`);

      // eslint-disable-next-line no-await-in-loop
      await cacheImageFromNintendoAPI(...args);

      console.log('Download completed.');
    }
  }
};

(async function () {
  // eslint-disable-line func-names
  // Can't set --arg=false due to command-line-args's limitation
  // c.f. https://github.com/75lb/command-line-args/issues/71
  const options = commandLineArgs([
    {
      name: 'no-images',
      type: Boolean,
      defaultValue: false,
    },
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

  const res = await fetch('https://stat.ink/api/v2/weapon', {
    headers: { 'User-Agent': config.THIRDPARTY_API_USERAGENT },
  });
  const statInkWeapons = await res.json();

  if (!options['no-images']) {
    await downloadImages(options.salmon);
  }

  if (!options['no-locale']) {
    downloadLocales(statInkWeapons);
  }

  if (!options['no-database']) {
    populateDatabase(statInkWeapons);
  }
})();
