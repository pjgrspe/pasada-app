// app/(tabs)/notifications/index.tsx
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { useRouter } from 'expo-router'; // Import useRouter

// Dummy Data (can be expanded)
const notificationsData = [
    { id: '1', title: 'Route Update', message: 'Heavy traffic expected on EDSA. Consider an alternative route.', time: '10m ago', read: false, icon: 'alert', details: "NLEX northbound is experiencing heavy congestion near Balintawak. Rerouting via C5 might save you 15 minutes." },
    { id: '2', title: 'Trip Completed', message: 'Your trip to SM North EDSA is complete.', time: '1h ago', read: true, icon: 'checkmark-circle-outline', details: "Trip duration: 45 minutes. Distance: 32km. Average speed: 42 km/h." },
    { id: '3', title: 'Maintenance Alert', message: 'Your CAR-001 is due for oil change next week.', time: 'Yesterday', read: false, icon: 'build-outline', details: "Scheduled maintenance is recommended every 5000km or 6 months. Please book an appointment." },
    { id: '4', title: 'Low Fuel', message: 'CAR-007 has low fuel. Plan a stop.', time: 'Yesterday', read: true, icon: 'speedometer-outline', details: "Estimated range: 50km. Nearest gas station is 5km ahead." },
    { id: '5', title: 'New Feature!', message: 'Explore the new eco-friendly routing option.', time: '2 days ago', read: true, icon: 'leaf-outline', details: "Our new routing algorithm helps you save fuel and reduce your carbon footprint. Try it now in the settings!" },
];

type NotificationItemProps = {
    item: typeof notificationsData[0];
    colors: any;
    isDarkMode: boolean;
    onPress: () => void; // Add onPress handler
};

const NotificationItem = ({ item, colors, isDarkMode, onPress }: NotificationItemProps) => (
    <TouchableOpacity
        style={[styles.itemContainer, { backgroundColor: item.read ? colors.card : (isDarkMode ? '#3A3A3C' : '#EFEFF4'), borderLeftColor: item.read ? colors.border : colors.primary }]}
        onPress={onPress} // Use the passed handler
    >
        <View style={[styles.iconContainer, { backgroundColor: item.read ? colors.border : colors.primary }]}>
            <Ionicons name={item.icon as any} size={24} color="#FFF" />
        </View>
        <View style={styles.textContainer}>
            <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.itemMessage, { color: colors.text, opacity: 0.8 }]} numberOfLines={1}>{item.message}</Text>
        </View>
        <Text style={[styles.itemTime, { color: colors.text, opacity: 0.6 }]}>{item.time}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.text} style={{ opacity: 0.5, marginLeft: 5 }}/>
    </TouchableOpacity>
);

export default function NotificationsListScreen() {
    const { colors, isDarkMode } = useTheme();
    const router = useRouter(); // Initialize router

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        emptyText: { color: colors.text, opacity: 0.7 },
    });

    const handleNotificationPress = (id: string) => {
        router.push(`/(tabs)/notifications/${id}`); // Navigate to details screen
    };

    return (
        // SafeAreaView is often not needed here if the _layout handles headers
        <View style={[styles.container, dynamicStyles.container]}>
             <FlatList
                data={notificationsData}
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
                       <Ionicons name="notifications-off-outline" size={60} color={dynamicStyles.emptyText.color} />
                       <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
                            No notifications yet.
                       </Text>
                    </View>
                }
                contentContainerStyle={styles.list}
             />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { padding: 15, paddingTop: 20 }, // Added paddingTop
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginBottom: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        borderLeftWidth: 5,
    },
     iconContainer: {
        padding: 10,
        borderRadius: 25,
        marginRight: 15,
    },
    textContainer: { flex: 1, marginRight: 10 },
    itemTitle: { fontSize: 16, fontWeight: '600', marginBottom: 3 },
    itemMessage: { fontSize: 14 },
    itemTime: { fontSize: 12, textAlign: 'right' },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 150,
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
    },
});