// hooks/useTheme.ts
import { useThemeStore } from '../store/useThemeStore'; // Assuming useCurrentTheme was a typo or not needed
import { ColorSchemeName, useColorScheme } from 'react-native';

// --- Filipino Inspired Color Palette ---

/**
 * --- Light Theme: "Tropical Daylight" ---
 *
 * Inspired by the vibrant natural elements and symbols of the Philippines.
 * It aims for a light, airy, and welcoming feel, reflecting the warmth
 * of the country and its people. It uses Piña fabric, Capiz shells,
 * the sky, and the iconic flag colors as primary inspirations.
 */
export const lightThemeColors = {
  background: '#F9F7F3', // Warm, very light beige - reminiscent of Piña or Jusi fabric
  card: '#FFFFFF',       // Clean white - like Capiz shells
  routeCard: '#EBF4FA',  // Soft, airy blue - gentle sky
  text: '#1D2A38',       // Deep, slightly muted charcoal - strong readability
  primary: '#0038A8',     // Official Philippine Flag Blue - strong identity
  secondary: '#E63946',   // Vibrant Red/Coral - Fiesta, courage, flag's triangle
  accent: '#FCD116',      // Philippine Flag Yellow - Sun, hope
  border: '#E2E8F0',     // Soft, neutral grey - subtle division
  error: '#D62828',       // A strong, clear red
  success: '#28A745',     // Lush, hopeful green - nature's bounty
  inputBackground: '#FFFFFF',
  inputText: '#1D2A38',
  tabBar: '#FFFFFF',
  tabBarActive: '#0038A8', // Primary color for active state
  tabBarInactive: '#A0AEC0', // Muted grey - standard practice
  header: '#0038A8',     // Strong primary header
  headerText: '#FFFFFF',   // High contrast text for header
};

/**
 * --- Dark Theme: "Deep Archipelago Night" ---
 *
 * This dark theme moves away from beige and embraces the deep blues
 * and greys reminiscent of a Philippine tropical night or the deep sea.
 * It maintains the *spirit* of the light theme by using darker, richer
 * versions of the flag colors, allowing them to shine against the dark
 * backdrop, evoking a sense of mystery, depth, and enduring culture.
 */
export const darkThemeColors = {
  background: '#0B132B', // Very Deep Navy/Almost Black - Deep Sea / Night Sky
  card: '#1C2541',       // Dark Slate Blue - Provides contrast, still deep
  routeCard: '#3A506B',  // Muted Teal/Blue-Grey - Stands out subtly
  text: '#E2E8F0',       // Light Grey/Off-White - High readability
  primary: '#3B82F6',     // **Brighter Blue** - A visible, hopeful Flag Blue on dark
  secondary: '#EF4444',   // **Rich Red** - A strong, clear Red, visible but not harsh
  accent: '#FCD116',      // **Vibrant Yellow** - Stays bright, representing the sun/hope
  border: '#2D3748',     // Dark Grey - Subtle division
  error: '#E53E3E',       // Visible, but not overly bright red
  success: '#38A169',     // Deep but visible green
  inputBackground: '#1C2541', // Matches card
  inputText: '#E2E8F0',       // Matches text
  tabBar: '#0B132B',       // Matches background
  tabBarActive: '#FCD116',  // **Yellow Accent** - Pops against the deep blue
  tabBarInactive: '#718096', // Mid-Grey for inactive state
  header: '#1C2541',       // Matches card for a unified look
  headerText: '#E2E8F0',   // High contrast text
};


export type ColorScheme = typeof lightThemeColors;

/**
 * Hook to access the current theme (light/dark), its colors,
 * and functions to change the theme preference.
 *
 * It intelligently uses the system preference ('system' mode) or
 * allows the user to override it ('light' or 'dark' mode).
 */
export const useTheme = () => {
  const { themeMode, setThemeMode } = useThemeStore();
  const systemTheme = useColorScheme(); // 'light', 'dark', or null

  // Determine the *actually* active theme:
  // If the user set a preference, use it.
  // Otherwise, use the system's setting.
  // Default to 'light' if system setting is somehow null.
  const activeTheme =
    themeMode === 'system' ? systemTheme ?? 'light' : themeMode;

  const colors = activeTheme === 'dark' ? darkThemeColors : lightThemeColors;

  return {
    themeMode,      // 'light', 'dark', or 'system' (User's *preference*)
    activeTheme,    // 'light' or 'dark' (Currently *active* theme)
    colors,         // Colors object for the active theme
    isDarkMode: activeTheme === 'dark',
    setThemeMode,   // Function to change the preference ('light', 'dark', 'system')
  };
};