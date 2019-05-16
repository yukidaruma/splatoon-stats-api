const { db } = require('./db');

// Note that you need to add names.player_name in select clause.
const joinLatestName = tableName => db.raw(`
  (
    select
        -- This column is used to limit to 1 row (latest, name starting with smallest character code value will be used)
        ROW_NUMBER () OVER (partition by names.player_id order by last_used desc, player_name asc),
        *
      from player_known_names as names
  ) as names
  on :tableName:.player_id = names.player_id
  and names.last_used = (
    select MAX(last_used)
    from player_known_names as names_2
    where :tableName:.player_id = names_2.player_id
    order by names.player_name asc
  )
  and row_number = 1
  `, { tableName });

const queryWeaponRanking = (rankingType, weaponType, startTime, endTime, ruleId) => new Promise((resolve, reject) => {
  const tableName = `${rankingType}_rankings`;

  if (weaponType === 'weapons') {
    db.raw(`
      with popular_weapons as (
        select
            -- Group identical weapons (e.g. Hero Shot Replica and Splattershot)
            case
              when weapons.reskin_of is NOT NULL then weapons.reskin_of
              else :tableName:.weapon_id
            end as temp_weapon_id,
            count(:tableName:.weapon_id),
            sub_weapon_id,
            special_weapon_id
        from :tableName:
          inner join weapons on :tableName:.weapon_id = weapons.weapon_id
          ${rankingType !== 'league' ? '-- ' : ''}inner join league_schedules on :tableName:.start_time = league_schedules.start_time
          where
            (
              :ruleId = 0
              OR
              :ruleId = ${rankingType === 'league' ? 'league_schedules' : ':tableName:'}.rule_id
            )
            AND
            (
              :startTime <= :tableName:.start_time
              AND
              :tableName:.start_time < :endTime
            )
          group by temp_weapon_id, sub_weapon_id, special_weapon_id
          order by count desc, temp_weapon_id desc
      )
      select
          RANK() over (order by popular_weapons.count desc),
          count,
          popular_weapons.temp_weapon_id as weapon_id,
          sub_weapon_id,
          special_weapon_id,
          100 * count / sum(count) over () as percentage
        from popular_weapons`,
    {
      tableName, startTime, endTime, ruleId,
    })
      .then(result => resolve(result.rows))
      .catch(err => reject(err));
  } else if (weaponType === 'specials' || weaponType === 'subs') {
    // e.g.) specials -> special_weapon_id
    const weaponTypeColumnName = `${weaponType.substring(0, weaponType.length - 1)}_weapon_id`;
    db.raw(`
      with popular_weapons as (
        select
            count(weapons.:weaponTypeColumnName:),
            weapons.:weaponTypeColumnName:
          from :tableName:
            inner join weapons on :tableName:.weapon_id = weapons.weapon_id
            ${rankingType !== 'league' ? '-- ' : ''}inner join league_schedules on :tableName:.start_time = league_schedules.start_time
            WHERE
              (
                :ruleId = 0
                OR
                :ruleId = ${rankingType === 'league' ? 'league_schedules' : tableName}.rule_id
              )
              AND
              (
                :startTime <= :tableName:.start_time
                AND
                :tableName:.start_time < :endTime
              )
            group by weapons.:weaponTypeColumnName:
            order by count desc, weapons.:weaponTypeColumnName: desc
      )
      select
        rank() over (order by popular_weapons.count desc),
        :weaponTypeColumnName:,
        count,
        100 * count / sum(count) over () as percentage
      from popular_weapons`,
    {
      tableName, weaponTypeColumnName, startTime, endTime, ruleId,
    })
      .then(result => resolve(result.rows))
      .catch(err => reject(err));
  } else { // Theoretically this code is unreachable
    reject(new Error('Wrong weaponType'));
  }
});

const queryUnfetchedSplatfests = () => new Promise((resolve, reject) => db.raw(`
with past_splatfests as (
  select region, splatfest_id from splatfest_schedules
    where end_time < now()
),
fetched_splatfests as (
  select region, splatfest_id from splatfest_rankings
    group by region, splatfest_id
)
select * from past_splatfests
  except select * from fetched_splatfests`)
  .then(queryResult => resolve(queryResult.rows))
  .catch(err => reject(err)));

module.exports = {
  joinLatestName,
  queryWeaponRanking,
  queryUnfetchedSplatfests,
};
