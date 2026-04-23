import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/context/auth-context";
import { colors } from "@/lib/theme";
import { validateUsernameFormat, checkUsernameAvailable, updateUsername } from "@/lib/username";

export default function UsernameSetupScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<{ username: string; available: boolean } | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      // Should not happen; user should be logged in
      router.replace("/(auth)/login");
    }
  }, [session?.user?.id, router]);

  const checkAvailability = async () => {
    const formatted = validateUsernameFormat(username);
    if (!formatted.ok) {
      setError(formatted.error);
      setCheckedAt(null);
      return;
    }

    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const result = await checkUsernameAvailable(username, session.user.id);
      if (result.available) {
        setError(null);
        setCheckedAt({ username: username.toLowerCase(), available: true });
      } else {
        setError(result.error);
        setCheckedAt(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = async () => {
    if (!session?.user?.id) return;

    // Validate format first
    const formatted = validateUsernameFormat(username);
    if (!formatted.ok) {
      Alert.alert("Invalid username", formatted.error);
      return;
    }

    setLoading(true);
    try {
      const result = await updateUsername(session.user.id, username);
      if (result.ok) {
        Alert.alert("Success", "Username set successfully!", [
          {
            text: "OK",
            onPress: () => router.replace("/(tabs)"),
          },
        ]);
      } else {
        Alert.alert("Error", result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Choose Your Username</Text>
          <Text style={styles.subtitle}>
            This is how others will find and recognize you. You can change it anytime.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="min 3, max 30 chars"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
              editable={!loading}
              maxLength={30}
            />

            {username && (
              <View style={styles.rulesRow}>
                <Ionicons
                  name={/^[a-zA-Z0-9_-]{3,30}$/.test(username) ? "checkmark-circle" : "close-circle"}
                  size={16}
                  color={/^[a-zA-Z0-9_-]{3,30}$/.test(username) ? colors.accent : colors.textMuted}
                />
                <Text style={styles.rulesText}>3–30 chars, letters, numbers, _, -</Text>
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {checkedAt && checkedAt.available ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
                <Text style={styles.successText}>"{checkedAt.username}" is available!</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.checkBtn, loading && styles.checkBtnDisabled]}
              onPress={() => void checkAvailability()}
              disabled={loading || !username}
            >
              {loading ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <>
                  <Ionicons name="search" size={18} color={colors.accent} />
                  <Text style={styles.checkBtnText}>Check availability</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, (!checkedAt?.available || loading) && styles.primaryBtnDisabled]}
              onPress={() => void handleSetUsername()}
              disabled={!checkedAt?.available || loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.onAccent} size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Confirm username</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.help}>
            💡 Your username is public. To keep your workout logs private, toggle the privacy setting in your profile.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: 28,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  rulesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  rulesText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    flex: 1,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  successText: {
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkBtnDisabled: {
    opacity: 0.5,
  },
  checkBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.accent,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onAccent,
  },
  help: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    marginTop: 20,
  },
});
