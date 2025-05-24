// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';

export default function TabLayout() {
    const { colors, isDarkMode } = useTheme();

    return (
        <Tabs
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'alert-circle';
                    if (route.name === 'index') iconName = focused ? 'map' : 'map-outline';
                    else if (route.name === 'trips') iconName = focused ? 'list-circle' : 'list-circle-outline';
                    else if (route.name === 'notifications') iconName = focused ? 'notifications' : 'notifications-outline';
                    else if (route.name === 'profile') iconName = focused ? 'person-circle' : 'person-circle-outline';
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: colors.tabBarActive,
                tabBarInactiveTintColor: colors.tabBarInactive,
                headerShown: false, // Keep false as inner stacks will handle headers
                tabBarStyle: {
                    backgroundColor: colors.tabBar,
                    borderTopColor: colors.border,
                    borderTopWidth: isDarkMode ? 0.5 : 1,
                }
            })}
        >
            <Tabs.Screen name="index" options={{ title: 'Plan & Map' }} />
            <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
            <Tabs.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
    );
}