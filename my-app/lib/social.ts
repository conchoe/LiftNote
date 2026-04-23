import type { SupabaseClient } from "@supabase/supabase-js";

/** Outgoing follow row: you requested or follow this person. */
export async function getOutgoingFriendStatus(
  client: SupabaseClient,
  myUserId: string,
  theirUserId: string
): Promise<"accepted" | "pending" | null> {
  const { data, error } = await client
    .from("friends")
    .select("status")
    .eq("user_id", myUserId)
    .eq("friend_id", theirUserId)
    .maybeSingle();

  if (error || !data) return null;
  const s = (data as { status?: string }).status;
  if (s === "accepted" || s === "pending") return s;
  return null;
}

export async function sendFollowRequest(
  client: SupabaseClient,
  myUserId: string,
  theirUserId: string
): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const { error } = await client.from("friends").insert({
    user_id: myUserId,
    friend_id: theirUserId,
    status: "pending",
  });
  if (error) {
    return { ok: false, message: error.message, code: error.code };
  }
  return { ok: true };
}
