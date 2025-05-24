// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import { useTheme } from '../hooks/useTheme';
import { AppLightTheme, AppDarkTheme } from '../utils/navigationThemes';
import { useAuthStore } from '../modules/auth/store/useAuthStore'; // Import the store directly
import { onAuthStateChanged } from 'firebase/auth'; // Import onAuthStateChanged
import { auth } from '../FirebaseConfig'; // Import initialized auth
import { useTripStore } from '../store/useTripStore'; // Ensure this import is correct

export default function GlobalLayout() {
    const { isAuthenticated, isInitialized: authIsInitialized, _setUser } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();
    const { activeTheme, colors } = useTheme(); // Added colors for loader
    const navigationState = useRootNavigationState();

    // Firebase Auth Listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
            console.log("Auth Listener: User state changed:", fbUser?.email || null);
            _setUser(fbUser);
        });
        return () => unsubscribe();
    }, [_setUser]);

    // Trip Store Initializer
    useEffect(() => {
        // Ensure useTripStore is defined before trying to access getState or its properties.
        // This check helps prevent the "Cannot read property 'getState' of undefined" error.
        if (useTripStore) {
            const tripStoreState = useTripStore.getState();
            if (tripStoreState.trips.length === 0 && !tripStoreState.isLoading) {
                console.log("GlobalLayout: Fetching initial trips.");
                tripStoreState.fetchTrips();
            }
        } else {
            console.error("GlobalLayout: useTripStore is undefined. Check import or initialization order.");
        }
    }, []); // Runs once on mount

    // Routing Logic
    useEffect(() => {
        if (!authIsInitialized || !navigationState?.key) {
             console.log("Routing: Waiting for auth and/or router to be ready...");
             return;
        }

        const inAuthGroup = segments[0] === 'auth';
        // console.log(`Routing: Auth Initialized: ${authIsInitialized}, Authenticated: ${isAuthenticated}, In Auth Group: ${inAuthGroup}, Segments: ${segments.join('/')}`);

        if (!isAuthenticated && !inAuthGroup) {
            console.log("Routing: User not authenticated and not in auth group. Redirecting to /auth/login");
            router.replace('/auth/login');
        } else if (isAuthenticated && inAuthGroup) {
            console.log("Routing: User authenticated and in auth group. Redirecting to /(tabs)");
            router.replace('/(tabs)');
        } else {
            // console.log("Routing: No redirection needed based on current state.");
        }
    }, [isAuthenticated, authIsInitialized, segments, router, navigationState?.key]);

    // Initial Loading screen for auth
    if (!authIsInitialized) {
        console.log("GlobalLayout: Auth not initialized, showing loader.");
        return (
            <View style={[styles.loaderContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
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
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
    },
});