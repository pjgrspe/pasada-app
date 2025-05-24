// app/(tabs)/trips/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme'; // Import hook

export default function TripsLayout() {
    const { colors } = useTheme(); // Get theme colors
    return (
        <Stack
            screenOptions={{
                // --- Apply Theme Colors ---
                headerStyle: { backgroundColor: colors.header },
                headerTintColor: colors.headerText,
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                // --------------------------
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'My Trips',
                    headerShown: true, // Show header for the list
                }}
            />
            <Stack.Screen
                name="[id]"
                options={{
                    title: 'Trip Details',
                    headerShown: true, // Show header for details
                }}
            />
        </Stack>
    );
}