// app/(tabs)/notifications/[id].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';

// Re-use dummy data or fetch based on ID in a real app
const notificationsData = [
    { id: '1', title: 'Route Update', message: 'Heavy traffic expected on EDSA. Consider an alternative route.', time: '10m ago', read: false, icon: 'alert', details: "NLEX northbound is experiencing heavy congestion near Balintawak. Rerouting via C5 might save you 15 minutes." },
    { id: '2', title: 'Trip Completed', message: 'Your trip to SM North EDSA is complete.', time: '1h ago', read: true, icon: 'checkmark-circle-outline', details: "Trip duration: 45 minutes. Distance: 32km. Average speed: 42 km/h." },
    { id: '3', title: 'Maintenance Alert', message: 'Your CAR-001 is due for oil change next week.', time: 'Yesterday', read: false, icon: 'build-outline', details: "Scheduled maintenance is recommended every 5000km or 6 months. Please book an appointment." },
    { id: '4', title: 'Low Fuel', message: 'CAR-007 has low fuel. Plan a stop.', time: 'Yesterday', read: true, icon: 'speedometer-outline', details: "Estimated range: 50km. Nearest gas station is 5km ahead." },
    { id: '5', title: 'New Feature!', message: 'Explore the new eco-friendly routing option.', time: '2 days ago', read: true, icon: 'leaf-outline', details: "Our new routing algorithm helps you save fuel and reduce your carbon footprint. Try it now in the settings!" },
];

export default function NotificationDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();

    // Find the notification - in a real app, you might fetch this
    const notification = notificationsData.find(n => n.id === id);

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        card: { backgroundColor: colors.card, shadowColor: colors.text },
        title: { color: colors.text },
        time: { color: colors.text, opacity: 0.6 },
        message: { color: colors.text, opacity: 0.9 },
        details: { color: colors.text, opacity: 0.8 },
        notFoundText: { color: colors.error },
    });

    if (!notification) {
        return (
            <View style={[styles.container, dynamicStyles.container, styles.centered]}>
                <Text style={dynamicStyles.notFoundText}>Notification not found.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            <View style={[styles.card, dynamicStyles.card]}>
                <View style={styles.header}>
                    <Ionicons name={notification.icon as any} size={30} color={colors.primary} />
                    <Text style={[styles.title, dynamicStyles.title]}>{notification.title}</Text>
                </View>
                <Text style={[styles.time, dynamicStyles.time]}>Received: {notification.time}</Text>
                <Text style={[styles.message, dynamicStyles.message]}>{notification.message}</Text>
                <View style={styles.separator} />
                <Text style={[styles.detailsTitle, dynamicStyles.title]}>Details:</Text>
                <Text style={[styles.details, dynamicStyles.details]}>{notification.details}</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        padding: 25,
        borderRadius: 15,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginLeft: 15,
    },
    time: {
        fontSize: 13,
        fontStyle: 'italic',
        marginBottom: 20,
        textAlign: 'right',
    },
    message: {
        fontSize: 16,
        lineHeight: 24,
        marginBottom: 25,
    },
    separator: {
        height: 1,
        backgroundColor: '#ccc', // Use colors.border in a real app
        opacity: 0.3,
        marginVertical: 15,
    },
    detailsTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 10,
        marginLeft: 0, // Reset margin
    },
    details: {
        fontSize: 15,
        lineHeight: 22,
    },
    notFoundText: {
        fontSize: 18,
    }
});