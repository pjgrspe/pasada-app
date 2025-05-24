// app/(tabs)/trips/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';
import Loader from '../../../components/Loader';
import { useTheme } from '../../../hooks/useTheme'; // Import useTheme
import { useTripStore, Trip } from '../../../store/useTripStore'; // Import Trip Store & Trip Type


// Updated TripListItem to use theme
const TripListItem = ({ item }: { item: Trip }) => {
    const { colors } = useTheme();
    const router = useRouter();
    return (
       <TouchableOpacity
            style={[styles.itemContainer, { backgroundColor: colors.card, shadowColor: colors.text }]}
            onPress={() => router.push(`/(tabs)/trips/${item.id}`)} // Use router.push
        >
            <Text style={[styles.itemTitle, { color: colors.text }]}>
                {item.startLocation} → {item.endLocation}
            </Text>
            <Text style={[styles.itemSubtitle, { color: colors.text, opacity: 0.7 }]}>
                {item.date} ({item.startTime}-{item.endTime}) | {item.distance}
            </Text>
       </TouchableOpacity>
    );
};

const TripListScreen = () => {
    const { colors } = useTheme(); // Use theme
    const { trips, isLoading, error, fetchTrips } = useTripStore();
    
    // Fetch trips when the component mounts if not already loaded
    useEffect(() => {
        if (trips.length === 0) {
            fetchTrips();
        }
    }, [fetchTrips, trips.length]);
    // ----------------------------

    if (isLoading && trips.length === 0) { // Show loader only if loading initially
        return <View style={[styles.centered, { backgroundColor: colors.background }]}><Loader text="Loading trips..." color={colors.primary} /></View>;
    }
    if (error) {
        return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text style={{ color: colors.error }}>Error loading trips: {error}</Text></View>;
    }
    if (!trips || trips.length === 0) {
        return <View style={[styles.centered, { backgroundColor: colors.background }]}><Text style={{ color: colors.text }}>No trips recorded yet.</Text></View>;
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={trips} // Use all trips from store
                renderItem={({ item }) => <TripListItem item={item} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    list: { padding: 10 },
    itemContainer: {
        padding: 20,
        marginBottom: 10,
        borderRadius: 8,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    itemTitle: { fontSize: 18, fontWeight: 'bold' },
    itemSubtitle: { fontSize: 14, marginTop: 4 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});


export default TripListScreen;