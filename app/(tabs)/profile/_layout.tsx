// Modify: pasada-app/app/(tabs)/profile/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import ScreenHeader from '../../../components/ScreenHeader'; // Import the new header

export default function ProfileLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{
                    header: () => <ScreenHeader title="Profile & Settings" />,
                }}
            />
            <Stack.Screen
                name="edit"
                options={{
                    header: () => <ScreenHeader title="Edit Profile" showBackButton={true}/>,
                }}
            />
        </Stack>
    );
}