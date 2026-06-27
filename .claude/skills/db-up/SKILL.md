---
name: db-up
description: Ensure the local PostgreSQL used by AgentTrace tests and the API is running and migrated. Use whenever a command needs the database, or when tests report "no tests"/connection errors (the container reaps Postgres on idle). Starts the server on /tmp/pgdata, sets DATABASE_URL, and applies migrations.
---

# db-up

The dev container reaps Postgres after idle periods, which makes the api tests
report "no tests" or Prisma throw "Can't reach database server". This skill
brings it back deterministically.

## Steps

```bash
export PGDATA=/tmp/pgdata
export DATABASE_URL="postgresql://agenttrace@localhost:5432/agenttrace?schema=public"

# Start the server if it is not already accepting connections.
pg_isready -h localhost -p 5432 -U agenttrace || \
  runuser -u ubuntu -- /usr/lib/postgresql/16/bin/pg_ctl -D "$PGDATA" \
    -l /tmp/pglog.log -o "-p 5432 -k /tmp -c listen_addresses='localhost'" -w start

# If the data dir does not exist yet, initialize it first:
#   runuser -u ubuntu -- /usr/lib/postgresql/16/bin/initdb -D "$PGDATA" -U agenttrace
#   then createdb -h localhost -p 5432 -U agenttrace agenttrace

sleep 2
pg_isready -h localhost -p 5432 -U agenttrace
pnpm prisma migrate deploy
```

## Success criteria

`pg_isready` prints "accepting connections" and `prisma migrate deploy` reports
the schema is in sync (no error). After this, `DATABASE_URL` is exported for the
current shell.
