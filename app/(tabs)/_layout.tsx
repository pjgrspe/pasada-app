// Modify: app/(tabs)/_layout.tsx
// Add header options for the 'index' (Plan & Map) screen.
import React from 'react';
import { Tabs, useRouter } from 'expo-router'; // Import useRouter
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import ScreenHeader from '../../components/ScreenHeader'; // Import ScreenHeader
// import { TouchableOpacity } from 'react-native'; // No longer needed here

const logo = require('../../assets/images/favicon.png'); // Use your actual logo path

export default function TabLayout() {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter(); // Get router instance

    return (
        <Tabs
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'alert-circle';
                    if (route.name === 'index') iconName = focused ? 'map' : 'map-outline';
                    else if (route.name === 'trips') iconName = focused ? 'list-circle' : 'list-circle-outline';
                    else if (route.name === 'favorites') iconName = focused ? 'heart' : 'heart-outline';
                    else if (route.name === 'profile') iconName = focused ? 'person-circle' : 'person-circle-outline';
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: colors.tabBarActive,
                tabBarInactiveTintColor: colors.tabBarInactive,
                tabBarStyle: {
                    backgroundColor: colors.tabBar,
                    borderTopColor: colors.border,
                    borderTopWidth: isDarkMode ? 0.5 : 1,
                }
            })}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Pasada', // Tab bar title
                    header: () => (                        <ScreenHeader
                            title="Pasada" // Header title
                            showLogo={true} // Set to true to show the logo
                            logoSource={logo} // Pass the imported logo source
                            rightIconName="notifications" // Right icon name
                            onRightIconPress={() => router.push('/(tabs)/notifications')} // Navigate to notifications on right icon press
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="trips"
                options={{
                    title: 'Trips',
                    headerShown: false, // This layout is handled by app/(tabs)/trips/_layout.tsx
                }}
            />             <Tabs.Screen
                name="favorites"
                options={{
                    title: 'Favorites',
                     headerShown: false, // This layout is handled by app/(tabs)/favorites/_layout.tsx
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    headerShown: false, // This layout is handled by app/(tabs)/profile/_layout.tsx
                }}
            />
        </Tabs>
    );
}