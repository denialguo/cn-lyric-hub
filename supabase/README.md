# Database

## Applying migrations

There is no local Supabase CLI set up for this project, so migrations are
applied by pasting them into **Supabase → SQL Editor** and running them.

Apply `migrations/20260831000000_tighten_rls.sql` first — it closes two
vulnerabilities that are live in production. Then verify:

```
node scripts/verify-rls.cjs
```

That script probes the REST API the way an attacker would (public anon key,
plus a throwaway anonymous session) and asserts that each policy behaves as
intended. It is non-destructive and cleans up after itself.

## Why policies live here

Previously every policy existed only as dashboard state: untracked,
unreviewable, and impossible to restore. Keeping them as SQL means they can be
diffed, code-reviewed, and re-applied to a fresh project.
