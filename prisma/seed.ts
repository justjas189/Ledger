// Database seed script.
//
// Multi-tenant note (Supabase migration): every category and expense is now
// OWNED by a Supabase auth user (categories.user_id / expenses.user_id ->
// auth.users.id). There is no global sample data to seed anymore, and we can't
// invent owner-less rows — a NOT NULL user_id with a FK to auth.users would
// reject them.
//
//   • Default categories are provisioned PER USER by the `handle_new_user()`
//     trigger (see supabase/rls.sql) the instant someone signs up.
//   • Expenses are created by that user inside the app.
//
// So a fresh production database starts empty by design. This script is a
// deliberate no-op so `prisma migrate reset` / `npm run db:seed` still succeed.
//
// To get sample data locally: run the app, sign up, and add a few expenses —
// signing up hands you the starter categories automatically. (If you want a
// scripted local seed that mints a test user via the Supabase service key and
// backfills their expenses, ask — it's a separate dev-only script.)

async function main() {
  console.log(
    'Nothing to seed — categories are provisioned per-user by the ' +
      'handle_new_user() trigger on signup (see supabase/rls.sql).'
  )
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
