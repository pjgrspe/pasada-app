// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Placeholder for your authentication hook
const useAuth = () => ({ isAuthenticated: true, isLoading: false });

export default function GlobalLayout() {
    const { isAuthenticated, isLoading } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === 'auth';

        if (!isAuthenticated && !inAuthGroup) {
            router.replace('/auth');
        } else if (isAuthenticated && inAuthGroup) {
            router.replace('/(tabs)'); // Redirect to dashboard/tabs on login
        }
    }, [isAuthenticated, isLoading, segments, router]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <Stack>
            {/* The main app screens (Tabs) - Hide header here */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Auth screens - Hide header here too */}
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            {/* You could add Modal screens here if needed */}
        </Stack>
    );
}