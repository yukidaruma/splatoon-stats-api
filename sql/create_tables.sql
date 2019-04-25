/*
`player_id` should be UNSIGNED BIGINT but Postgres doesn't have it so we use VARCHAR(16) instead.
*/

CREATE TABLE IF NOT EXISTS league_schedules (
  start_time TIMESTAMP PRIMARY KEY,
  rule_id SMALLINT NOT NULL,
  stage_ids SMALLINT[2]
);

-- This table is unnormalized because there will be no updates.
CREATE TABLE IF NOT EXISTS league_rankings (
  start_time TIMESTAMP,
  group_type CHAR(1), -- Either T(eam) or P(air)
  group_id VARCHAR(16) NOT NULL,
  player_id VARCHAR(16) NOT NULL,
  weapon_id SMALLINT NOT NULL,
  rank SMALLINT NOT NULL, -- We need to store rank because of ambiguity between teams with same rating.
  rating numeric(5, 1) NOT NULL, -- e.g.) 1234.5
  PRIMARY KEY (start_time, group_type, group_id, player_id) -- Because it's possible for someone to appear twice on ranking as a member for different teams.
);

/*
CREATE TABLE IF NOT EXISTS x_rankings ();
CREATE TABLE IF NOT EXISTS splatfest_rankings();
*/

CREATE TABLE IF NOT EXISTS ranked_rules (
  rule_id SMALLINT PRIMARY KEY,
  rule_key VARCHAR(31)
);

CREATE TABLE IF NOT EXISTS stages (
  stage_id SMALLINT PRIMARY KEY,
  stage_key VARCHAR(31)
);

CREATE TABLE IF NOT EXISTS weapons (
  weapon_id SMALLINT PRIMARY KEY,
  weapon_key VARCHAR(31) NOT NULL,
  special_weapon_id SMALLINT NOT NULL,
  sub_weapon_id SMALLINT NOT NULL,
  main_reference SMALLINT NOT NULL,
  weapon_class_id SMALLINT NOT NULL,
  reskin_of SMALLINT
);

CREATE TABLE IF NOT EXISTS weapon_classes (
  weapon_class_id SMALLINT PRIMARY KEY,
  weapon_class_key VARCHAR(15) NOT NULL
);

CREATE TABLE IF NOT EXISTS special_weapons (
  special_weapon_id SMALLINT PRIMARY KEY,
  special_weapon_key VARCHAR(31) NOT NULL
);

CREATE TABLE IF NOT EXISTS sub_weapons (
  sub_weapon_id SMALLINT PRIMARY KEY,
  sub_weapon_key VARCHAR(31) NOT NULL
);
