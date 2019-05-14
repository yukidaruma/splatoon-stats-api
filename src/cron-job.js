const fs = require('fs');
const fetch = require('node-fetch');
const flat = require('array.prototype.flat');
const moment = require('moment-timezone');
const config = require('../config');
const { db } = require('./db');
const { dateToSqlTimestamp } = require('./util');
const { rankedRules, findRuleId } = require('./data');
const { splatnetUrl, getSplatnetApi } = require('./splatnet');

/**
 * @desc Fallback function for cacheImageFromSplatoon2Ink.
 */
const cacheImageFromNintendoAPI = async (remotePath, cachePath) => {
  const res = await fetch(splatnetUrl + remotePath, { 'User-Agent': config.NINTENDO_API_USERAGENT });
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(cachePath);
    res.body.pipe(fileStream);
    res.body.on('error', (err) => {
      reject(err);
    });
    fileStream.on('finish', () => {
      resolve();
    });
  });
};

/**
 * @param {String} remotePath Remote path for the image file.
 * @param {Number} id  ID for cached file.
 * @example
 * // Caches from splatoon2.ink to ./cache/images/stage/13.png
 * cacheImageFromSplatoon2Ink('/images/stage/d9f0f6c330aaa3b975e572637b00c4c0b6b89f7d.png', 13)
 */
const cacheImageFromSplatoon2Ink = async (remotePath, id) => {
  // Replace filename with id.
  // eslint-disable-next-line prefer-template
  const cachePath = 'cache'
    + remotePath.replace(/\/[\da-f]+\.([a-zA-Z]+)$/, (match, ext) => `/${id}.${ext}`);
  const cacheDir = cachePath.substring(0, cachePath.lastIndexOf('/'));

  // If cache already exists
  if (fs.existsSync(cachePath)) {
    return;
  }

  // Create if there's no cache directory
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const url = `https://splatoon2.ink/assets/splatnet${remotePath}`;

  // console.log(`Caching ${url} to ${cachePath}`);

  const res = await fetch(url, { 'User-Agent': config.THIRDPARTY_API_USERAGENT });

  if (res.status === 404) {
    cacheImageFromNintendoAPI(remotePath, cachePath);
  } else {
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(cachePath);
      res.body.pipe(fileStream);
      res.body.on('error', (err) => {
        reject(err);
      });
      fileStream.on('finish', () => {
        resolve();
      });
    });
  }
};

/**
 * @param {String} playerId
 * @param {String} playerName
 * @param {String} lastUsed
 */
const insertKnownNames = (playerId, playerName, lastUsed) => db.raw(`INSERT
    INTO player_known_names (player_id, player_name, last_used)
    VALUES (:playerId, :playerName, to_timestamp(:lastUsed))
    ON CONFLICT (player_id, player_name)
    DO UPDATE SET player_name = :playerName, last_used = to_timestamp(:lastUsed)`,
{ playerId, playerName, lastUsed });

/**
 * @param {Boolean} forceFetch Forces to fetch even when there's future schedules already.
 */
const fetchStageRotations = forceFetch => new Promise((resolve, reject) => {
  // TODO: You can skip running query when forceFetch is true.
  db('league_schedules').where('start_time', '>=', dateToSqlTimestamp(new Date())).then((rows) => {
    if (forceFetch || rows.length < 6) { // When there's less than 6 future schedules
      fetch('https://splatoon2.ink/data/schedules.json',
        { headers: { 'User-Agent': config.THIRDPARTY_API_USERAGENT } })
        .then(res => res.json())
        .then((schedule) => {
          const queries = schedule.league.map((league) => {
            const stageIds = [league.stage_a.id, league.stage_b.id];

            // Cache stage image if not exists
            ['stage_a', 'stage_b'].forEach((key) => {
              const stage = league[key];
              cacheImageFromSplatoon2Ink(stage.image, stage.id);
            });

            return db.raw(`
              INSERT
                INTO league_schedules (start_time, rule_id, stage_ids)
                VALUES (to_timestamp(?), ?, ?)
                ON CONFLICT (start_time) DO NOTHING`,
            [
              league.start_time,
              findRuleId(league.rule.key),
              stageIds,
            ]);
          });

          Promise.all(queries)
            .then(() => resolve())
            .catch(err => reject(err));
        });
    } else {
      console.log(`There are ${rows.length} future schedule(s). Skipped fetching.`);
      resolve();
    }
  });
});

/**
 * @param {String} leagueId
 * @example
 * // Fetches league battle ranking for 2019-01-02 04:00 ~ 06:00 (UTC)
 * fetchLeagueRanking('19010204T')
 */
const fetchLeagueRanking = leagueId => new Promise((resolve, reject) => {
  /*
    ranking.league_id '19021912T'
    ranking.league_type ('team' or 'pair')
    ranking.start_time
    ranking.rankings[].tag_members[].weapon.id
    ranking.rankings[].tag_members[].principal_id
    ranking.rankings[].tag_id
    ranking.rankings[].rank
    ranking.rankings[].point
  */

  db.transaction((trx) => {
    // ALL = global ranking
    getSplatnetApi(`league_match_ranking/${leagueId}/ALL`).then((ranking) => {
      const queries = [];

      ranking.rankings.forEach((group) => {
        const groupType = {
          team: 'T',
          pair: 'P',
        }[ranking.league_type.key];

        // Cache Weapon images (as well as Sub and Special images).
        group.tag_members.forEach((member) => {
          const imagesToBeCached = [
            [member.weapon.image, member.weapon.id],
            [member.weapon.special.image_a, member.weapon.special.id],
            [member.weapon.sub.image_a, member.weapon.sub.id],
          ];
          imagesToBeCached.forEach(imageToBeCached => cacheImageFromSplatoon2Ink(...imageToBeCached));
        });

        queries.push(...group.tag_members.map(member => db.raw(`
          INSERT
            INTO league_rankings (start_time, group_type, group_id, player_id, weapon_id, rank, rating)
            VALUES (to_timestamp(?), ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING`,
        [
          ranking.start_time,
          groupType,
          group.tag_id,
          member.principal_id,
          member.weapon.id,
          group.rank,
          group.point,
        ]).transacting(trx)));
      });

      return queries;
    })
      .then((queries) => {
        Promise.all(queries)
          .then(() => trx.commit())
          .catch((err) => {
            trx.rollback();
            reject(err);
          });
      })
      .catch(err => reject(err));
  })
    .then(() => resolve())
    .catch(err => reject(err));
});

/**
 * @param {Number} year
 * @param {Number} month 1-12
 * @example
 * // Fetches X Ranking of 2019-01
 * fetchXRanking(2019, 1)
 */
const fetchXRanking = (year, month) => new Promise((resolve, reject) => {
  let rankingId;

  if (year === 2018 && (month === 4 || month === 5)) {
    rankingId = '180401T00_180601T00';
  } else {
    const format = 'YYMM01T00';
    const start = moment({ year, month: month - 1 }).format(format);
    const end = moment({ year, month }).format(format);

    rankingId = `${start}_${end}`;
  }

  const sleep = async millis => new Promise(_resolve => setTimeout(_resolve, millis));

  (async function () { // eslint-disable-line func-names
    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const rule of rankedRules) {
      // Assume there's always 500 players (=5 pages) on X Ranking
      for (const page of [1, 2, 3, 4, 5]) {
        console.log(`x_power_ranking/${rankingId}/${rule.key}?page=${page}`);
        const ranking = await getSplatnetApi(`x_power_ranking/${rankingId}/${rule.key}?page=${page}`);
        const endTime = moment.unix(ranking.start_time).add({ month: 1 }).unix();
        const queries = flat(ranking.top_rankings.map(player => [
          db.raw(`
            INSERT
              INTO x_rankings (start_time, rule_id, player_id, weapon_id, rank, rating)
              VALUES (to_timestamp(?), ?, ?, ?, ?, ?)
              ON CONFLICT DO NOTHING`,
          [
            ranking.start_time,
            findRuleId(rule.key),
            player.principal_id,
            player.weapon.id,
            player.rank,
            player.x_power,
          ]),
          insertKnownNames(player.principal_id, player.name, endTime),
        ]));

        await Promise.all(queries);
        await sleep(10000);
      }
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */
  }())
    .then(() => resolve())
    .catch(err => reject(err));
});

module.exports = { fetchStageRotations, fetchLeagueRanking, fetchXRanking };
