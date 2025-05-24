// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme'; // Import useTheme

export default function TabLayout() {
    const { colors, isDarkMode } = useTheme(); // Get colors and theme status

    return (
        <Tabs
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'alert-circle';
                    if (route.name === 'index') iconName = focused ? 'map' : 'map-outline';
                    else if (route.name === 'trips') iconName = focused ? 'list-circle' : 'list-circle-outline';
                    else if (route.name === 'profile') iconName = focused ? 'person' : 'person-outline';
                    else if (route.name === 'settings') iconName = focused ? 'settings' : 'settings-outline';
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                // --- Apply theme colors ---
                tabBarActiveTintColor: colors.tabBarActive,
                tabBarInactiveTintColor: colors.tabBarInactive,
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.tabBar,
                    borderTopColor: colors.border,
                    borderTopWidth: isDarkMode ? 0.5 : 1, // Adjust border as needed
                }
                // --------------------------
            })}
        >
            <Tabs.Screen name="index" options={{ title: 'Plan & Map' }} />
            <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        </Tabs>
    );
}