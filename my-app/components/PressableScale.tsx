import { useCallback, type ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Micro-interaction: slight scale on press. Combine with 44+ pt touch area.
 */
export function PressableScale({ style, children, ...rest }: Props) {
  const styled = useCallback(
    (pressed: boolean): StyleProp<ViewStyle> => [
      {
        transform: [{ scale: pressed ? 0.98 : 1 }],
        opacity: pressed ? 0.95 : 1,
      },
      style,
    ],
    [style]
  );
  return (
    <Pressable
      style={({ pressed }) => styled(pressed)}
      accessibilityRole={rest.accessibilityRole ?? "button"}
      android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      hitSlop={8}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
