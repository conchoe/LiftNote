import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as Linking from "expo-linking";

import {
  getEmailConfirmationRedirectTo,
  looksLikeSupabaseAuthRedirect,
  parseAuthParamsFromUrl,
} from "@/lib/auth-deep-link";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  /** False when `EXPO_PUBLIC_*` env vars are missing — app stays usable offline / local-only. */
  authEnabled: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authEnabled = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(authEnabled);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const applyAuthUrl = async (url: string | null) => {
      if (!url || !looksLikeSupabaseAuthRedirect(url)) return;
      const params = parseAuthParamsFromUrl(url);
      if (params.error || params.error_description) {
        console.warn("[auth]", params.error_description ?? params.error);
        return;
      }
      if (params.code) {
        const { error } = await client.auth.exchangeCodeForSession(params.code);
        if (error) console.warn("[auth] exchangeCodeForSession", error.message);
        return;
      }
      if (params.access_token && params.refresh_token) {
        const { error } = await client.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) console.warn("[auth] setSession", error.message);
      }
    };

    void Linking.getInitialURL().then((url) => void applyAuthUrl(url));

    const sub = Linking.addEventListener("url", ({ url }) => {
      void applyAuthUrl(url);
    });

    return () => sub.remove();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: new Error("Supabase is not configured.") };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? new Error(error.message) : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error("Supabase is not configured."), needsEmailConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: getEmailConfirmationRedirectTo() },
    });
    if (error) return { error: new Error(error.message), needsEmailConfirmation: false };
    const needsEmailConfirmation = !data.session;
    return { error: null, needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      authEnabled,
      signIn,
      signUp,
      signOut,
    }),
    [session, loading, authEnabled, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
