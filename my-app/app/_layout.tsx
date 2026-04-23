import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/context/auth-context";
import { WorkoutStoreProvider } from "@/context/workout-store";
import { colors } from "@/lib/theme";

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigation() {
  const { session, loading, authEnabled } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navReady = useRootNavigationState()?.key != null;

  useEffect(() => {
    if (!authEnabled || !navReady || loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [authEnabled, loading, navReady, session, segments, router]);

  if (authEnabled && loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DarkTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <WorkoutStoreProvider>
          <RootNavigation />
        </WorkoutStoreProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
