/* eslint-disable no-console */

const moment = require('moment-timezone');

const { db } = require('./db');
const { fetchLeagueRanking } = require('./cron-job');
const { dateToSqlTimestamp, wait } = require('./util');

const ongoingSplatfestCount = async time => db.raw(`
  with ongoing_splatfests as (
    select splatfest_id from splatfest_schedules
      where start_time <= to_timestamp(:time) AND to_timestamp(:time) <= end_time
  )
  select count(splatfest_id) from ongoing_splatfests`, { time: time.unix() })
  .then(result => (result.rows[0] && result.rows[0].count) || 0);

const getMissingLeagueDatesIterator = (startTime, endTime) => ({
  [Symbol.iterator]() {
    const leagueDate = startTime.clone().add({ hours: -2 });

    const iterator = {
      next() {
        leagueDate.add({ hours: 2 });

        if (leagueDate > endTime) {
          return { done: true };
        }
        return { value: leagueDate.clone(), done: false };
      },
    };
    return iterator;
  },
});

const randomBetween = (min, max) => Math.random() * (max - min + 1) + min;

/* eslint-disable no-restricted-syntax, no-await-in-loop */
(async function () { // eslint-disable-line func-names
  const gapsBetweenLeagueRankings = await db.raw(`
    with
    league_start_times as (
      select distinct(start_time)
        from league_rankings
        order by start_time asc
    ),
    league_start_times_with_next_start_time as (
      select
          start_time,
          lead(start_time) over () as next_start_time
        from league_start_times
      --  limit 1
    ),
    league_start_times_with_gap_between as (
      select
          start_time,
          next_start_time,
          (next_start_time - start_time) as gap_between
        from league_start_times_with_next_start_time
    )
    select start_time, next_start_time
      from league_start_times_with_gap_between
      where gap_between != '2 hour'::interval`)
    .then(queryResult => queryResult.rows);

  // Check gap between defaultDate and the first record of league_rankings
  const defaultDate = moment.utc({ year: 2018, month: 0 });
  const hasDefaultDateFetched = await db
    .select('start_time')
    .from('league_rankings')
    .where('start_time', '=', dateToSqlTimestamp(defaultDate))
    .then(rows => rows.length !== 0);

  if (!hasDefaultDateFetched) {
    gapsBetweenLeagueRankings.unshift({
      start_time: dateToSqlTimestamp(defaultDate.add({ hours: -2 })),
      next_start_time: gapsBetweenLeagueRankings[0].start_time,
    });
  }

  for (const gap of gapsBetweenLeagueRankings) {
    const missingLeagueDates = getMissingLeagueDatesIterator(
      moment.utc(gap.start_time).add({ hours: 2 }),
      moment.utc(gap.next_start_time).add({ ms: -1 }),
    );
    for (const leagueDate of missingLeagueDates) {
      // Global Splatfest = 3 concurrent Splatfest across regions (na, eu, jp)
      if (await ongoingSplatfestCount(leagueDate) === 3) {
        // console.log(`There were global Splatfest at ${leagueDate.format('YYYY-MM-DD HH:mm')}. Skipped fetching.`);
        continue; // eslint-disable-line no-continue
      }

      const isRankingMissing = await db
        .select('start_time')
        .from('missing_league_rankings')
        .where('start_time', dateToSqlTimestamp(leagueDate))
        .then(rows => !!rows.length);

      if (isRankingMissing) {
        // console.log(`No ranking is available for ${leagueDate.format('YYYY-MM-DD HH:mm')}. Skipped fetching.`);
        continue; // eslint-disable-line no-continue
      }

      const intervalBetweenDates = Math.floor(randomBetween(60000, 120000));

      // TODO: Use transaction here
      for (const groupType of ['T', 'P']) {
        const intervalBetweenGroupTypes = Math.floor(randomBetween(2000, 10000));
        const leagueId = leagueDate.format('YYMMDDHH') + groupType;

        try {
          await fetchLeagueRanking(leagueId);
          console.log(`Fetched ${leagueId}.`);

          if (groupType === 'T') {
            await wait(intervalBetweenGroupTypes);
          }
        } catch (err) {
          if (err.statusCode === 404) {
            // Usually this happen when Japan is in Splatfest and the rest of the world is midnight.
            // There's a case pair ranking is available while team is unavailable.
            // However, there's little to no pairs in the situation so we just skip fetching pair ranking.
            console.log(`No team ranking found for ${leagueId}. Skipped fetching pair ranking.`);
            await db('missing_league_rankings')
              .insert({ start_time: dateToSqlTimestamp(leagueDate) });
            break;
          } else {
            console.error(err);
            return;
          }
        }
      }

      await wait(intervalBetweenDates);
    }
  }
}())
/* eslint-enable no-restricted-syntax */
  .then(() => { console.log('Successfully fetched all missingle league battle rankings.'); })
  .finally(() => {
    db.destroy();
  });
