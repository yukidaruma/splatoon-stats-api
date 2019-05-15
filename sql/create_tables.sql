/*
`player_id` should be UNSIGNED BIGINT but Postgres doesn't have it so we use VARCHAR(16) instead.
*/

CREATE TABLE IF NOT EXISTS league_schedules (
  start_time TIMESTAMP PRIMARY KEY,
  rule_id SMALLINT NOT NULL,
  stage_ids SMALLINT[2]
);

CREATE TABLE IF NOT EXISTS splatfest_schedules (
  region CHAR(2),
  splatfest_id INT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  colors VARCHAR(20)[2], -- rgb(100%,100%,100%) is 19 characters
  team_names VARCHAR(32)[2],
  PRIMARY KEY(region, splatfest_id) -- Global splatfest shares splatfest_id with other regions
);

-- These tables (league_rankings, x_rankings, splatfest_rankings) are unnormalized because there will be no updates.
CREATE TABLE IF NOT EXISTS league_rankings (
  start_time TIMESTAMP,
  group_type CHAR(1), -- Either T(eam) or P(air)
  group_id VARCHAR(16) NOT NULL,
  player_id VARCHAR(16) NOT NULL,
  weapon_id SMALLINT NOT NULL,
  rank SMALLINT NOT NULL, -- We need to store rank because of ambiguity between teams with same rating.
  rating numeric(5, 1) NOT NULL, -- e.g.) 1234.5
  -- We need group_id as a PK too, because it's possible for someone to appear twice on ranking as a member for different teams.
  PRIMARY KEY (start_time, group_id, player_id)
);
CREATE INDEX IF NOT EXISTS league_rankings_group_type_idx ON league_rankings (group_type);

CREATE TABLE IF NOT EXISTS x_rankings (
  start_time TIMESTAMP, -- DATE is enough, however, for future upgrade possibility, we use TIMESTAMP.
  rule_id SMALLINT NOT NULL,
  player_id VARCHAR(16) NOT NULL,
  weapon_id SMALLINT NOT NULL,
  rank SMALLINT NOT NULL,
  rating numeric(5, 1) NOT NULL,
  PRIMARY KEY (start_time, rule_id, player_id)
);

CREATE TABLE IF NOT EXISTS splatfest_rankings (
  region CHAR(2),
  splatfest_id INT,
  team_id SMALLINT, -- 0 for alpha, 1 for beta
  player_id VARCHAR(16),
  weapon_id SMALLINT NOT NULL,
  rank SMALLINT NOT NULL,
  rating numeric(5, 1) NOT NULL,
  PRIMARY KEY (region, splatfest_id, team_id, player_id)
);

CREATE TABLE IF NOT EXISTS player_known_names (
  player_id VARCHAR(16) NOT NULL,
  player_name VARCHAR(10) NOT NULL,
  last_used TIMESTAMP NOT NULL,
  PRIMARY KEY (player_id, player_name)
);

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
