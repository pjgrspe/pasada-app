// Modify: pasada-app/app/(tabs)/notifications/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import ScreenHeader from '../../../components/ScreenHeader'; // Import the new header

export default function NotificationsLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{
                     header: () => <ScreenHeader title="All Notifications" />,
                }}
            />
            <Stack.Screen
                name="[id]"
                options={{
                    header: () => <ScreenHeader title="Notification Details" showBackButton={true} />,
                }}
            />
        </Stack>
    );
}