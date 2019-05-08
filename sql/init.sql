CREATE ROLE readonly PASSWORD 'readonly';
REVOKE CREATE ON SCHEMA public FROM public;
GRANT CREATE ON SCHEMA public TO sranking;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM readonly;
ALTER ROLE "readonly" WITH LOGIN;

ALTER DATABASE sranking SET timezone TO 'UTC';
SELECT pg_reload_conf();
