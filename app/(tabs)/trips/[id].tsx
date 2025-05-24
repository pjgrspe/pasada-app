// app/(tabs)/trips/[id].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapView, { Polyline, PROVIDER_GOOGLE, Marker } from 'react-native-maps'; // Added Marker!
import { useTheme } from '../../../hooks/useTheme'; // Import useTheme
import { darkMapStyle } from '../../../utils/mapStyles'; // Import map styles
import MapPin from '../../../components/MapPin'; // Import MapPin
import Loader from '../../../components/Loader'; // Import Loader

// Placeholder: Import your trip history map component and hook
// import TripHistoryMap from '../../modules/trips/components/TripHistoryMap';
// import { useTripDetails } from '../../modules/trips/hooks/useTripDetails';

const TripDetailsScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors, isDarkMode } = useTheme(); // Use theme
    // const { trip, isLoading, error } = useTripDetails(id);

    // Placeholder data
    const trip = {
        id: id,
        date: '2025-05-23',
        start: 'Home (Malolos)',
        end: 'Work (QC)',
        distance: '45 km',
        duration: '1h 30m',
        routeCoordinates: [ // Example route
            { latitude: 14.8433, longitude: 120.8134 },
            { latitude: 14.80, longitude: 120.90 },
            { latitude: 14.6760, longitude: 121.0437 },
        ],
    };
    const isLoading = false;
    const error = null;

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        title: { color: colors.text },
        mapContainer: { backgroundColor: isDarkMode ? colors.card : '#e0e0e0' },
        detailsContainer: { /* No specific theme needed here unless adding bg */ },
        detailText: { color: colors.text },
        centered: { backgroundColor: colors.background },
        errorText: { color: colors.error },
    });

    if (isLoading) {
        return <View style={[styles.centered, dynamicStyles.centered]}><Loader text="Loading trip details..." /></View>;
    }

    if (error || !trip) {
        return <View style={[styles.centered, dynamicStyles.centered]}><Text style={dynamicStyles.errorText}>Error loading trip or trip not found.</Text></View>;
    }

    const initialRegion = trip.routeCoordinates.length > 0
        ? {
            latitude: trip.routeCoordinates[0].latitude,
            longitude: trip.routeCoordinates[0].longitude,
            latitudeDelta: 0.5, // Adjust as needed
            longitudeDelta: 0.5, // Adjust as needed
          }
        : {
            latitude: 14.8433,
            longitude: 120.8134,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          };

    return (
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            <Text style={[styles.title, dynamicStyles.title]}>Trip Details: {trip.id}</Text>

            <View style={[styles.mapContainer, dynamicStyles.mapContainer]}>
                 <MapView
                    style={styles.map}
                    initialRegion={initialRegion}
                    provider={PROVIDER_GOOGLE}
                    customMapStyle={isDarkMode ? darkMapStyle : []}
                >
                  {/* Add Start/End Markers */}
                  {trip.routeCoordinates.length > 0 && (
                      <>
                            <Marker coordinate={trip.routeCoordinates[0]}>
                                <MapPin type="start" />
                            </Marker>
                            <Marker coordinate={trip.routeCoordinates[trip.routeCoordinates.length - 1]}>
                                <MapPin type="end" />
                            </Marker>
                          <Polyline
                              coordinates={trip.routeCoordinates}
                              strokeColor={colors.primary} // Use theme color for route
                              strokeWidth={5}
                          />
                      </>
                  )}
                 </MapView>
            </View>


            <View style={styles.detailsContainer}>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>Date: {trip.date}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>From: {trip.start}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>To: {trip.end}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>Distance: {trip.distance}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>Duration: {trip.duration}</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        height: 350, // Increased height
        marginHorizontal: 15, // Adjusted margin
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 20,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    detailsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    detailText: {
        fontSize: 16,
        marginBottom: 12,
    },
});

export default TripDetailsScreen;