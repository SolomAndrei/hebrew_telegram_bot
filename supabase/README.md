# Supabase migrations

SQL files in `migrations/` are the source of truth for the database schema.
Do not paste them manually into the Supabase SQL Editor unless you are
recovering from a one-off incident.

## One-time setup

1. Install dependencies from the repo root (`npm install`).
2. Link this folder to your Supabase project:

```bash
npm run db:link -- --project-ref <your-project-ref>
```

`<your-project-ref>` is the id from the Supabase project URL, for example
`https://supabase.com/dashboard/project/<your-project-ref>`.

The CLI will ask for the database password (same value as `SUPABASE_PASSWORD`
in `.env` if you keep it there).

## Apply migrations

```bash
npm run db:push
```

This applies only migrations that are not yet recorded in the remote
`supabase_migrations.schema_migrations` history table.

Useful checks:

```bash
npm run db:migration:list
npx supabase db push --dry-run
```

## Important notes

- Migrations are **not** applied automatically when the Nest app starts on Render.
  Run `npm run db:push` locally (or as a separate deploy step) before shipping
  schema-dependent code.
- If you already applied SQL by hand in the dashboard, mark those migrations as
  applied with `supabase migration repair --status applied <version>` before the
  next `db:push`, so the CLI does not try to re-run them.
- New migration files must use the timestamp name format:
  `YYYYMMDDHHmmss_short_description.sql`.
