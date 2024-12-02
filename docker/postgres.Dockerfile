FROM postgres:13.3-alpine

# See "How to extend this image" section in https://hub.docker.com/_/postgres/
# for how this works.
# These files are exectued in ASCII order.
COPY sql/init.sql /docker-entrypoint-initdb.d/10-init.sql
COPY sql/create_tables.sql /docker-entrypoint-initdb.d/20-create_tables.sql
