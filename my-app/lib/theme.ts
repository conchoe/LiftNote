/**
 * LiftNote centralized design system (replaces a separate theme.js; import from here).
 * Dark mode: deep gray canvas (#121212), desaturated accents, WCAG-friendly contrast.
 */
import { DarkTheme, type Theme as NavTheme } from "@react-navigation/native";
import { Platform, type TextStyle, type ViewStyle } from "react-native";

const space = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40 } as const;
const radii = { sm: 10, md: 14, lg: 18, xl: 22, full: 9999 } as const;

export const theme = {
  colors: {
    /** Primary canvas (Material / iOS “true dark” style) */
    bg: "#121212",
    surface: "#1A1A1A",
    surface2: "#242424",
    surfaceCard: "#1C1C1C",
    surfaceElevated: "#262626",
    /** Subtle hairlines, not heavy chrome */
    border: "rgba(255,255,255,0.08)",
    borderHairline: "rgba(255,255,255,0.04)",
    text: "#ECEEEF",
    textSecondary: "#A8ACB2",
    textMuted: "#8E9399",
    /** Desaturated indigo-slate; easier on the eyes than neon */
    accent: "#7C8EAE",
    /** Softer fill for toggles / secondary affordances */
    accentMuted: "rgba(124, 142, 174, 0.45)",
    accentEmphasis: "#9AA9C2",
    onAccent: "#101215",
    danger: "#E07070",
    fire: "#C4865A",
    chartBar: "#5A6F94",
    chartBarDim: "#3D4F6E",
  },
  space,
  radii,
  type: {
    display: 28,
    title: 20,
    title2: 17,
    body: 16,
    bodySemibold: 16,
    subhead: 15,
    caption: 13,
    /** Large numpad-style set inputs */
    setInput: 22,
  } satisfies Record<string, number>,
  minTouch: 44,
} as const;

export type Theme = typeof theme;

/** @deprecated use `theme.colors` — kept for a smooth migration */
export const colors = theme.colors;

export const textStrong: TextStyle = {
  fontWeight: "700" as const,
  letterSpacing: -0.3,
};

export const textTitle: TextStyle = {
  fontSize: theme.type.display,
  fontWeight: "800" as const,
  letterSpacing: -0.5,
  color: theme.colors.text,
};

export const textBody: TextStyle = {
  fontSize: theme.type.body,
  color: theme.colors.text,
};

/** Card / sheet depth — prefer over heavy borders on dark UIs */
export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  default: {
    elevation: 3,
  },
}) as ViewStyle;

/** @react-navigation ThemeProvider — matches app canvas and surfaces */
export const navigationTheme: NavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.accent,
    background: theme.colors.bg,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.danger,
  },
};
