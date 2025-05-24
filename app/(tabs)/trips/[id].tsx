// app/(tabs)/trips/[id].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Marker } from 'react-native-maps'; // Import Marker

// New Map Module imports
import MapViewComponent from '../../../modules/map/components/MapViewComponent';
import RoutePolyline from '../../../modules/map/components/RoutePolyLine';
import MapPin from '../../../modules/map/components/MapPin';
import { regionFromCoordinates } from '../../../modules/map/utils/mapHelpers';

import { useTheme } from '../../../hooks/useTheme';
import Loader from '../../../components/Loader';
import { useTripStore } from '../../../store/useTripStore';

const TripDetailsScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const { trips, isLoading: tripsIsLoading } = useTripStore();

    const trip = trips.find(t => t.id === id);
    const error = null;

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        title: { color: colors.text },
        mapContainer: { backgroundColor: colors.card, shadowColor: colors.text, },
        detailsContainer: { },
        detailText: { color: colors.text },
        centered: { backgroundColor: colors.background },
        errorText: { color: colors.error },
    });

    if (tripsIsLoading && !trip) {
        return <View style={[styles.centered, dynamicStyles.centered]}><Loader text="Loading trip details..." /></View>;
    }

    if (error || !trip) {
        return <View style={[styles.centered, dynamicStyles.centered]}><Text style={dynamicStyles.errorText}>Error: Trip not found.</Text></View>;
    }

    const initialRegion = trip.routeCoordinates && trip.routeCoordinates.length > 0
        ? regionFromCoordinates(trip.routeCoordinates, 0.2)
        : {
            latitude: 14.8433,
            longitude: 120.8134,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
          };

    return (
        <ScrollView style={[styles.container, dynamicStyles.container]}>
            <Text style={[styles.title, dynamicStyles.title]}>
                Trip: {trip.startLocation} to {trip.endLocation}
            </Text>

            <View style={[styles.mapContainer, dynamicStyles.mapContainer]}>
                 <MapViewComponent
                    initialRegion={initialRegion}
                >
                  {trip.routeCoordinates && trip.routeCoordinates.length > 0 && (
                      <>
                            {/* Corrected Usage for start and end pins */}
                            <Marker coordinate={trip.routeCoordinates[0]} title="Start">
                                <MapPin type="start" />
                            </Marker>
                            <Marker coordinate={trip.routeCoordinates[trip.routeCoordinates.length - 1]} title="End">
                                <MapPin type="end" />
                            </Marker>
                            <RoutePolyline coordinates={trip.routeCoordinates} />
                      </>
                  )}
                 </MapViewComponent>
            </View>


            <View style={styles.detailsContainer}>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>ID: {trip.id}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>Date: {trip.date}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>Time: {trip.startTime} - {trip.endTime}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>From: {trip.startLocation}</Text>
                <Text style={[styles.detailText, dynamicStyles.detailText]}>To: {trip.endLocation}</Text>
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
        fontSize: 20,
        fontWeight: 'bold',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        textAlign: 'center',
    },
    mapContainer: {
        height: 300,
        marginHorizontal: 15,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#ddd',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 2,
    },
    detailsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    detailText: {
        fontSize: 16,
        marginBottom: 10,
    },
});

export default TripDetailsScreen;