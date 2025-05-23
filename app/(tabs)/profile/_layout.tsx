// app/(tabs)/profile/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function ProfileLayout() {
    return (
        <Stack
             screenOptions={{
                headerStyle: { backgroundColor: '#f4511e' },
                headerTintColor: '#fff',
                headerShown: true, // Show headers by default here
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