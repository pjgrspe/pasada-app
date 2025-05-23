// app/(tabs)/trips/index.tsx
import React, { useState } from 'react'; // Added useState for example
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Link, useRouter } from 'expo-router';

// --- IMPORT YOUR COMPONENTS ---
import Loader from '../../../components/Loader';
// ------------------------------

interface Trip { id: string; date: string; start: string; end: string; distance: string; }
const dummyTrips: Trip[] = [ /* ... (keep dummy data) ... */ ];

const TripListItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity style={styles.itemContainer}>
        <Text style={styles.itemTitle}>{item.start} → {item.end}</Text>
        <Text style={styles.itemSubtitle}>{item.date} | {item.distance} km</Text>
    </TouchableOpacity>
);

const TripListScreen = () => {
    // const { trips, isLoading, error } = useTrips();
    const [isLoading, setIsLoading] = useState(false); // Example: set to true to see loader
    const trips = dummyTrips;
    const error = null;

    // --- USE YOUR LOADER COMPONENT ---
    if (isLoading) {
        return (
            <View style={styles.centered}>
                <Loader text="Loading trips..." />
            </View>
        );
    }
    // ---------------------------------

    if (error) {
        return <View style={styles.centered}><Text>Error loading trips.</Text></View>;
    }
    if (!trips || trips.length === 0) {
        return <View style={styles.centered}><Text>No trips recorded yet.</Text></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={trips}
                renderItem={({ item }) => <TripListItem item={item} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
            />
        </View>
    );
};

// Styles (keep as is)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f0f0' },
    list: { padding: 10 },
    itemContainer: { backgroundColor: '#fff', padding: 20, marginBottom: 10, borderRadius: 8, elevation: 3 },
    itemTitle: { fontSize: 18, fontWeight: 'bold' },
    itemSubtitle: { fontSize: 14, color: 'gray', marginTop: 4 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default TripListScreen;