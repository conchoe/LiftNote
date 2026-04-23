import * as Linking from "expo-linking";

/**
 * Default redirect after the user taps the email confirmation link.
 * Must be listed under Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
 * (e.g. `myapp://**` and `exp://**` while using Expo Go).
 */
export function getEmailConfirmationRedirectTo(): string {
  return Linking.createURL("(auth)/login");
}

export function parseAuthParamsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const u = new URL(url);
    u.searchParams.forEach((v, k) => {
      out[k] = v;
    });
    if (u.hash?.startsWith("#")) {
      const fromHash = new URLSearchParams(u.hash.slice(1));
      fromHash.forEach((v, k) => {
        out[k] = v;
      });
    }
  } catch {
    // ignore malformed URLs
  }
  return out;
}

export function looksLikeSupabaseAuthRedirect(url: string): boolean {
  return /(access_token|refresh_token|error_description|error|code)=/.test(url);
}
