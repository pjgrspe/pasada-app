// Modify: pasada-app/app/(tabs)/notifications/index.tsx
// The title "All Notifications" is now handled by the ScreenHeader in app/(tabs)/notifications/_layout.tsx
// We just need to ensure this screen doesn't try to render its own main header.
// The SafeAreaView and header <Text> are removed.

import React from 'react'; // Removed useState as it's not used
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native'; // SafeAreaView removed
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { useRouter } from 'expo-router';

const notificationsData = [
    { id: '1', title: 'Route Update', message: 'Heavy traffic expected on EDSA. Consider an alternative route.', time: '10m ago', read: false, icon: 'alert-circle-outline', details: "NLEX northbound is experiencing heavy congestion near Balintawak. Rerouting via C5 might save you 15 minutes." },
    { id: '2', title: 'Trip Completed', message: 'Your trip to SM North EDSA is complete.', time: '1h ago', read: true, icon: 'checkmark-circle-outline', details: "Trip duration: 45 minutes. Distance: 32km. Average speed: 42 km/h." },
    { id: '3', title: 'Maintenance Alert', message: 'Your CAR-001 is due for oil change next week.', time: 'Yesterday', read: false, icon: 'build-outline', details: "Scheduled maintenance is recommended every 5000km or 6 months. Please book an appointment." },
    { id: '4', title: 'Low Fuel', message: 'CAR-007 has low fuel. Plan a stop.', time: 'Yesterday', read: true, icon: 'speedometer-outline', details: "Estimated range: 50km. Nearest gas station is 5km ahead." },
    { id: '5', title: 'New Feature!', message: 'Explore the new eco-friendly routing option.', time: '2 days ago', read: true, icon: 'leaf-outline', details: "Our new routing algorithm helps you save fuel and reduce your carbon footprint. Try it now in the settings!" },
];

type NotificationItemProps = {
    item: typeof notificationsData[0];
    colors: any; // Consider more specific type if `useTheme` provides it
    isDarkMode: boolean;
    onPress: () => void;
};

const NotificationItem = ({ item, colors, isDarkMode, onPress }: NotificationItemProps) => (
    <TouchableOpacity
        style={[
            styles.itemContainer,
            {
                backgroundColor: item.read ? colors.card : (isDarkMode ? '#38383A' : '#F3F2F7'), // Slightly different unread color
                borderLeftColor: item.read ? colors.border : colors.primary,
                borderColor: colors.border, // Add a subtle border to all items
            }
        ]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <View style={[
            styles.iconContainer,
            { backgroundColor: item.read ? (isDarkMode ? colors.border : '#E5E5EA') : colors.primary } // Dimmer read icon background
        ]}>
            <Ionicons name={item.icon as any} size={22} color={item.read && !isDarkMode ? colors.text : "#FFFFFF"} />
        </View>
        <View style={styles.textContainer}>
            <Text style={[styles.itemTitle, { color: colors.text, fontWeight: item.read ? '500' : 'bold' }]}>{item.title}</Text>
            <Text style={[styles.itemMessage, { color: colors.text, opacity: item.read ? 0.7 : 0.9 }]} numberOfLines={1}>{item.message}</Text>
        </View>
        <View style={styles.timeAndChevronContainer}>
            <Text style={[styles.itemTime, { color: colors.text, opacity: 0.6 }]}>{item.time}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.text} style={{ opacity: 0.5, marginLeft: 5 }}/>
        </View>
    </TouchableOpacity>
);

export default function NotificationsListScreen() {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter();

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        emptyText: { color: colors.text, opacity: 0.7 },
    });

    const handleNotificationPress = (id: string) => {
        // Mark as read locally (in a real app, update backend)
        // For demo, let's find and modify the item (this won't persist or re-render FlatList item automatically without state update)
        // const notification = notificationsData.find(n => n.id === id);
        // if (notification) notification.read = true;
        router.push(`/(tabs)/notifications/${id}`);
    };

    return (
        <View style={[styles.container, dynamicStyles.container]}>
             <FlatList
                data={notificationsData} // Assuming this data might be updated to reflect "read" state
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <NotificationItem
                        item={item}
                        colors={colors}
                        isDarkMode={isDarkMode}
                        onPress={() => handleNotificationPress(item.id)}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                       <Ionicons name="notifications-off-outline" size={70} color={dynamicStyles.emptyText.color} style={{opacity: 0.5}}/>
                       <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                            You're all caught up!
                       </Text>
                    </View>
                }
                contentContainerStyle={styles.list}
                ItemSeparatorComponent={() => <View style={{height: 0.5, backgroundColor: colors.border, marginHorizontal: 20}} />} // Subtle separator
             />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, // paddingTop removed as ScreenHeader handles safe area
    list: { paddingHorizontal: 10, paddingTop: 10 }, // Reduced horizontal padding, added top padding
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12, // Adjusted padding
        paddingHorizontal: 15,
        marginBottom: 6, // Reduced margin
        borderRadius: 10, // Slightly less rounded
        // shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation are good
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2.5,
        elevation: 3,
        borderLeftWidth: 4, // Thinner accent border
        borderWidth: Platform.OS === 'android' ? 1 : 0, // Add subtle border for Android
    },
     iconContainer: {
        padding: 8, // Slightly smaller icon container
        borderRadius: 20, // Circular
        marginRight: 12,
        width: 40, // Fixed size for alignment
        height: 40,
        justifyContent: 'center',
        alignItems: 'center'
    },
    textContainer: { flex: 1, marginRight: 8 },
    itemTitle: { fontSize: 16, marginBottom: 2 }, // Adjusted margin
    itemMessage: { fontSize: 13.5 }, // Adjusted size
    timeAndChevronContainer: { // Group time and chevron
        alignItems: 'flex-end',
    },
    itemTime: { fontSize: 11.5, marginBottom: 3}, // Slightly smaller time
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: '40%', // Adjust to roughly center
    },
    emptyText: {
        marginTop: 20,
        fontSize: 17,
        fontWeight: '500', // Bolder empty text
    },
});