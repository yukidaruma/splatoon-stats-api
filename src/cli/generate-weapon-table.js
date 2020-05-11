const commandLineArgs = require('command-line-args');
const fs = require('fs');
const { db } = require('../db');

/** @type {{ out: string }} */
const { out: outPath } = commandLineArgs([
  { name: 'out', type: String },
]);

(async () => {
  const groupByColumnNames = ['main_reference', 'special_weapon_id', 'sub_weapon_id'];
  const exportKeys = {
    main_reference: 'main',
    special_weapon_id: 'special',
    sub_weapon_id: 'sub',
  };

  const output = {};

  // eslint-disable-next-line no-restricted-syntax
  for await (const columName of groupByColumnNames) {
    const exportKey = exportKeys[columName];
    const rows = await db.select(columName, db.raw('array_agg(weapon_id) AS weapon_ids'))
      .from('weapons')
      .whereNull('reskin_of')
      .groupBy(columName);

    if (!(exportKey in output)) {
      output[exportKey] = {};
    }

    rows.forEach((row) => {
      const { weapon_ids: weaponIds } = row;
      weaponIds.sort((a, b) => a - b);
      output[exportKey][row[columName]] = weaponIds;
    });
  }

  const json = JSON.stringify(output);
  if (outPath) {
    fs.writeFileSync(outPath, json);
  } else {
    console.log(json);
  }

  await db.destroy();
})();
