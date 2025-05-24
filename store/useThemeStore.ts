// store/useThemeStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  themeMode: ThemeMode; // User's preference: 'light', 'dark', or 'system'
  setThemeMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeMode: 'system', // Default to following the system theme
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: 'theme-storage', // Name for the persisted data in AsyncStorage
      storage: createJSONStorage(() => AsyncStorage), // Use AsyncStorage for persistence
    }
  )
);

/**
 * Hook to determine the currently active theme based on user preference and system settings.
 * @returns 'light' or 'dark'
 */
export const useCurrentTheme = (): 'light' | 'dark' => {
    const systemScheme = useColorScheme(); // 'light', 'dark', or null
    const { themeMode } = useThemeStore();

    if (themeMode === 'system') {
        return systemScheme || 'light'; // Default to light if system is null
    }
    return themeMode;
};