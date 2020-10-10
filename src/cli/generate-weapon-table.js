const commandLineArgs = require('command-line-args');
const fs = require('fs');
const { db } = require('../db');

/** @type {{ out: string }} */
const { stdout } = commandLineArgs([
  { name: 'stdout', type: Boolean },
]);
const outPath = stdout ? null : 'cache/weapon-table.json';

(async () => {
  const groupByColumnNames = ['main_reference', 'special_weapon_id', 'sub_weapon_id'];
  const exportKeys = {
    main_reference: 'mains',
    special_weapon_id: 'specials',
    sub_weapon_id: 'subs',
  };

  const output = {
    reskins: {},
  };

  const { rows: reskins } = await db.raw(`
  SELECT reskin_of, array_agg(weapon_id) AS weapon_ids
  FROM weapons
  WHERE reskin_of IS NOT NULL
  GROUP BY reskin_of
  `);
  reskins.forEach((row) => {
    output.reskins[row.reskin_of] = row.weapon_ids;
  });

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
