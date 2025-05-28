// app/(tabs)/trips/[id].tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Marker } from 'react-native-maps';
import Ionicons from 'react-native-vector-icons/Ionicons';

import MapViewComponent from '../../../modules/map/components/MapViewComponent';
import RoutePolyline from '../../../modules/map/components/RoutePolyLine';
import MapPin from '../../../modules/map/components/MapPin';
import { regionFromCoordinates } from '../../../modules/map/utils/mapHelpers';

import { useTheme } from '../../../hooks/useTheme';
import Loader from '../../../components/Loader';
import { useTripStore } from '../../../modules/map/store/useTripStore';

const TripDetailsScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const { trips, isLoading: tripsIsLoading } = useTripStore();

    const trip = trips.find(t => t.id === id);

    const dynamicStyles = StyleSheet.create({
        background: { backgroundColor: colors.background },
        card: {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: colors.text,
        },
        text: { color: colors.text },
        label: { color: colors.text, opacity: 0.7 },
        error: { color: colors.error },
    });

    if (tripsIsLoading && !trip) {
        return (
            <View style={[styles.centered, dynamicStyles.background]}>
                <Loader text="Loading trip details..." />
            </View>
        );
    }

    if (!trip) {
        return (
            <View style={[styles.centered, dynamicStyles.background]}>
                <Text style={[styles.errorText, dynamicStyles.error]}>Trip not found.</Text>
            </View>
        );
    }

    const routeCoordinates = trip.routeCoordinates ?? [];
    const initialRegion = routeCoordinates.length
        ? regionFromCoordinates(routeCoordinates, 0.2)
        : {
            latitude: 14.8433,
            longitude: 120.8134,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
        };

    return (
        <ScrollView style={[styles.container, dynamicStyles.background]}>
            <Text style={[styles.title, dynamicStyles.text]}>
                {trip.startLocation ?? 'N/A'}{' '}
                <Ionicons name="chevron-forward" size={20} color={colors.primary} style={styles.chevron} />{' '}
                {trip.endLocation ?? 'N/A'}
            </Text>

            <View style={[styles.mapContainer, dynamicStyles.card]}>
                <MapViewComponent initialRegion={initialRegion}>
                    {routeCoordinates.length > 0 && (
                        <>
                            <Marker coordinate={routeCoordinates[0]} title="Start">
                                <MapPin type="start" />
                            </Marker>
                            <Marker coordinate={routeCoordinates[routeCoordinates.length - 1]} title="End">
                                <MapPin type="end" />
                            </Marker>
                            <RoutePolyline coordinates={routeCoordinates} />
                        </>
                    )}
                </MapViewComponent>
            </View>

            <View style={[styles.detailCard, dynamicStyles.card]}>
                <Detail label="Trip ID" value={trip.id ?? 'N/A'} icon="barcode" textStyle={dynamicStyles.text} />
                <Detail label="Start Location" value={trip.startLocation ?? 'N/A'} icon="location" textStyle={dynamicStyles.text} />
                <Detail label="End Location" value={trip.endLocation ?? 'N/A'} icon="flag" textStyle={dynamicStyles.text} />
            </View>

            <View style={[styles.detailCard, dynamicStyles.card]}>
                <Detail label="Date" value={trip.date ?? 'N/A'} icon="calendar" textStyle={dynamicStyles.text} />
                <Detail label="Time" value={`${trip.startTime ?? 'N/A'} – ${trip.endTime ?? 'N/A'}`} icon="time" textStyle={dynamicStyles.text} />
                <Detail label="Distance" value={trip.distance ?? 'N/A'} icon="walk" textStyle={dynamicStyles.text} />
                <Detail label="Duration" value={trip.duration ?? 'N/A'} icon="hourglass" textStyle={dynamicStyles.text} />
            </View>
        </ScrollView>
    );
};

const Detail = ({
    label,
    value,
    icon,
    textStyle,
}: {
    label: string;
    value: string;
    icon: string;
    textStyle: any;
}) => (
    <View style={styles.detailRow}>
        <Ionicons name={icon} size={20} color={textStyle.color} style={{ width: 28 }} />
        <View style={styles.detailTextContainer}>
            <Text style={[styles.detailLabel, textStyle]}>{label}</Text>
            <Text style={[styles.detailValue, textStyle]}>{value}</Text>
        </View>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    title: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        paddingVertical: 24,
    },
    mapContainer: {
        height: 280,
        borderRadius: 16,
        marginHorizontal: 16,
        overflow: 'hidden',
        marginBottom: 24,
        elevation: 3,
        borderWidth: 1,
    },
    detailCard: {
        marginHorizontal: 16,
        marginBottom: 20,
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 2,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    detailTextContainer: {
        marginLeft: 10,
    },
    detailLabel: {
        fontSize: 13,
        fontWeight: '500',
        opacity: 0.7,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
    },
    chevron: {
        marginHorizontal: 4,
    },
});

export default TripDetailsScreen;
