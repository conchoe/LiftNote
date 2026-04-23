import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "700" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="followers" options={{ title: "Followers" }} />
      <Stack.Screen name="following" options={{ title: "Following" }} />
      <Stack.Screen name="user/[id]" options={{ title: "Profile" }} />
    </Stack>
  );
}
