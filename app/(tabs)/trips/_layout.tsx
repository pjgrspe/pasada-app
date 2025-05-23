// app/(tabs)/trips/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function TripsLayout() {
    return (
        <Stack
            screenOptions={{
                headerStyle: { backgroundColor: '#f4511e' },
                headerTintColor: '#fff',
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