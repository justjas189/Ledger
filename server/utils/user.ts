// requireUser — the single tenant gate for server routes.
//
// This @nuxtjs/supabase version's serverSupabaseUser() returns the VERIFIED JWT
// *claims* (via supabase.auth.getClaims()), NOT a Supabase User object — so the
// user id is the `sub` claim, not `.id`. We normalise to `{ id }` here so every
// route keeps using `user.id`.
//
// This is also what enforces tenant isolation: Prisma connects as the DB owner
// and BYPASSES RLS, so the policies in supabase/rls.sql are only a second wall.
// A missing/wrong id would silently WIDEN queries — Prisma ignores an
// `undefined` filter in findMany/aggregate, returning every user's rows — so we
// fail closed whenever there's no `sub`.
import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

export async function requireUser(event: H3Event) {
  // getClaims() verifies the JWT; serverSupabaseUser returns null (or throws)
  // when there's no valid session — both normalise to a clean 401 below.
  const claims = await serverSupabaseUser(event).catch(() => null)
  const id = claims?.sub
  if (!id) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
  }
  return { id }
}
