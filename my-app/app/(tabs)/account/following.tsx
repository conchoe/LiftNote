import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type Row = { id: string; username: string };

export default function FollowingScreen() {
  const { session, authEnabled } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabase || !session?.user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const me = session.user.id;
    const { data: links, error } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", me)
      .eq("status", "accepted");
    if (error || !links?.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = [...new Set(links.map((r) => r.friend_id as string))];
    const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
    const list: Row[] = (profs ?? []).map((p) => ({
      id: p.id as string,
      username: String((p as { username?: string }).username ?? "user"),
    }));
    list.sort((a, b) => a.username.localeCompare(b.username));
    setRows(list);
    setLoading(false);
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!authEnabled) return;
      void load();
    }, [authEnabled, load])
  );

  if (!authEnabled || !session) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <Text style={styles.muted}>Sign in to see who you follow.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={<Text style={styles.muted}>You are not following anyone yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/(tabs)/account/user/${item.id}`)}>
              <Text style={styles.handle}>@{item.username}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  emptyList: { flexGrow: 1, padding: 24, justifyContent: "center" },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  handle: { fontSize: 16, fontWeight: "600", color: colors.text },
  muted: { fontSize: 15, color: colors.textMuted, textAlign: "center" },
});
