// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { useTheme } from '../hooks/useTheme'; // useTheme is already here
import { AppLightTheme, AppDarkTheme } from '../utils/navigationThemes';
import { useAuthStore } from '../modules/auth/store/useAuthStore';
import { auth as firebaseAuth } from '../FirebaseConfig';

export default function GlobalLayout() {
    const { isAuthenticated, isInitialized, _setUser } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();
    const { activeTheme, colors } = useTheme(); // Destructure colors

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser: FirebaseUser | null) => {
            _setUser(firebaseUser);
        });
        return () => unsubscribe();
    }, [_setUser]);

    useEffect(() => {
        if (!isInitialized) {
            return;
        }
        const inAuthGroup = segments[0] === 'auth';
        if (!isAuthenticated && !inAuthGroup) {
            router.replace('/auth/login');
        } else if (isAuthenticated && inAuthGroup) {
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, isInitialized, segments, router]);

    if (!isInitialized) {
        // Use themed background for the initial loader
        // Note: `colors` might not be fully initialized if `useTheme` itself depends on async storage for themeMode.
        // A truly flicker-free initial screen often uses a static splash screen configured natively,
        // or a very simple initial component that doesn't rely on async theme state.
        // However, for this loader, if `useTheme` provides colors synchronously (e.g. default system theme), this works.
        const initialBackgroundColor = activeTheme === 'dark' ? '#1C1C1E' : '#F8F8F8'; // Fallback if colors is not ready

        return (
            <View style={[styles.loaderContainer, { backgroundColor: colors ? colors.background : initialBackgroundColor }]}>
                <ActivityIndicator size="large" color={colors ? colors.primary : "#FF8C00"} />
            </View>
        );
    }

    return (
        <ThemeProvider value={activeTheme === 'dark' ? AppDarkTheme : AppLightTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
            </Stack>
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    loaderContainer: { // Style will be merged with themed backgroundColor
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});