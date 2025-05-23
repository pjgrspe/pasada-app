// app/trips/[id].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapView from 'react-native-maps'; // Assume you have it

// Placeholder: Import your trip history map component and hook
// import TripHistoryMap from '../../modules/trips/components/TripHistoryMap';
// import { useTripDetails } from '../../modules/trips/hooks/useTripDetails';

const TripDetailsScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    // const { trip, isLoading, error } = useTripDetails(id);

    // Placeholder data
    const trip = {
        id: id,
        date: '2025-05-23',
        start: 'Home (Malolos)',
        end: 'Work (QC)',
        distance: '45 km',
        duration: '1h 30m',
        // Add route coordinates here for the map
    };
    const isLoading = false;
    const error = null;


    if (isLoading) {
        return <View style={styles.centered}><Text>Loading trip details...</Text></View>;
    }

    if (error || !trip) {
        return <View style={styles.centered}><Text>Error loading trip or trip not found.</Text></View>;
    }

    return (
        <ScrollView style={styles.container}>
            <Text style={styles.title}>Trip Details: {trip.id}</Text>

            {/* Placeholder for Map */}
            <View style={styles.mapContainer}>
                 <MapView
                    style={styles.map}
                    initialRegion={{ // Center based on trip data
                        latitude: 14.8433,
                        longitude: 120.8134,
                        latitudeDelta: 0.5,
                        longitudeDelta: 0.5,
                    }}
                >
                  {/* <TripHistoryMap route={trip.routeCoordinates} /> */}
                  <Text style={styles.mapPlaceholder}>[Map showing trip route {trip.id}]</Text>
                 </MapView>
            </View>


            <View style={styles.detailsContainer}>
                <Text style={styles.detailText}>Date: {trip.date}</Text>
                <Text style={styles.detailText}>From: {trip.start}</Text>
                <Text style={styles.detailText}>To: {trip.end}</Text>
                <Text style={styles.detailText}>Distance: {trip.distance}</Text>
                <Text style={styles.detailText}>Duration: {trip.duration}</Text>
                {/* Add more details, maybe fuel consumption, average speed, etc. */}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        padding: 20,
        textAlign: 'center',
    },
    mapContainer: {
        height: 300,
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
     mapPlaceholder: {
        color: '#555',
        fontSize: 16,
    },
    detailsContainer: {
        paddingHorizontal: 20,
    },
    detailText: {
        fontSize: 16,
        marginBottom: 10,
    },
});

export default TripDetailsScreen;