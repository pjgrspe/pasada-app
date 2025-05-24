// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'; // Import onAuthStateChanged and FirebaseUser
import { useTheme } from '../hooks/useTheme';
import { AppLightTheme, AppDarkTheme } from '../utils/navigationThemes';
import { useAuthStore } from '../modules/auth/store/useAuthStore'; // Import directly for listener setup
import { auth as firebaseAuth } from '../FirebaseConfig'; // Import Firebase auth instance

export default function GlobalLayout() {
    const { isAuthenticated, isInitialized, _setUser } = useAuthStore(); // Get _setUser from the store
    const segments = useSegments();
    const router = useRouter();
    const { activeTheme } = useTheme();

    useEffect(() => {
        // Subscribe to Firebase auth state changes
        const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser: FirebaseUser | null) => {
            console.log("Auth state changed, Firebase user:", firebaseUser?.email || null);
            _setUser(firebaseUser); // Update the store with the new user state
        });

        return () => unsubscribe(); // Cleanup subscription on unmount
    }, [_setUser]); // _setUser is stable, so this effect runs once on mount

    useEffect(() => {
        if (!isInitialized) {
            console.log("Auth not initialized yet by onAuthStateChanged, waiting...");
            return;
        }

        const inAuthGroup = segments[0] === 'auth';
        console.log(`Auth Initialized: ${isInitialized}, Authenticated: ${isAuthenticated}, In Auth Group: ${inAuthGroup}`);

        if (!isAuthenticated && !inAuthGroup) {
            console.log("Redirecting to /auth/login");
            router.replace('/auth/login');
        } else if (isAuthenticated && inAuthGroup) {
            console.log("Redirecting to /(tabs)");
            router.replace('/(tabs)');
        }
    }, [isAuthenticated, isInitialized, segments, router]);

    if (!isInitialized) {
        return (
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="large" color="#FF8C00" />
            </View>
        );
    }

    return (
        <ThemeProvider value={activeTheme === 'dark' ? AppDarkTheme : AppLightTheme}>
            <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                {/* Add other global screens here if any, e.g., a modal */}
                {/* <Stack.Screen name="modal" options={{ presentation: 'modal' }} /> */}
            </Stack>
        </ThemeProvider>
    );
}

const styles = StyleSheet.create({
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
    },
});