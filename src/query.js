const { db } = require('./db');

// Note that you may need to add player_names.player_name in select clause.
const joinLatestName = tableName => db.raw('latest_player_names_mv as player_names on player_names.player_id = :tableName:.player_id', { tableName });

const queryWeaponRanking = args => new Promise((resolve, reject) => {
  const {
    rankingType, weaponType, startTime, endTime, ruleId, region, splatfestId,
  } = args;

  const tableName = `${rankingType}_rankings`;
  let statements;

  if (weaponType === 'weapons') {
    statements = {
      select: `
      -- Group identical weapons (e.g. Hero Shot Replica and Splattershot)
      case
        when weapons.reskin_of is NOT NULL then weapons.reskin_of
        else :tableName:.weapon_id
      end as temp_weapon_id,
      count(:tableName:.weapon_id),
      sub_weapon_id,
      special_weapon_id`,
      groupBy: ['temp_weapon_id', 'sub_weapon_id', 'special_weapon_id'],
      orderBy: ['temp_weapon_id', 'desc'],
      columns: [
        'popular_weapons.temp_weapon_id as weapon_id',
        'sub_weapon_id',
        'special_weapon_id',
      ],
    };
  } else if (weaponType === 'mains') {
    statements = {
      select: 'main_reference as main_weapon_id, count(*)',
      groupBy: ['main_weapon_id'],
      columns: ['main_weapon_id as weapon_id'],
    };
  } else if (['specials', 'subs'].includes(weaponType)) {
    // e.g.) specials -> special_weapon_id
    const weaponTypeColumnName = `${weaponType.substring(0, weaponType.length - 1)}_weapon_id`;

    statements = {
      select: `count(weapons.${weaponTypeColumnName}), weapons.${weaponTypeColumnName}`,
      groupBy: [`weapons.${weaponTypeColumnName}`],
      orderBy: [`weapons.${weaponTypeColumnName}`, 'desc'],
      columns: [weaponTypeColumnName],
    };
  } else { // Theoretically this code is unreachable
    reject(new Error('Wrong weaponType'));
  }

  const popularWeaponsQuery = db.with(
    'popular_weapons',
    function subquery() {
      this
        .select(db.raw(statements.select, { tableName }))
        .from(tableName)
        .innerJoin('weapons', `${tableName}.weapon_id`, 'weapons.weapon_id');

      if (rankingType === 'league' && ruleId) {
        this.innerJoin('league_schedules', `${tableName}.start_time`, 'league_schedules.start_time');
      }

      this
        .where(function whereStartTime() {
          if (rankingType === 'splatfest') {
            this.where(`${tableName}.region`, region)
              .andWhere(`${tableName}.splatfest_id`, splatfestId);
          } else {
            this.where(`${tableName}.start_time`, '>=', startTime)
              .andWhere(`${tableName}.start_time`, '<=', endTime);
          }
        });

      if (rankingType !== 'splatfest' && ruleId) {
        this.andWhere(`${rankingType === 'league' ? 'league_schedules' : tableName}.rule_id`, ruleId);
      }

      this
        .groupBy(...statements.groupBy)
        .orderBy('count', 'desc');

      if (statements.orderBy) {
        this.orderBy(...statements.orderBy);
      }
    },
  );

  popularWeaponsQuery
    .select(
      ...statements.columns,
      'count',
      db.raw('rank () over (order by count desc)'),
      db.raw('100 * count / sum(count) over () as percentage'),
    )
    .from('popular_weapons')
    .then(result => resolve(result))
    .catch(err => reject(err));
});

const queryWeaponTopPlayers = () => db.raw(`
    with unique_weapon_ids as (
      select
          case
            when weapons.reskin_of is NOT NULL then weapons.reskin_of
            else weapons.weapon_id
          end as unique_weapon_id
          from weapons
          group by unique_weapon_id
    ),
    weapon_x_rule as (
      select rule_id, unique_weapon_id
        from unique_weapon_ids
        cross join (select rule_id from ranked_rules) as rule_ids
    ),
    weapon_x_rule_top_players as (
      select
          weapon_x_rule.rule_id,
          weapon_x_rule.unique_weapon_id,
          top_players.player_id,
          player_name,
          rating,
          start_time
        from weapon_x_rule
        inner join (
          select
              rule_id,
              x_rankings.player_id,
              player_name,
              start_time,
              rating,
              row_number () over
                (partition by x_rankings.rule_id, x_rankings.weapon_id order by rating desc, x_rankings.player_id asc)
                as weapon_top_players_rank,
              case
                when weapons.reskin_of is NOT NULL then weapons.reskin_of
                else weapons.weapon_id
              end as unique_weapon_id
            from x_rankings
            inner join weapons on weapons.weapon_id = x_rankings.weapon_id
            left outer join ?
        ) as top_players
        on weapon_x_rule.rule_id = top_players.rule_id and
          weapon_x_rule.unique_weapon_id = top_players.unique_weapon_id and
          weapon_top_players_rank = 1
    )
    select
        unique_weapon_id as weapon_id,
        array_agg(array[
          rule_id::varchar,
          player_id::varchar,
          player_name::varchar,
          rating::varchar,
          start_time::varchar
        ]) as top_players
      from weapon_x_rule_top_players
      group by unique_weapon_id
      order by unique_weapon_id asc`, [joinLatestName('x_rankings')]);

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
  queryWeaponTopPlayers,
  queryUnfetchedSplatfests,
};
