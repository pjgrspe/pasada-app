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
            <Stack.Screen name="index" options={{ title: 'My Profile' }} />
            <Stack.Screen name="edit" options={{ title: 'Edit Profile' }} />
            {/* If settings & notifications were here, they'd be: */}
            {/* <Stack.Screen name="settings" options={{ title: 'Settings' }} /> */}
            {/* <Stack.Screen name="notifications" options={{ title: 'Notifications' }} /> */}
        </Stack>
    );
}