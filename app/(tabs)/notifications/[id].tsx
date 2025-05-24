// app/(tabs)/notifications/[id].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';

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

    const notification = notificationsData.find(n => n.id === id);

    const dynamicStyles = StyleSheet.create({
        background: { backgroundColor: colors.background },
        card: {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            padding: 18,
            borderRadius: 16,
            elevation: 2,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            position: 'relative',
        },
        title: { 
            color: colors.text,
            fontSize: 22,
            fontWeight: '700',
            flexShrink: 1,
            lineHeight: 28,
            marginTop: 16,
        },
        time: { 
            color: colors.text, 
            opacity: 0.6,
            fontSize: 13,
            fontStyle: 'italic',
            marginTop: 4,
            marginBottom: 8,  
            textAlign: 'left',
            lineHeight: 16,
        },
        message: { 
            color: colors.text, 
            opacity: 0.9,
            fontSize: 16,
            lineHeight: 22,
            marginBottom: 8, 
        },
        separator: {
            height: 1,
            backgroundColor: '#ddd',
            opacity: 0.25,
            marginVertical: 8,  
        },

        detailsTitle: {
            color: colors.text,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 10,
            lineHeight: 24,
        },
        details: { 
            color: colors.text,
            opacity: 0.75,
            fontSize: 15,
            lineHeight: 20,
        },
        notFoundText: { 
            color: colors.error,
            fontSize: 18,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 20,
        },
        iconCircle: {
            backgroundColor: colors.primary + '20', 
            borderRadius: 30,
            width: 56,
            height: 56,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
            shadowColor: colors.primary,
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 4,
        },
        headerTextContainer: {
            flex: 1,
            justifyContent: 'center',
        }
    });

    if (!notification) {
        return (
            <View style={[styles.container, dynamicStyles.background, styles.centered]}>
                <Text style={dynamicStyles.notFoundText}>Notification not found.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, dynamicStyles.background]} contentContainerStyle={{ paddingBottom: 40 }}>
            <View style={[dynamicStyles.card, { paddingTop: 12 }]}>
                {/* Header with icon, title */}
                <View style={[dynamicStyles.header, { justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={dynamicStyles.iconCircle}>
                            <Ionicons name={notification.icon as any} size={28} color={colors.primary} />
                        </View>
                        <View style={dynamicStyles.headerTextContainer}>
                            <Text style={dynamicStyles.title}>{notification.title}</Text>
                            <Text style={dynamicStyles.time}>{notification.time}</Text>
                        </View>
                    </View>
                </View>

                <Text style={dynamicStyles.message}>{notification.message}</Text>

                <View style={dynamicStyles.separator} />

                <Text style={dynamicStyles.detailsTitle}>Details:</Text>
                <Text style={dynamicStyles.details}>{notification.details}</Text>
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
});