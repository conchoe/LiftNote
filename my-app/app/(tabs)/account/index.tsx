import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { useWorkoutStore } from "@/context/workout-store";
import { computePersonalRecords } from "@/lib/pr";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import { getOutgoingFriendStatus, sendFollowRequest } from "@/lib/social";
import { validateUsernameFormat, checkUsernameAvailable, updateUsername } from "@/lib/username";

type IncomingRequest = { id: string; user_id: string; username: string };
type FollowBackEntry = { userId: string; username: string };

export default function AccountScreen() {
  const { session, authEnabled, signOut, loading } = useAuth();
  const { state } = useWorkoutStore();
  const [busy, setBusy] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [acceptedAwaitingFollowBack, setAcceptedAwaitingFollowBack] = useState<FollowBackEntry[]>([]);
  const followBackRef = useRef<FollowBackEntry[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  useEffect(() => {
    followBackRef.current = acceptedAwaitingFollowBack;
  }, [acceptedAwaitingFollowBack]);

  const prs = useMemo(() => computePersonalRecords(state.sessions, state.exercises), [state.sessions, state.exercises]);

  const loadProfile = useCallback(async () => {
    if (!supabase || !session?.user?.id) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("username, is_private")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) {
      console.warn("[account] profile load", error.message);
      return;
    }
    setCurrentUsername(data?.username ?? null);
    setIsPrivate(Boolean(data?.is_private));
    setProfileLoaded(true);
  }, [session?.user?.id]);

  const loadSocial = useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      setFollowingCount(0);
      setFollowersCount(0);
      setIncoming([]);
      return;
    }
    setSocialLoading(true);
    const uid = session.user.id;
    try {
      const [fRes, gRes] = await Promise.all([
        supabase.from("friends").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "accepted"),
        supabase.from("friends").select("id", { count: "exact", head: true }).eq("friend_id", uid).eq("status", "accepted"),
      ]);

      setFollowingCount(fRes.count ?? 0);
      setFollowersCount(gRes.count ?? 0);

      const { data: pendingRows } = await supabase
        .from("friends")
        .select("id, user_id")
        .eq("friend_id", uid)
        .eq("status", "pending");

      const pend = (pendingRows ?? []) as { id: string; user_id: string }[];
      if (pend.length === 0) {
        setIncoming([]);
        const fbEmpty = followBackRef.current;
        if (fbEmpty.length > 0) {
          const kept: FollowBackEntry[] = [];
          for (const x of fbEmpty) {
            const st = await getOutgoingFriendStatus(supabase, uid, x.userId);
            if (st == null) kept.push(x);
          }
          setAcceptedAwaitingFollowBack(kept);
        }
        return;
      }
      const fromIds = pend.map((p) => p.user_id);
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", fromIds);
      const nameById = new Map((profs ?? []).map((p) => [p.id as string, String((p as { username?: string }).username ?? "user")]));
      setIncoming(
        pend.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          username: nameById.get(r.user_id) ?? "Unknown user",
        }))
      );

      const fb = followBackRef.current;
      if (fb.length > 0) {
        const kept: FollowBackEntry[] = [];
        for (const x of fb) {
          const st = await getOutgoingFriendStatus(supabase, uid, x.userId);
          if (st == null) kept.push(x);
        }
        setAcceptedAwaitingFollowBack(kept);
      }
    } finally {
      setSocialLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!authEnabled || !session?.user?.id || !supabase) return;
    void loadProfile();
  }, [authEnabled, session?.user?.id, loadProfile]);

  useFocusEffect(
    useCallback(() => {
      if (!authEnabled || !session?.user?.id) return;
      void loadSocial();
    }, [authEnabled, session?.user?.id, loadSocial])
  );

  const onAcceptRequest = useCallback(
    async (row: IncomingRequest) => {
      if (!supabase || !session?.user?.id) return;
      const { error } = await supabase.from("friends").update({ status: "accepted" }).eq("id", row.id);
      if (error) {
        Alert.alert("Accept", error.message);
        return;
      }
      await loadSocial();
      const st = await getOutgoingFriendStatus(supabase, session.user.id, row.user_id);
      if (st == null) {
        setAcceptedAwaitingFollowBack((prev) =>
          prev.some((p) => p.userId === row.user_id) ? prev : [...prev, { userId: row.user_id, username: row.username }]
        );
      }
    },
    [loadSocial, session?.user?.id]
  );

  const onFollowBack = useCallback(
    async (entry: FollowBackEntry) => {
      if (!supabase || !session?.user?.id) return;
      const r = await sendFollowRequest(supabase, session.user.id, entry.userId);
      if (!r.ok) {
        if (r.code === "23505") {
          Alert.alert("Follow", "A request already exists between you and this person.");
        } else {
          Alert.alert("Follow", r.message);
        }
        return;
      }
      setAcceptedAwaitingFollowBack((prev) => prev.filter((p) => p.userId !== entry.userId));
      Alert.alert("Request sent", `@${entry.username} will see your follow request.`);
      void loadSocial();
    },
    [loadSocial, session?.user?.id]
  );

  const onDeclineRequest = useCallback(
    async (row: IncomingRequest) => {
      if (!supabase) return;
      const { error } = await supabase.from("friends").delete().eq("id", row.id);
      if (error) {
        Alert.alert("Decline", error.message);
        return;
      }
      void loadSocial();
    },
    [loadSocial]
  );

  const onTogglePrivacy = useCallback(
    async (next: boolean) => {
      if (!supabase || !session?.user?.id) return;
      setPrivacyBusy(true);
      const { error } = await supabase.from("profiles").update({ is_private: next }).eq("id", session.user.id);
      setPrivacyBusy(false);
      if (error) {
        Alert.alert("Could not update", error.message);
        return;
      }
      setIsPrivate(next);
    },
    [session?.user?.id]
  );

  const onChangeUsername = async () => {
    if (!session?.user?.id) return;

    const validation = validateUsernameFormat(newUsername);
    if (!validation.ok) {
      setUsernameError(validation.error);
      return;
    }

    const available = await checkUsernameAvailable(newUsername, session.user.id);
    if (!available.available) {
      setUsernameError(available.error);
      return;
    }

    setBusy(true);
    try {
      const result = await updateUsername(session.user.id, newUsername);
      if (result.ok) {
        setCurrentUsername(newUsername.toLowerCase());
        setEditingUsername(false);
        setNewUsername("");
        setUsernameError(null);
        Alert.alert("Success", "Username updated!");
      } else {
        setUsernameError(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = () => {
    Alert.alert("Sign out", "You will need to sign in again to use cloud features.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await signOut();
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  };

  if (!authEnabled) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Supabase is not configured. Add keys to my-app/.env to enable sign-in.</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const email = session?.user?.email;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.subtitle}>Signed in with Supabase Auth.</Text>
        </View>

        {session?.user?.id && supabase ? (
          <View style={styles.socialStrip}>
            <TouchableOpacity
              style={styles.socialCol}
              onPress={() => router.push("/(tabs)/account/following")}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Following, ${followingCount} people`}
            >
              <Text style={styles.socialCount}>{socialLoading ? "—" : followingCount}</Text>
              <Text style={styles.socialLabel}>Following</Text>
            </TouchableOpacity>
            <View style={styles.socialDivider} />
            <TouchableOpacity
              style={styles.socialCol}
              onPress={() => router.push("/(tabs)/account/followers")}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Followers, ${followersCount} people`}
            >
              <Text style={styles.socialCount}>{socialLoading ? "—" : followersCount}</Text>
              <Text style={styles.socialLabel}>Followers</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {incoming.length > 0 ? (
          <View style={styles.requestsCard}>
            <Text style={styles.requestsTitle}>Friend requests</Text>
            <Text style={styles.requestsSub}>People who want to connect with you</Text>
            {incoming.map((r) => (
              <View key={r.id} style={styles.requestRow}>
                <View style={styles.requestText}>
                  <Text style={styles.requestUsername}>@{r.username}</Text>
                  <Text style={styles.requestMeta}>Wants to follow you</Text>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity style={styles.acceptSmall} onPress={() => void onAcceptRequest(r)}>
                    <Text style={styles.acceptSmallText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.declineSmall} onPress={() => void onDeclineRequest(r)}>
                    <Text style={styles.declineSmallText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {acceptedAwaitingFollowBack.length > 0 ? (
          <View style={styles.requestsCard}>
            <Text style={styles.requestsTitle}>Follow back</Text>
            <Text style={styles.requestsSub}>Send them a follow request so you see their activity too.</Text>
            {acceptedAwaitingFollowBack.map((r) => (
              <View key={r.userId} style={styles.requestRow}>
                <View style={styles.requestText}>
                  <Text style={styles.requestUsername}>@{r.username}</Text>
                  <Text style={styles.requestMeta}>Now follows you</Text>
                </View>
                <TouchableOpacity style={styles.followBackBtn} onPress={() => void onFollowBack(r)}>
                  <Text style={styles.followBackBtnText}>Follow back</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.email}>{email ?? "—"}</Text>

          {profileLoaded && (
            <>
              <View style={styles.divider} />
              <Text style={styles.label}>Username</Text>
              {!editingUsername ? (
                <TouchableOpacity
                  style={styles.usernameDisplay}
                  onPress={() => {
                    setEditingUsername(true);
                    setNewUsername(currentUsername || "");
                  }}
                >
                  <Text style={styles.usernameText}>@{currentUsername}</Text>
                  <Ionicons name="pencil-outline" size={18} color={colors.accent} />
                </TouchableOpacity>
              ) : (
                <View style={styles.usernameEdit}>
                  <TextInput
                    style={styles.usernameInput}
                    placeholder="New username"
                    placeholderTextColor={colors.textMuted}
                    value={newUsername}
                    onChangeText={(t) => {
                      setNewUsername(t);
                      setUsernameError(null);
                    }}
                    autoCapitalize="none"
                    maxLength={30}
                    editable={!busy}
                  />
                  <TouchableOpacity
                    style={[styles.confirmBtn, busy && styles.confirmBtnDisabled]}
                    onPress={() => void onChangeUsername()}
                    disabled={busy}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.onAccent} size="small" />
                    ) : (
                      <Ionicons name="checkmark" size={18} color={colors.onAccent} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => {
                      setEditingUsername(false);
                      setNewUsername("");
                      setUsernameError(null);
                    }}
                    disabled={busy}
                  >
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
            </>
          )}

          {session?.user?.id && supabase ? (
            <View style={styles.privacyRow}>
              <View style={styles.privacyText}>
                <Text style={styles.privacyTitle}>Private profile</Text>
                <Text style={styles.privacySub}>
                  When on, only accepted friends can see your synced workouts in the community feed.
                </Text>
              </View>
              {profileLoaded ? (
                <Switch
                  value={isPrivate}
                  onValueChange={(v) => void onTogglePrivacy(v)}
                  disabled={privacyBusy}
                  trackColor={{ false: colors.border, true: colors.accentMuted }}
                  thumbColor={colors.text}
                />
              ) : (
                <ActivityIndicator color={colors.textMuted} />
              )}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.signOutBtn, busy && styles.signOutDisabled]}
            onPress={onSignOut}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={20} color={colors.text} />
                <Text style={styles.signOutText}>Sign out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Trophy case</Text>
        <Text style={styles.sectionSub}>Best logged weight per exercise (local + synced sessions).</Text>
        <View style={styles.card}>
          {prs.length === 0 ? (
            <Text style={styles.muted}>Log workouts to see PRs here.</Text>
          ) : (
            prs.map((p) => (
              <View key={p.exerciseId} style={styles.prRow}>
                <Text style={styles.prName}>{p.name}</Text>
                <Text style={styles.prVal}>{p.maxWeight} lbs</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  socialStrip: {
    marginHorizontal: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
  },
  socialCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  socialDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  socialCount: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  socialLabel: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  requestsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  requestsSub: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 12,
  },
  requestText: { flex: 1, minWidth: 0 },
  requestUsername: { fontSize: 16, fontWeight: "700", color: colors.text },
  requestMeta: { marginTop: 2, fontSize: 12, color: colors.textMuted },
  requestActions: { flexDirection: "row", gap: 8 },
  acceptSmall: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  acceptSmallText: { color: colors.onAccent, fontWeight: "700", fontSize: 13 },
  declineSmall: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },
  declineSmallText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  followBackBtn: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  followBackBtnText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  email: {
    marginTop: 8,
    fontSize: 17,
    color: colors.text,
    fontWeight: "600",
  },
  privacyRow: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  privacyText: { flex: 1 },
  privacyTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  privacySub: { marginTop: 4, fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  signOutBtn: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  signOutDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSub: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    fontSize: 13,
    color: colors.textMuted,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  prRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  prName: { fontSize: 15, color: colors.text, flex: 1 },
  prVal: { fontSize: 15, fontWeight: "700", color: colors.accent },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  usernameDisplay: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  usernameText: {
    fontSize: 17,
    color: colors.text,
    fontWeight: "600",
  },
  usernameEdit: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  usernameInput: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  confirmBtn: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    padding: 10,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  cancelBtn: {
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.danger,
  },
});
