// app/(tabs)/notifications/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function NotificationsLayout() {
    const { colors } = useTheme();
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: colors.header },
                headerTintColor: colors.headerText,
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
            }}
        >
            <Stack.Screen
                name="index"
                options={{
                    title: 'All Notifications',
                    headerShown: true, // Show header for the list
                }}
            />
            <Stack.Screen
                name="[id]"
                options={{
                    title: 'Notification Details',
                    headerShown: true, // Show header for details
                }}
            />
        </Stack>
    );
}