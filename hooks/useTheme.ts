// hooks/useTheme.ts
import { useThemeStore, useCurrentTheme } from '../store/useThemeStore';

// Define your theme colors (expand as needed)
export const lightThemeColors = {
  background: '#F8F8F8',
  card: '#FFFFFF',
  text: '#1C1C1E',
  primary: '#FF8C00',
  secondary: '#2C2C2E',
  border: '#E0E0E0',
  error: '#DC3545',
  success: '#28A745',
  inputBackground: '#FFFFFF',
  inputText: '#1C1C1E',
  tabBar: '#FFFFFF',
  tabBarActive: '#FF8C00',
  tabBarInactive: '#8E8E93',
  header: '#FF8C00', // Example: Keep original orange header
  headerText: '#FFFFFF',
};

export const darkThemeColors = {
  background: '#1C1C1E',
  card: '#2C2C2E',
  text: '#FFFFFF',
  primary: '#FF8C00',
  secondary: '#3A3A3C',
  border: '#4A4A4C',
  error: '#FF6B6B',
  success: '#34C759',
  inputBackground: '#3A3A3C',
  inputText: '#FFFFFF',
  tabBar: '#1C1C1E',
  tabBarActive: '#FF8C00',
  tabBarInactive: '#8E8E93',
  header: '#333333', // Darker header
  headerText: '#FF8C00',
};

export type ColorScheme = typeof lightThemeColors;

/**
 * Hook to access the current theme (light/dark), its colors,
 * and functions to change the theme preference.
 */
export const useTheme = () => {
  const { themeMode, setThemeMode } = useThemeStore();
  const currentTheme = useCurrentTheme();
  const colors = currentTheme === 'dark' ? darkThemeColors : lightThemeColors;

  return {
    themeMode,        // 'light', 'dark', or 'system' (User preference)
    activeTheme: currentTheme, // 'light' or 'dark' (Currently active)
    colors,           // Colors object for the active theme
    isDarkMode: currentTheme === 'dark',
    setThemeMode,     // Function to change preference
  };
};