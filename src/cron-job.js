const fs = require('fs');
const fetch = require('node-fetch');
const moment = require('moment-timezone');
const config = require('../config');
const { db } = require('./db');
const { rankedRules, findRuleId } = require('./data');
const { splatnetUrl, getSplatnetApi } = require('./splatnet');
const { wait } = require('./util');

/**
 * @desc Fallback function for cacheImageFromSplatoon2Ink.
 */
const cacheImageFromNintendoAPI = async (remotePath, cachePath) => {
  const res = await fetch(splatnetUrl + remotePath, { 'User-Agent': config.NINTENDO_API_USERAGENT });
  await new Promise((resolve, reject) => {
    // Create if there's no cache directory
    const cacheDir = cachePath.substring(0, cachePath.lastIndexOf('/'));
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

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
 * @param {Number} id ID for cached file.
 * @example
 * // Cache image from Splatoon2.ink to ./cache/images/stage/13.png
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
 * @param {Number} lastUsed unix timestamp
 */
const insertKnownNames = (playerId, playerName, lastUsed) => db.raw(`INSERT
    INTO player_known_names (player_id, player_name, last_used)
    VALUES (:playerId, :playerName, to_timestamp(:lastUsed))
    ON CONFLICT ON CONSTRAINT player_known_names_pkey
    DO UPDATE SET last_used =
      CASE
        WHEN to_timestamp(:lastUsed) > player_known_names.last_used THEN to_timestamp(:lastUsed)
        ELSE player_known_names.last_used
      END
`, { playerId, playerName, lastUsed });

/**
 * @param {Boolean} forceFetch Forces to fetch even when there's future schedules already.
 */
const fetchStageRotations = forceFetch => new Promise((resolve, reject) => {
  // TODO: You can skip running query when forceFetch is true.
  db('league_schedules').where('start_time', '>=', 'now()').then((rows) => {
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
 * // Fetch league battle ranking for 2019-01-02 04:00 ~ 06:00 (UTC)
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
        if (group.cheater) {
          return;
        }

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
      .then(queries => Promise.all(queries))
      .then(() => trx.commit())
      .catch((err) => {
        trx.rollback(err);
        reject(err);
      });
  })
    .then(() => resolve())
    .catch(err => reject(err));
});

/**
 * @param {Number} year
 * @param {Number} month 1-12
 * @example
 * // Fetch X Ranking of 2019-01
 * fetchXRanking(2019, 1)
 */
const fetchXRanking = (year, month) => new Promise((resolve, reject) => {
  let duration = 1;

  if (year === 2018 && (month === 4 || month === 5)) {
    month = 4; // eslint-disable-line no-param-reassign
    duration = 2;
  }

  const start = moment.utc({ year, month: month - 1 });
  const startTimeInDb = start.clone().add({ month: duration - 1 });
  const end = start.clone().add({ month: duration });
  const format = 'YYMM01T00';
  const rankingId = [start, end].map(time => time.format(format)).join('_');

  (async function () { // eslint-disable-line func-names
    /* eslint-disable no-restricted-syntax, no-await-in-loop */
    for (const rule of rankedRules) {
      // Assume there's always 500 players (=5 pages) on X Ranking
      for (const page of [1, 2, 3, 4, 5]) {
        console.log(`x_power_ranking/${rankingId}/${rule.key}?page=${page}`);
        const ranking = await getSplatnetApi(`x_power_ranking/${rankingId}/${rule.key}?page=${page}`);

        // Prevent updating before ranking is fully determined
        if (ranking.top_rankings.length === 1) {
          throw new Error();
        }

        const queries = ranking.top_rankings.map(player => [
          db.raw(`
            INSERT
              INTO x_rankings (start_time, rule_id, player_id, weapon_id, rank, rating)
              VALUES (to_timestamp(?), ?, ?, ?, ?, ?)
              ON CONFLICT DO NOTHING`,
          [
            startTimeInDb.unix(),
            findRuleId(rule.key),
            player.principal_id,
            player.weapon.id,
            player.rank,
            player.x_power,
          ]),
          insertKnownNames(player.principal_id, player.name, end.unix()),
        ]).flat();

        await Promise.all(queries);
        await wait(10000);
      }
    }
    /* eslint-enable no-restricted-syntax, no-await-in-loop */
  }())
    .then(() => db.raw('REFRESH MATERIALIZED VIEW CONCURRENTLY latest_player_names_mv;'))
    .then(() => resolve())
    .catch(err => reject(err));
});

/**
 * @desc Fetch all Splatfest schedules from Splatoon2.ink
 */
const fetchSplatfestSchedules = () => {
  fetch('https://splatoon2.ink/data/festivals.json',
    { 'User-Agent': config.THIRDPARTY_API_USERAGENT })
    .then(res => res.json())
    .then((regions) => {
      Object.entries(regions).forEach(([region, splatfests]) => {
        const queries = splatfests.festivals.map((splatfest) => {
          const colors = Object
            .entries(splatfest.colors)
            .filter(([key]) => key === 'alpha' || key === 'bravo')
            .sort(([key1], [key2]) => (key1 > key2 ? 1 : -1))
            .map(([key, color]) => color.css_rgb); // eslint-disable-line no-unused-vars
          const teamNames = [splatfest.names.alpha_short, splatfest.names.bravo_short];

          return db.raw(`
            INSERT
              INTO splatfest_schedules (region, splatfest_id, start_time, end_time, colors, team_names)
              VALUES (?, ?, to_timestamp(?), to_timestamp(?), ?, ?)
              ON CONFLICT (region, splatfest_id) DO NOTHING`,
          [
            region,
            splatfest.festival_id,
            splatfest.times.start,
            splatfest.times.end,
            colors,
            teamNames,
          ]);
        });

        Promise.all(queries);
      });
    });
};

/**
 * @desc Fetch Splatfest ranking
 * @param {String} region ('na', 'eu', 'jp')
 * @param {Number} splatfestId
 */
const fetchSplatfestRanking = (region, splatfestId) => {
  db.transaction((trx) => {
    fetch(`https://splatoon2.ink/data/festivals/${region}-${splatfestId}-rankings.json`,
      { 'User-Agent': config.THIRDPARTY_API_USERAGENT })
      .then(res => res.json())
      .then(_rankings => _rankings.rankings)
      .then((rankings) => {
        const queries = [];

        ['alpha', 'bravo'].forEach((key, teamId) => { // As teamId, use 0 for alpha and 1 for bravo.
          const ranking = rankings[key];
          ranking.forEach((player) => {
            if (player.cheater) {
              return;
            }

            const playerId = player.principal_id;
            queries.push(insertKnownNames(playerId, player.info.nickname, player.updated_time).transacting(trx));
            queries.push(db.raw(`
              INSERT
                INTO splatfest_rankings (region, splatfest_id, team_id, player_id, weapon_id, rank, rating)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT DO NOTHING`,
            [
              region,
              splatfestId,
              teamId,
              playerId,
              player.info.weapon.id,
              player.order,
              player.score,
            ]).transacting(trx));
          });
        });
        return queries;
      })
      .then(queries => Promise.all(queries)
        .then(() => trx.commit())
        .then(() => db.raw('REFRESH MATERIALIZED VIEW CONCURRENTLY latest_player_names_mv;'))
        .catch(err => trx.rollback(err)));
  });
};

module.exports = {
  cacheImageFromNintendoAPI,
  fetchStageRotations,
  fetchLeagueRanking,
  fetchXRanking,
  fetchSplatfestSchedules,
  fetchSplatfestRanking,
};
