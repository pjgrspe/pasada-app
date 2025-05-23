// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons'; // Or your preferred icon library

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'alert-circle'; // Default

                    if (route.name === 'index') {
                        iconName = focused ? 'map' : 'map-outline';
                    } else if (route.name === 'trips') {
                        iconName = focused ? 'list-circle' : 'list-circle-outline';
                    } else if (route.name === 'profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    } else if (route.name === 'settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#FF8C00', // Orange-like color
                tabBarInactiveTintColor: 'gray',
                headerShown: false, // We'll let each stack handle its own header
                 tabBarStyle: {
                    backgroundColor: '#FFFFFF', // White background for tabs
                    borderTopWidth: 1,
                    borderTopColor: '#E0E0E0',
                 }
            })}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Plan & Map', // "Planlæg"
                }}
            />
             <Tabs.Screen
                name="trips"
                options={{
                    title: 'Trips', // Could be "Billetter" or "Ruter"
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile', // "Min Side"
                }}
            />
             <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings', // "Indstillinger"
                }}
            />
        </Tabs>
    );
}