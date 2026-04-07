import { Stack } from "expo-router";

import { colors } from "@/lib/theme";

export default function ProgressLayout() {
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
      <Stack.Screen name="index" options={{ title: "Progress & history" }} />
      <Stack.Screen name="workout/[sessionId]" options={{ title: "Workout" }} />
      <Stack.Screen name="exercise/[id]" options={{ title: "Exercise history" }} />
    </Stack>
  );
}
