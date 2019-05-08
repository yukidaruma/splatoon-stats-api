const pg = require('pg');
const knex = require('knex');
const config = require('../config');

pg.types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10))); // int
pg.types.setTypeParser(1700, val => (val === null ? null : parseFloat(val, 10))); // numeric
pg.types.setTypeParser(1114, val => val); // timestamp
pg.types.setTypeParser(1184, val => val); // timestamptz

console.log('connecting %s', (config.NODE_ENV === 'test' ? config.POSTGRES_TEST_URL : config.POSTGRES_URL));
const db = knex({
  client: 'pg',
  connection: config.POSTGRES_URL,
  pool: {
    afterCreate(conn, done) {
      conn.query("SET TIME ZONE 'UTC'", (err) => {
        if (err) {
          console.log(err);
        } else {
          console.log('Successfully connected to database.');
        }
        done(err, conn);
      });
    },
  },
});

db.on('query-error', (err) => {
  throw err;
});

module.exports = { db };
