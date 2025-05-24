import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
// Components Imports
import RouteCard from '../../components/RouteCard';
import Loader from '../../components/Loader';
import MapViewComponent from '../../modules/map/components/MapViewComponent';
import CarMarker from '../../modules/map/components/CarMarker';
import MapPin from '../../modules/map/components/MapPin';
import SearchBar from '../../modules/map/components/SearchBar';
import RoutePolyline from '../../modules/map/components/RoutePolyLine';
//Map Imports
import { useMap } from '../../modules/map/hooks/useMap';
import { useLocationTracking } from '../../modules/map/hooks/useLocationTracking';
import { useRouting } from '../../modules/map/hooks/useRouting';
import { useMapStore, MapMarker as AppMapMarker } from '../../modules/map/store/useMapStore';
import mapApiService from '../../modules/map/services/mapApiServices';
import { regionFromCoordinates } from '../../modules/map/utils/mapHelpers';
// Store Imports
import { useTheme } from '../../hooks/useTheme';
import { useTripStore } from '../../modules/map/store/useTripStore';

import { gMapsApiKey } from '@/APIkeys';

const initialMapRegion = {
    latitude: 14.8433,
    longitude: 120.8134,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};

export default function DashboardScreen() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const { trips, isLoading: tripsIsLoading, error: tripsError, fetchTrips, getRecentTrips } = useTripStore();
    const recentTrips = getRecentTrips(5);

    const [startPointQuery, setStartPointQuery] = useState('');
    const [destinationQuery, setDestinationQuery] = useState('');

    const { setMapRef, onRegionChangeComplete, animateToRegion } = useMap();
    const { currentLocation, getSingleLocation: fetchDeviceLocation, locationPermissionStatus } = useLocationTracking();
    const { fetchAndDisplayRoute, isFetchingRoute } = useRouting();

    const {
        markers: storeMarkers,
        startPoint,
        destinationPoint,
        routes,
        setStartPoint,
        setDestinationPoint,
        currentRegion: storeMapRegion,
        setCurrentRegion: setStoreCurrentRegion,
        clearRoutes,
    } = useMapStore();

    // Fetch initial data and set map region
    useEffect(() => {
        if (trips.length === 0 && !tripsIsLoading && !tripsError) {
            fetchTrips();
        }
        if (!storeMapRegion) {
            if (locationPermissionStatus === 'granted') {
                fetchDeviceLocation().then(loc => {
                    const region = loc
                        ? {
                              latitude: loc.coords.latitude,
                              longitude: loc.coords.longitude,
                              latitudeDelta: 0.0922,
                              longitudeDelta: 0.0421,
                          }
                        : initialMapRegion;
                    setStoreCurrentRegion(region);
                    animateToRegion(region);
                });
            } else {
                setStoreCurrentRegion(initialMapRegion);
            }
        }
    }, [
        trips.length, tripsIsLoading, tripsError, fetchTrips,
        fetchDeviceLocation, locationPermissionStatus,
        animateToRegion, storeMapRegion, setStoreCurrentRegion
    ]);

    // Geocode address and set map points
    const handleGeocodeAndSetPoint = useCallback(async (query: string, type: 'start' | 'destination') => {
        if (!query.trim()) {
            if (type === 'start') setStartPoint(null);
            else setDestinationPoint(null);
            return;
        }

        try {
            const geocoded = await mapApiService.geocode(query);
            if (geocoded) {
                const newMarker: AppMapMarker = {
                    id: `${type}Point`,
                    coordinate: geocoded.coordinate,
                    title: geocoded.formattedAddress,
                    pinColor: type === 'start' ? colors.success : colors.error,
                };
                if (type === 'start') setStartPoint(newMarker);
                else setDestinationPoint(newMarker);
                animateToRegion({ ...geocoded.coordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 });
            } else {
                Alert.alert("Geocode Error", `Could not find location for "${query}"`);
                if (type === 'start') setStartPoint(null);
                else setDestinationPoint(null);
            }
        } catch (error) {
            console.error("Geocoding failed:", error);
            Alert.alert("Error", "An error occurred during geocoding.");
        }
    }, [setStartPoint, setDestinationPoint, animateToRegion, colors.success, colors.error]);

    // Fetch and display route when points are set
    useEffect(() => {
        if (startPoint && destinationPoint) {
            clearRoutes();
            fetchAndDisplayRoute(startPoint.coordinate, destinationPoint.coordinate);
        } else if (routes.length > 0) {
            clearRoutes();
        }
    }, [startPoint, destinationPoint, fetchAndDisplayRoute, clearRoutes, routes.length]);

    // Adjust map region to fit markers or center on current location
    useEffect(() => {
        const activePoints = [startPoint, destinationPoint].filter(p => p !== null) as AppMapMarker[];
        if (activePoints.length > 0) {
            const coordinates = activePoints.map(p => p.coordinate);
            const newRegion = regionFromCoordinates(coordinates, 0.5);
            if (newRegion) {
                animateToRegion(newRegion);
            }
        } else if (currentLocation && !storeMapRegion) { // Only animate if no region is set
            animateToRegion({ ...currentLocation.coords, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
        }
    }, [startPoint, destinationPoint, currentLocation, animateToRegion, storeMapRegion]);

    const handleRouteCardPress = (id: string) => {
        router.push(`/(tabs)/trips/${id}`);
    };

    const handleClearInputs = () => {
        setStartPointQuery('');
        setDestinationQuery('');
        setStartPoint(null);
        setDestinationPoint(null);
        clearRoutes();
        if (currentLocation) {
             animateToRegion({ ...currentLocation.coords, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
        } else {
            animateToRegion(initialMapRegion);
        }
    };


    const dynamicStyles = StyleSheet.create({
        flexContainer: { backgroundColor: colors.background },
        planningContainer: { backgroundColor: colors.card },
        mapInfoButton: { backgroundColor: colors.card },
        mapInfoIcon: { color: colors.text },
        previousRoutesContainer: { backgroundColor: colors.card },
        previousTitle: { color: colors.text },
        arrowButton: { backgroundColor: colors.background },
        arrowIcon: { color: colors.text },
        inputContainer: { backgroundColor: colors.inputBackground, borderColor: colors.border },
        timeButton: { backgroundColor: colors.secondary },
        timeText: { color: colors.background },
        settingsButton: { backgroundColor: colors.primary },
        mapContainerBackground: { backgroundColor: colors.border },
        loadingOverlayBackground: { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(100,100,100,0.3)' },
        noTripsText: { paddingHorizontal: 20, color: colors.text, opacity: 0.7 },
    });

    return (
        <KeyboardAvoidingView
            style={[styles.flexContainer, dynamicStyles.flexContainer]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} // Adjust as needed
        >
            <ScrollView
                style={styles.flexContainer}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Planning Section */}
                <View style={[styles.planningContainer, dynamicStyles.planningContainer]}>
                    <SearchBar
                        placeholder="Current Location / Start Point"
                        value={startPointQuery}
                        onChangeText={setStartPointQuery}
                        onSearchSubmit={() => handleGeocodeAndSetPoint(startPointQuery, 'start')}
                        iconName="navigate-circle-outline"
                        style={dynamicStyles.inputContainer}
                    />
                    <SearchBar
                        placeholder="Where are you going?"
                        value={destinationQuery}
                        onChangeText={setDestinationQuery}
                        onSearchSubmit={() => handleGeocodeAndSetPoint(destinationQuery, 'destination')}
                        iconName="location-outline"
                        style={dynamicStyles.inputContainer}
                    />
                    <View style={styles.optionsRow}>
                        <TouchableOpacity style={[styles.timeButtonBase, dynamicStyles.timeButton]}>
                            <Ionicons name="time-outline" size={18} color={dynamicStyles.timeText.color} />
                            <Text style={[styles.timeTextBase, dynamicStyles.timeText]}>Now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.timeButtonBase, dynamicStyles.timeButton]} onPress={handleClearInputs}>
                            <Ionicons name="close-circle-outline" size={18} color={dynamicStyles.timeText.color} />
                            <Text style={[styles.timeTextBase, dynamicStyles.timeText]}>Clear</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modeButtonBase, { backgroundColor: colors.secondary }]}>
                            <Ionicons name="car-sport-outline" size={22} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.settingsButtonBase, dynamicStyles.settingsButton]}>
                            <Ionicons name="options-outline" size={22} color={'#FFFFFF'} />

                        </TouchableOpacity>
                    </View>
                </View>

                {/* Map Section */}
                <View style={[styles.mapContainer, dynamicStyles.mapContainerBackground]}>
                    <MapViewComponent
                        ref={setMapRef}
                        initialRegion={storeMapRegion || initialMapRegion}
                        onRegionChangeComplete={onRegionChangeComplete}
                        showsUserLocation={locationPermissionStatus === 'granted'}
                        showsMyLocationButton={false}
                    >
                        {storeMarkers.map(marker => (
                            <Marker
                                key={marker.id}
                                coordinate={marker.coordinate}
                                title={marker.title}
                                description={marker.description}
                                pinColor={marker.pinColor}
                            >
                                {(marker.id === 'startPoint' || marker.id === 'destinationPoint') ?
                                    <MapPin type={marker.id === 'startPoint' ? 'start' : 'end'} size={36} />
                                    : <CarMarker coordinate={marker.coordinate} carName={marker.title} />
                                }
                            </Marker>
                        ))}
                        {routes.map(route => (
                            <RoutePolyline key={route.id} coordinates={route.coordinates} />
                        ))}
                    </MapViewComponent>
                    <TouchableOpacity
                        style={[styles.mapInfoButton, dynamicStyles.mapInfoButton]}
                        onPress={() => currentLocation && animateToRegion({ ...currentLocation.coords, latitudeDelta: 0.02, longitudeDelta: 0.01 })}
                    >
                        <Ionicons name="navigate-circle-outline" size={24} color={dynamicStyles.mapInfoIcon.color} />
                    </TouchableOpacity>
                    {isFetchingRoute && (
                        <View style={[styles.loadingOverlay, dynamicStyles.loadingOverlayBackground]}>
                            <Loader text="Fetching route..." />
                        </View>
                    )}
                </View>

                {/* Recent Trips Section */}
                <View style={[styles.previousRoutesContainer, dynamicStyles.previousRoutesContainer]}>
                    <View style={styles.previousHeader}>
                        <Text style={[styles.previousTitle, dynamicStyles.previousTitle]}>Recent Trips</Text>
                        <Link href="/(tabs)/trips" asChild>
                            <TouchableOpacity style={[styles.arrowButton, dynamicStyles.arrowButton]}>
                                <Ionicons name="arrow-forward-outline" size={24} color={dynamicStyles.arrowIcon.color} />
                            </TouchableOpacity>
                        </Link>
                    </View>
                    {tripsIsLoading && recentTrips.length === 0 ? (
                        <Loader size="small" color={colors.primary} />
                    ) : recentTrips.length > 0 ? (
                        <FlatList
                            data={recentTrips}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <RouteCard
                                    startTime={item.startTime}
                                    endTime={item.endTime}
                                    startLocation={item.startLocation}
                                    endLocation={item.endLocation}
                                    onPress={() => handleRouteCardPress(item.id)}
                                />
                            )}
                            contentContainerStyle={styles.flatListContent}
                        />
                    ) : (
                        <Text style={dynamicStyles.noTripsText}>
                            No recent trips yet.
                        </Text>
                    )}
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    flexContainer: { flex: 1 },
    scrollContent: { paddingBottom: 20 },
    planningContainer: {
        marginHorizontal: 20,
        marginTop: 20, // Space from the top (or screen header)
        marginBottom: 10,
        borderRadius: 20,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Use space-between for better distribution
        alignItems: 'center',
        marginTop: 15,
    },
    timeButtonBase: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 5, // Add some margin between buttons
    },
    timeTextBase: { marginLeft: 5, fontSize: 14 },
    modeButtonBase: { padding: 8, borderRadius: 20 },
    settingsButtonBase: { padding: 10, borderRadius: 10 },
    mapContainer: {
        height: 350,
        marginHorizontal: 20,
        borderRadius: 15,
        overflow: 'hidden',
        position: 'relative',
        marginTop: 10,
    },
    mapInfoButton: {
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 8,
        borderRadius: 20,
    },
    previousRoutesContainer: {
        marginHorizontal: 20,
        marginTop: 20,
        paddingVertical: 20,
        borderRadius: 20,
    },
    previousHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    previousTitle: { fontSize: 18, fontWeight: 'bold' },
    arrowButton: { padding: 8, borderRadius: 15 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    flatListContent: { paddingHorizontal: 20 },
});