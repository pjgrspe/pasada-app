// app/(tabs)/trips/[id].tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
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
import { AddFavoriteModal } from '../../../components/favorites/AddFavoriteModal';
import { useFavoritesStore } from '../../../modules/favorites/store/useFavoritesStore';

const TripDetailsScreen = () => {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors } = useTheme();
    const { getTripById } = useFirestoreTripStore();
    const { createFavorite } = useFavoritesStore();
    const [trip, setTrip] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAddFavoriteModal, setShowAddFavoriteModal] = useState(false);

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
                    console.log('TripDetailsScreen - Trip data loaded:', {
                        id: tripData.id,
                        startTime: tripData.startTime,
                        endTime: tripData.endTime,
                        startTimeType: typeof tripData.startTime,
                        endTimeType: typeof tripData.endTime,
                        fullData: tripData
                    });
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
        };        loadTrip();
    }, [id, getTripById]);

    // Handler for saving trip as favorite
    const handleSaveFavorite = async (name: string, tags: string[]) => {
        if (!trip) return;

        try {
            // Extract location data from trip
            const startLocation = {
                name: trip.startLocation?.name || trip.startLocation || 'Unknown Start',
                latitude: trip.startLocation?.latitude || trip.startCoordinate?.latitude || 0,
                longitude: trip.startLocation?.longitude || trip.startCoordinate?.longitude || 0,
                placeId: trip.startLocation?.placeId,
            };

            const endLocation = {
                name: trip.endLocation?.name || trip.endLocation || 'Unknown End', 
                latitude: trip.endLocation?.latitude || trip.endCoordinate?.latitude || 0,
                longitude: trip.endLocation?.longitude || trip.endCoordinate?.longitude || 0,
                placeId: trip.endLocation?.placeId,
            };

            const favoriteId = await createFavorite(name, startLocation, endLocation, tags);
            
            if (favoriteId) {
                Alert.alert('Success', 'Trip saved to favorites!');
            } else {
                Alert.alert('Error', 'Failed to save favorite. Please try again.');
            }
        } catch (error) {
            console.error('Error saving favorite:', error);
            Alert.alert('Error', 'Failed to save favorite. Please try again.');
        }
    };

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

    // Format helper functions - SIMPLIFIED since data is already formatted
    const formatTimestamp = (timestamp: any, format: 'date' | 'time' = 'date') => {
        if (!timestamp) return 'N/A';
        
        // If it's already a formatted string, return it
        if (typeof timestamp === 'string') {
            // Handle special cases
            if (timestamp === 'In progress') return timestamp;
            
            // If it's already formatted time (contains AM/PM), return as is for time format
            if (format === 'time' && (timestamp.includes('AM') || timestamp.includes('PM'))) {
                return timestamp;
            }
            
            // If it's a date string like "2024-05-30", format it
            if (format === 'date' && timestamp.includes('-')) {
                try {
                    const date = new Date(timestamp);
                    if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString([], { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                        });
                    }
                } catch (error) {
                    console.log('Error parsing date string:', error);
                }
            }
            
            // For other time requests on date strings, try to extract time
            if (format === 'time' && timestamp.includes('-')) {
                // This might be a date string being requested for time - return N/A
                return 'N/A';
            }
            
            // Return as is if we can't determine the format
            return timestamp;
        }
        
        // Handle Firestore Timestamp objects (if any raw data comes through)
        try {
            let date;
            
            if (timestamp && typeof timestamp.toDate === 'function') {
                date = timestamp.toDate();
            } else if (timestamp && timestamp.seconds !== undefined) {
                date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
            } else if (typeof timestamp === 'number') {
                date = new Date(timestamp);
            } else if (timestamp instanceof Date) {
                date = timestamp;
            } else {
                console.log('formatTimestamp - Unhandled timestamp type:', typeof timestamp, timestamp);
                return 'N/A';
            }

            if (!date || isNaN(date.getTime())) {
                console.log('formatTimestamp - Invalid date created from:', timestamp);
                return 'N/A';
            }
            
            if (format === 'time') {
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            } else {
                return date.toLocaleDateString([], { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                });
            }
        } catch (error) {
            console.log('formatTimestamp - Error:', error, 'Input:', timestamp);
            return 'N/A';
        }
    };

    const formatDistance = (distance: number | string) => {
        // Handle if distance is already formatted as string
        if (typeof distance === 'string') {
            return distance;
        }
        if (!distance || isNaN(distance)) return 'N/A';
        return `${(distance / 1000).toFixed(1)} km`;
    };

    const formatDuration = (duration: number | string) => {
        // Handle if duration is already formatted as string
        if (typeof duration === 'string') {
            return duration;
        }
        if (!duration || isNaN(duration)) return 'N/A';
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

    // Get location names with proper fallbacks - FIXED
    const startLocationName = trip.startLocation?.name || trip.startLocation || 'Unknown Start';
    const endLocationName = trip.endLocation?.name || trip.endLocation || 'Unknown End';

    return (
        <ScrollView style={[styles.container, dynamicStyles.background]}>
            <View style={styles.titleContainer}>
                <Text style={[styles.title, dynamicStyles.text]}>
                    {startLocationName}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} style={styles.chevron} />
                <Text style={[styles.title, dynamicStyles.text]}>
                    {endLocationName}
                </Text>
            </View>
              {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: colors.card }]}>
                <Text style={[styles.statusText, getStatusStyle(trip.status)]}>
                    {trip.status?.toUpperCase() || 'UNKNOWN'}
                </Text>
            </View>

            {/* Favorite Button */}
            <View style={styles.actionButtonContainer}>
                <TouchableOpacity
                    style={[styles.favoriteButton, { backgroundColor: colors.primary }]}
                    onPress={() => setShowAddFavoriteModal(true)}
                >
                    <Ionicons name="heart-outline" size={20} color="white" />
                    <Text style={styles.favoriteButtonText}>Add to Favorites</Text>
                </TouchableOpacity>
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
                <Detail label="Start Location" value={startLocationName} icon="location" textStyle={dynamicStyles.text} />
                <Detail label="End Location" value={endLocationName} icon="flag" textStyle={dynamicStyles.text} />
            </View>

            {/* Trip Details */}
            <View style={[styles.detailCard, dynamicStyles.card]}>
                <Detail label="Date" value={trip.date || formatTimestamp(trip.startTime)} icon="calendar" textStyle={dynamicStyles.text} />
                <Detail 
                    label="Time" 
                    value={`${trip.startTime || formatTimestamp(trip.startTime, 'time')} – ${trip.endTime || 'In progress'}`} 
                    icon="time" 
                    textStyle={dynamicStyles.text} 
                />
                <Detail label="Distance" value={trip.distance || formatDistance(trip.totalDistance)} icon="walk" textStyle={dynamicStyles.text} />
                <Detail 
                    label="Duration" 
                    value={trip.duration || formatDuration(trip.actualDuration || trip.estimatedDuration)} 
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
                        />                    )}
                </View>
            )}

            {/* Add Favorite Modal */}
            <AddFavoriteModal
                visible={showAddFavoriteModal}
                onClose={() => setShowAddFavoriteModal(false)}
                onSave={handleSaveFavorite}
                startLocation={{
                    name: trip?.startLocation?.name || trip?.startLocation || 'Unknown Start',
                    latitude: trip?.startLocation?.latitude || trip?.startCoordinate?.latitude || 0,
                    longitude: trip?.startLocation?.longitude || trip?.startCoordinate?.longitude || 0,
                    placeId: trip?.startLocation?.placeId,
                }}
                endLocation={{
                    name: trip?.endLocation?.name || trip?.endLocation || 'Unknown End',
                    latitude: trip?.endLocation?.latitude || trip?.endCoordinate?.latitude || 0,
                    longitude: trip?.endLocation?.longitude || trip?.endCoordinate?.longitude || 0,
                    placeId: trip?.endLocation?.placeId,
                }}
            />
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
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
        paddingHorizontal: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        flex: 1,
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
    },    chevron: {
        marginHorizontal: 8,
    },
    actionButtonContainer: {
        marginHorizontal: 16,
        marginBottom: 16,
        alignItems: 'center',
    },
    favoriteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        minWidth: 160,
    },
    favoriteButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});

export default TripDetailsScreen;
