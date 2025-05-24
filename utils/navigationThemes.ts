// utils/navigationThemes.ts
import { Theme as NavigationTheme, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { lightThemeColors, darkThemeColors } from '../hooks/useTheme';

export const AppLightTheme: NavigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: lightThemeColors.primary,
    background: lightThemeColors.background,
    card: lightThemeColors.card,
    text: lightThemeColors.text,
    border: lightThemeColors.border,
    notification: lightThemeColors.primary, // Often same as primary
  },
};

export const AppDarkTheme: NavigationTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: darkThemeColors.primary,
    background: darkThemeColors.background,
    card: darkThemeColors.card,
    text: darkThemeColors.text,
    border: darkThemeColors.border,
    notification: darkThemeColors.primary,
  },
};