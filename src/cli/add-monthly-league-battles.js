const commandLineArgs = require('command-line-args');
const { db } = require('../db');
const { dateToSqlTimestamp } = require('../util');

/** @type {{ startTimes: string[] }} */
const { startTimes } = commandLineArgs([{ name: 'startTimes', multiple: true, defaultOption: true }]);

db.transaction(async (trx) => {
  try {
    // eslint-disable-next-line no-restricted-syntax
    for (const startTime of startTimes) {
      // eslint-disable-next-line no-await-in-loop
      await db('monthly_league_battle_schedules')
        .transacting(trx)
        .insert({ start_time: dateToSqlTimestamp(startTime) });
    }

    await trx.commit();
  } catch (e) {
    await trx.rollback(e);
  }
}).finally(() => db.destroy());
