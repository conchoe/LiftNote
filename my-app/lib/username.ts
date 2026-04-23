import { supabase } from "./supabase";

/**
 * Validates username format:
 * - 3-30 characters
 * - Alphanumeric, underscore, hyphen only
 * - Cannot start/end with underscore or hyphen
 */
export function validateUsernameFormat(username: string): { ok: true } | { ok: false; error: string } {
  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return { ok: false, error: "Username must be at least 3 characters." };
  }
  if (trimmed.length > 30) {
    return { ok: false, error: "Username must be 30 characters or less." };
  }

  // Allow: a-z, A-Z, 0-9, underscore, hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { ok: false, error: "Username can only contain letters, numbers, underscores, and hyphens." };
  }

  // Cannot start or end with underscore/hyphen
  if (/^[_-]/.test(trimmed) || /[_-]$/.test(trimmed)) {
    return { ok: false, error: "Username cannot start or end with underscore or hyphen." };
  }

  return { ok: true };
}

/**
 * Check if a username is available (not taken by another user).
 * Pass `excludeUserId` when renaming so your current row does not count as a conflict.
 * Uses a bounded select instead of `.single()` so duplicate usernames in DB do not break the check.
 */
export async function checkUsernameAvailable(
  username: string,
  excludeUserId?: string | null
): Promise<{ available: true } | { available: false; error: string }> {
  if (!supabase) {
    return { available: false, error: "Supabase not configured." };
  }

  const normalized = username.trim().toLowerCase();

  try {
    let q = supabase.from("profiles").select("id").eq("username", normalized).limit(10);
    if (excludeUserId) {
      q = q.neq("id", excludeUserId);
    }
    const { data, error } = await q;

    if (error) {
      return { available: false, error: error.message };
    }

    if (data && data.length > 0) {
      return { available: false, error: "Username is already taken." };
    }

    return { available: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { available: false, error: msg };
  }
}

/**
 * Update the user's username (or insert profile row if missing).
 */
export async function updateUsername(userId: string, newUsername: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!supabase) {
    return { ok: false, error: "Supabase not configured." };
  }

  const formatCheck = validateUsernameFormat(newUsername);
  if (!formatCheck.ok) {
    return formatCheck;
  }

  const normalized = newUsername.trim().toLowerCase();
  const availCheck = await checkUsernameAvailable(normalized, userId);
  if (!availCheck.available) {
    return { ok: false, error: availCheck.error };
  }

  try {
    const { data: updated, error: updateErr } = await supabase
      .from("profiles")
      .update({ username: normalized })
      .eq("id", userId)
      .select("id");

    if (updateErr) {
      if (updateErr.message.includes("duplicate") || updateErr.code === "23505") {
        return { ok: false, error: "Username is already taken." };
      }
      return { ok: false, error: updateErr.message };
    }

    if (updated && updated.length > 0) {
      return { ok: true };
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("profiles")
      .insert({ id: userId, username: normalized })
      .select("id");

    if (insertErr) {
      if (insertErr.message.includes("duplicate") || insertErr.code === "23505") {
        return { ok: false, error: "Username is already taken." };
      }
      return { ok: false, error: insertErr.message };
    }

    if (inserted && inserted.length > 0) {
      return { ok: true };
    }

    return { ok: false, error: "Could not save username. Check your connection and try again." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

/**
 * Get a user's profile by username.
 */
export async function getProfileByUsername(username: string) {
  if (!supabase) return null;

  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, current_streak, bio, is_private")
      .eq("username", username.trim().toLowerCase())
      .limit(1)
      .maybeSingle();

    return data;
  } catch {
    return null;
  }
}
