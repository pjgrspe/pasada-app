// app/(tabs)/trips/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';
import ScreenHeader from '../../../components/ScreenHeader'; // Import the new header

export default function TripsLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{
                    header: () => <ScreenHeader title="My Trips" />,
                    // headerShown: true, // This is managed by providing a custom header
                }}
            />
            <Stack.Screen
                name="[id]"
                options={{
                    header: (props) => <ScreenHeader title="Trip Details" showBackButton={true} />,
                    // headerShown: true,
                }}
            />
        </Stack>
    );
}