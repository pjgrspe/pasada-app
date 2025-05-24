// app/(tabs)/profile/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme'; // Import hook

export default function ProfileLayout() {
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
            <Stack.Screen name="index" options={{ title: 'Profile & Settings' }} /> {/* Updated Title */}
            <Stack.Screen name="edit" options={{ title: 'Edit Profile' }} />
        </Stack>
    );
}