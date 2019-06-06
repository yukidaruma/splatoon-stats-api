/* eslint-disable no-console */

const moment = require('moment-timezone');

const { db } = require('./db');
const { fetchXRanking } = require('./cron-job');
const { dateToSqlTimestamp, wait, randomBetween } = require('./util');

/* eslint-disable no-restricted-syntax, no-await-in-loop */
(async function () { // eslint-disable-line func-names
  const starting = moment.utc({ year: 2018, month: 4 });
  const ending = moment.utc().add({ month: -1 }).endOf('month');
  const time = starting.clone().add({ month: -1 });

  // Unlike in fetch-league-rankings.js, this script run a query on every iteration, which is inefficient.
  while (time.add({ month: 1 }) < ending) {
    const year = time.year();
    const month = time.month() + 1;

    const xRankingExists = await db
      .select('start_time')
      .from('x_rankings')
      .where('start_time', dateToSqlTimestamp(time))
      .then(rows => !!rows.length);

    if (xRankingExists) {
      continue; // eslint-disable-line no-continue
    }

    const intervalBetweenMonth = Math.floor(randomBetween(60000, 120000));

    try {
      console.log(`Start fetching X Ranking for ${year}-${month}.`);
      await fetchXRanking(year, month);
      console.log(`Fetched ${year}-${month}.`);
    } catch (err) {
      if (err.statusCode === 404) {
        console.log(`No X ranking found for ${year}-${month}. Stopped fetching.`);
        return;
      }
      console.error(err);
      return;
    }

    await wait(intervalBetweenMonth);
  }
}())
/* eslint-enable no-restricted-syntax */
  .then(() => { console.log('Successfully fetched all missingle X Ranked rankings.'); })
  .finally(() => {
    db.destroy();
  });
