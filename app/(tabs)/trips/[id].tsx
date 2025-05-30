// app/(tabs)/trips/[id].tsx
import React, { useEffect, useState } from 'react';
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
import { useFirestoreTripStore } from '@/modules/trips/store/useFirestoreTripStore';

const TripDetailsScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const { getTripById } = useFirestoreTripStore();
    const [trip, setTrip] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadTrip = async () => {
            if (!id) {
                setError('No trip ID provided');
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError(null);
                const tripData = await getTripById(id);
                if (tripData) {
                    setTrip(tripData);
                } else {
                    setError('Trip not found');
                }
            } catch (err) {
                console.error('Error loading trip:', err);
                setError('Failed to load trip details');
            } finally {
                setIsLoading(false);
            }
        };

        loadTrip();
    }, [id, getTripById]);

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
        statusActive: { color: colors.primary },
        statusCompleted: { color: colors.success },
        statusCancelled: { color: colors.error },
    });

    // Format helper functions
    const formatTimestamp = (timestamp: any, format: 'date' | 'time' = 'date') => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        
        if (format === 'time') {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString();
    };

    const formatDistance = (distance: number) => {
        if (!distance) return 'N/A';
        return `${(distance / 1000).toFixed(1)} km`;
    };

    const formatDuration = (duration: number) => {
        if (!duration) return 'N/A';
        const minutes = Math.round(duration / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
    };

    if (isLoading) {
        return (
            <View style={[styles.centered, dynamicStyles.background]}>
                <Loader text="Loading trip details..." />
            </View>
        );
    }

    if (error || !trip) {
        return (
            <View style={[styles.centered, dynamicStyles.background]}>
                <Ionicons name="alert-circle-outline" size={60} color={colors.error} />
                <Text style={[styles.errorText, dynamicStyles.error]}>
                    {error || 'Trip not found'}
                </Text>
            </View>
        );
    }

    // Create route coordinates from trip steps
    const routeCoordinates = trip.steps?.flatMap((step: any) => step.coordinates || []) || [];
    
    const initialRegion = routeCoordinates.length > 0
        ? regionFromCoordinates(routeCoordinates, 0.2)
        : {
            latitude: 14.8433,
            longitude: 120.8134,
            latitudeDelta: 0.5,
            longitudeDelta: 0.5,
        };
        
    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'active': return dynamicStyles.statusActive;
            case 'completed': return dynamicStyles.statusCompleted;
            case 'cancelled': return dynamicStyles.statusCancelled;
            default: return dynamicStyles.text;
        }
    };

    return (
        <ScrollView style={[styles.container, dynamicStyles.background]}>
            <Text style={[styles.title, dynamicStyles.text]}>
                {trip.startLocation?.name || 'Unknown Start'}{' '}
                <Ionicons name="chevron-forward" size={20} color={colors.primary} style={styles.chevron} />{' '}
                {trip.endLocation?.name || 'Unknown End'}
            </Text>
            
            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: colors.card }]}>
                <Text style={[styles.statusText, getStatusStyle(trip.status)]}>
                    {trip.status?.toUpperCase() || 'UNKNOWN'}
                </Text>
            </View>

            {/* Map */}
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

            {/* Location Details */}
            <View style={[styles.detailCard, dynamicStyles.card]}>
                <Detail label="Trip ID" value={trip.id || 'N/A'} icon="barcode" textStyle={dynamicStyles.text} />
                <Detail label="Start Location" value={trip.startLocation?.name || 'N/A'} icon="location" textStyle={dynamicStyles.text} />
                <Detail label="End Location" value={trip.endLocation?.name || 'N/A'} icon="flag" textStyle={dynamicStyles.text} />
            </View>

            {/* Trip Details */}
            <View style={[styles.detailCard, dynamicStyles.card]}>
                <Detail label="Date" value={formatTimestamp(trip.startTime)} icon="calendar" textStyle={dynamicStyles.text} />
                <Detail 
                    label="Time" 
                    value={`${formatTimestamp(trip.startTime, 'time')} – ${trip.endTime ? formatTimestamp(trip.endTime, 'time') : 'In progress'}`} 
                    icon="time" 
                    textStyle={dynamicStyles.text} 
                />
                <Detail label="Distance" value={formatDistance(trip.totalDistance)} icon="walk" textStyle={dynamicStyles.text} />
                <Detail 
                    label="Duration" 
                    value={formatDuration(trip.actualDuration || trip.estimatedDuration)} 
                    icon="hourglass" 
                    textStyle={dynamicStyles.text} 
                />
            </View>

            {/* Additional Details (if available) */}
            {(trip.rating || trip.totalFare || trip.notes || (trip.tags && trip.tags.length > 0)) && (
                <View style={[styles.detailCard, dynamicStyles.card]}>
                    {trip.rating && (
                        <Detail 
                            label="Rating" 
                            value={`${'⭐'.repeat(trip.rating)} (${trip.rating}/5)`} 
                            icon="star" 
                            textStyle={dynamicStyles.text} 
                        />
                    )}
                    {trip.totalFare && (
                        <Detail 
                            label="Total Fare" 
                            value={`₱${trip.totalFare}`} 
                            icon="cash" 
                            textStyle={dynamicStyles.text} 
                        />
                    )}
                    {trip.tags && trip.tags.length > 0 && (
                        <Detail 
                            label="Tags" 
                            value={trip.tags.join(', ')} 
                            icon="pricetag" 
                            textStyle={dynamicStyles.text} 
                        />
                    )}
                    {trip.notes && (
                        <Detail 
                            label="Notes" 
                            value={trip.notes} 
                            icon="document-text" 
                            textStyle={dynamicStyles.text} 
                        />
                    )}
                </View>
            )}
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
    centered: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        textAlign: 'center',
        marginVertical: 16,
        paddingHorizontal: 16,
    },
    statusBadge: {
        alignSelf: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginBottom: 16,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
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
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    chevron: {
        marginHorizontal: 4,
    },
});

export default TripDetailsScreen;
