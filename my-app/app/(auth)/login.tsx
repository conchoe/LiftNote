import { useState } from "react";
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

import { useAuth } from "@/context/auth-context";
import { colors } from "@/lib/theme";

export default function LoginScreen() {
  const { signIn, signUp, authEnabled } = useAuth();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!authEnabled) {
      Alert.alert("Not configured", "Add Supabase URL and anon key to my-app/.env.");
      return;
    }
    const trimmed = email.trim();
    if (!trimmed || !password) {
      Alert.alert("Missing fields", "Enter email and password.");
      return;
    }
    if (password.length < 3) {
      Alert.alert("Password too short", "Use at least 3 characters.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signIn") {
        const { error } = await signIn(trimmed, password);
        if (error) {
          Alert.alert("Sign in failed", error.message);
        }
      } else {
        const { error, needsEmailConfirmation } = await signUp(trimmed, password);
        if (error) {
          Alert.alert("Sign up failed", error.message);
        } else if (needsEmailConfirmation) {
          Alert.alert(
            "Confirm your email",
            "We sent a confirmation link. Open it, then return here and sign in."
          );
          setMode("signIn");
        }
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Welcome</Text>
          <Text style={styles.subtitle}>
            {mode === "signIn" ? "Sign in to sync likes and future cloud features." : "Create an account with email and password."}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!busy}
            />

            <Text style={[styles.label, styles.labelSpaced]}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoComplete={mode === "signIn" ? "password" : "password-new"}
              textContentType="password"
              editable={!busy}
            />

            <TouchableOpacity
              style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
              onPress={() => void onSubmit()}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryBtnText}>{mode === "signIn" ? "Sign in" : "Create account"}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}
              disabled={busy}
            >
              <Text style={styles.switchText}>
                {mode === "signIn" ? "Need an account? " : "Already have an account? "}
                <Text style={styles.switchLink}>{mode === "signIn" ? "Sign up" : "Sign in"}</Text>
              </Text>
            </TouchableOpacity>
          </View>
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
    paddingBottom: 32,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    color: colors.textMuted,
    lineHeight: 22,
  },
  card: {
    marginTop: 28,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  labelSpaced: {
    marginTop: 16,
  },
  input: {
    marginTop: 8,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  primaryBtn: {
    marginTop: 22,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontWeight: "800",
    fontSize: 17,
  },
  switchRow: {
    marginTop: 18,
    alignItems: "center",
  },
  switchText: {
    fontSize: 15,
    color: colors.textMuted,
  },
  switchLink: {
    color: colors.accent,
    fontWeight: "700",
  },
});
