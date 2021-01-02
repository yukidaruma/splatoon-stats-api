const fs = require('fs');
const { db } = require('../db');

const queries = fs
  .readFileSync('./sql/create_tables.sql', 'utf8')
  .split('\n')
  .filter((line) => !/^\\c/.test(line)) // Remove \c command
  .join('\n');

db.raw(queries)
  .then(() => console.log('Database migration is successfully completed.'))
  .catch((err) => {
    console.error(`Failed to migrate database:\n${err}`);
  })
  .finally(() => db.destroy());
