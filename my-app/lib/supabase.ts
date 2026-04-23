import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Supabase client for Expo. Set `EXPO_PUBLIC_SUPABASE_URL` and
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `my-app/.env` (same folder as `app.json`),
 * then restart the dev server (`npx expo start`). A root-level `.env` outside
 * `my-app/` is not loaded by Expo.
 *
 * Keys: Supabase Dashboard → Project Settings → API → Project URL and the
 * publishable client key (`sb_publishable_...`) or legacy **anon** JWT.
 *
 * Auth session is persisted with AsyncStorage so logins survive app restarts.
 */
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
