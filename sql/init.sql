CREATE ROLE readonly PASSWORD 'readonly';
REVOKE CREATE ON SCHEMA public FROM public;

GRANT CREATE ON SCHEMA public TO postgres;
ALTER DATABASE sranking SET timezone TO 'UTC';

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM readonly;
ALTER ROLE "readonly" WITH LOGIN;

SELECT pg_reload_conf();
