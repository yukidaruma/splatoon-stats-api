const pg = require('pg');
const knex = require('knex');
const config = require('../config');

pg.types.setTypeParser(20, val => (val === null ? null : parseInt(val, 10))); // int
pg.types.setTypeParser(1700, val => (val === null ? null : parseFloat(val, 10))); // numeric
console.log('connecting %s', (config.NODE_ENV === 'test' ? config.POSTGRES_TEST_URL : config.POSTGRES_URL));
const db = knex({
  client: 'pg',
  connection: config.POSTGRES_URL,
  pool: {
    afterCreate(conn, done) {
      console.log('Successfully connected to database.');
      done();
    },
  },
});

db.on('query-error', (err) => {
  throw err;
});

module.exports = { db };
