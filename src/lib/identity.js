/**
 * Who is this visitor, really?
 *
 * Supabase gives an anonymous session the Postgres role `authenticated`, so
 * `if (user)` is true for a throwaway visitor who has never signed in. That
 * distinction was conflated in several places, which is why anonymous users
 * could post comments as "Unknown" and why the submit handlers crashed on
 * `user.email.split('@')` — an anonymous user has no email.
 *
 * Anything that means "has a real account" must use isRealAccount().
 */

/** A signed-in account (email or OAuth) — NOT a lazy anonymous session. */
export const isRealAccount = (user) => Boolean(user) && !user.is_anonymous;

/** True only for a real account whose profile says admin. UX gate, never security — RLS decides. */
export const isAdmin = (user, profile) => isRealAccount(user) && profile?.role === 'admin';

/**
 * Human-readable credit for a contribution. Anonymous sessions and signed-out
 * visitors both credit as 'Community' — never as an empty string, and never by
 * touching user.email, which may not exist.
 */
export function submitterName(user, profile) {
  if (!isRealAccount(user)) return 'Community';
  return (
    profile?.username ||
    user.user_metadata?.username ||
    profile?.display_name ||
    user.email?.split('@')[0] ||
    'Community'
  );
}

/** Avatar for the signed-in viewer, falling back through OAuth metadata. */
export const ownAvatarUrl = (user, profile) =>
  profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '/default-avatar.png';
