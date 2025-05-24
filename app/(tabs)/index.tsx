// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Marker } from 'react-native-maps'; // Import Marker
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';

// Components from your global components folder
import RouteCard from '../../components/RouteCard';
import Loader from '../../components/Loader';

// New Map Module imports
import MapViewComponent from '../../modules/map/components/MapViewComponent';
import CarMarker from '../../modules/map/components/CarMarker';
import MapPin from '../../modules/map/components/MapPin';
import SearchBar from '../../modules/map/components/SearchBar';
import RoutePolyline from '../../modules/map/components/RoutePolyLine'; // Import RoutePolyline

import { useMap } from '../../modules/map/hooks/useMap';
import { useLocationTracking } from '../../modules/map/hooks/useLocationTracking';
import { useRouting } from '../../modules/map/hooks/useRouting';
import { useMapStore, MapMarker as AppMapMarker } from '../../modules/map/store/useMapStore'; // Import MapMarker type
import mapApiService from '../../modules/map/services/mapApiServices';
import { regionFromCoordinates } from '../../modules/map/utils/mapHelpers';


import { useTheme } from '../../hooks/useTheme';
import { useTripStore } from '../../store/useTripStore';

const initialMapRegion = { // Default or last known region
    latitude: 14.8433, // Malolos
    longitude: 120.8134,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};

const carMarkersData = [ // Example data
    { id: 'car1', coordinate: { latitude: 14.8450, longitude: 120.8100 }, carName: 'CAR-001' },
    { id: 'car2', coordinate: { latitude: 14.8400, longitude: 120.8150 }, carName: 'CAR-007' },
];

export default function DashboardScreen() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme();
    const { trips, isLoading: tripsIsLoading, error: tripsError, fetchTrips, getRecentTrips } = useTripStore();
    const recentTrips = getRecentTrips(5);

    // Search queries
    const [startPointQuery, setStartPointQuery] = useState('');
    const [destinationQuery, setDestinationQuery] = useState('');

    const { setMapRef, currentRegion: mapHookRegion, onRegionChangeComplete, animateToRegion } = useMap();
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
        addMarker,
        clearRoutes,
        clearRoutePoints
    } = useMapStore();


    useEffect(() => {
        if (trips.length === 0 && !tripsIsLoading && !tripsError) {
            fetchTrips();
        }
        if (!currentLocation && locationPermissionStatus === 'granted' && !storeMapRegion) {
            fetchDeviceLocation().then(loc => {
                if (loc) {
                    const region = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        latitudeDelta: 0.0922,
                        longitudeDelta: 0.0421,
                    };
                    setStoreCurrentRegion(region);
                    animateToRegion(region); // Animate map to current location
                } else {
                     setStoreCurrentRegion(initialMapRegion); // Fallback to default
                }
            });
        } else if (!storeMapRegion) {
             setStoreCurrentRegion(initialMapRegion); // Fallback if no permission or location
        }
    }, [
        trips.length, tripsIsLoading, tripsError, fetchTrips,
        currentLocation, fetchDeviceLocation, locationPermissionStatus,
        animateToRegion, storeMapRegion, setStoreCurrentRegion
    ]);

    const handleGeocodeAndSetPoint = useCallback(async (query: string, type: 'start' | 'destination') => {
        if (!query.trim()) {
            if (type === 'start') setStartPoint(null);
            if (type === 'destination') setDestinationPoint(null);
            return;
        }

        const geocoded = await mapApiService.geocode(query);
        if (geocoded) {
            const newMarker: AppMapMarker = {
                id: type === 'start' ? 'startPoint' : 'destinationPoint',
                coordinate: geocoded.coordinate,
                title: geocoded.formattedAddress,
                pinColor: type === 'start' ? colors.success : colors.error, // Example colors
            };
            if (type === 'start') {
                setStartPoint(newMarker);
            } else {
                setDestinationPoint(newMarker);
            }
            // Animate to the new marker
            animateToRegion({ ...geocoded.coordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 });
        } else {
            Alert.alert("Geocode Error", `Could not find location for "${query}"`);
            if (type === 'start') setStartPoint(null);
            if (type === 'destination') setDestinationPoint(null);
        }
    }, [setStartPoint, setDestinationPoint, animateToRegion, colors.success, colors.error]);


    // Effect to trigger routing when both points are set
    useEffect(() => {
        if (startPoint && destinationPoint) {
            clearRoutes(); // Clear previous routes
            fetchAndDisplayRoute(startPoint.coordinate, destinationPoint.coordinate);
        }
        // If one point is cleared, also clear routes
        if ((!startPoint || !destinationPoint) && routes.length > 0) {
            clearRoutes();
        }
    }, [startPoint, destinationPoint, fetchAndDisplayRoute, clearRoutes, routes.length]);

    // Effect to adjust map region when start/destination points change
     useEffect(() => {
        const activePoints = [startPoint, destinationPoint].filter(p => p !== null) as AppMapMarker[];
        if (activePoints.length > 0) {
            const coordinates = activePoints.map(p => p.coordinate);
            const newRegion = regionFromCoordinates(coordinates, 0.5); // 50% padding
            if (newRegion) {
                animateToRegion(newRegion);
            }
        } else if (currentLocation) { // Fallback to current location if no points
            animateToRegion({ ...currentLocation.coords, latitudeDelta: 0.0922, longitudeDelta: 0.0421 });
        }
    }, [startPoint, destinationPoint, currentLocation, animateToRegion]);


    const handleRouteCardPress = (id: string) => {
        router.push(`/(tabs)/trips/${id}`);
    };

    const dynamicStyles = StyleSheet.create({
        flexContainer: { backgroundColor: colors.background },
        headerBar: { backgroundColor: isDarkMode ? colors.card : '#FFD700', },
        headerTitle: { color: isDarkMode ? colors.text : '#333' },
        planningContainer: { backgroundColor: colors.card, }, // Use theme color
        mapInfoButton: { backgroundColor: colors.card },
        mapInfoIcon: { color: colors.text },
        previousRoutesContainer: { backgroundColor: colors.card },
        previousTitle: { color: colors.text },
        arrowButton: { backgroundColor: colors.background },
        arrowIcon: { color: colors.text },
        inputStyle: { color: colors.text, backgroundColor: colors.inputBackground }, // For SearchBar inputs
        inputContainer: { backgroundColor: colors.inputBackground, borderColor: colors.border }
    });

    return (
        <KeyboardAvoidingView
            style={[styles.flexContainer, dynamicStyles.flexContainer]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} // Adjust as needed
        >
            <View style={[styles.flexContainer, dynamicStyles.flexContainer]}>
                <View style={[styles.headerBar, dynamicStyles.headerBar]}>
                    <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Plan & Map</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')}>
                        <Ionicons name="notifications-outline" size={26} color={dynamicStyles.headerTitle.color} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={[styles.flexContainer, dynamicStyles.flexContainer]}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.planningContainer, dynamicStyles.planningContainer]}>
                        <SearchBar
                            placeholder="Current Location / Start Point"
                            value={startPointQuery}
                            onChangeText={setStartPointQuery}
                            onSearchSubmit={() => handleGeocodeAndSetPoint(startPointQuery, 'start')}
                            iconName="navigate-circle-outline"
                            style={dynamicStyles.inputContainer}
                            // style prop on Input inside SearchBar needs to target text color:
                            // textStyle={dynamicStyles.inputStyle} // Add textStyle to SearchBar if needed
                        />
                        <View style={styles.separatorLine}></View>
                        <SearchBar
                            placeholder="Where are you going?"
                            value={destinationQuery}
                            onChangeText={setDestinationQuery}
                            onSearchSubmit={() => handleGeocodeAndSetPoint(destinationQuery, 'destination')}
                            iconName="location-outline"
                            style={dynamicStyles.inputContainer}
                        />
                        <View style={styles.optionsRow}>
                            <TouchableOpacity style={styles.timeButton}>
                                 <Ionicons name="time-outline" size={18} color="#FFF" />
                                 <Text style={styles.timeText}>Now</Text>
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.timeButton} onPress={() => {
                                 clearRoutePoints();
                                 setStartPointQuery('');
                                 setDestinationQuery('');
                             }}>
                                 <Ionicons name="close-circle-outline" size={18} color="#FFF" />
                                 <Text style={styles.timeText}>Clear</Text>
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.modeButton}>
                                <Ionicons name="car-sport-outline" size={22} color={colors.text} />
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.settingsButton}>
                                <Ionicons name="options-outline" size={22} color={colors.text} />
                             </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.mapContainer}>
                        <MapViewComponent
                          ref={setMapRef}
                          initialRegion={storeMapRegion || initialMapRegion}
                          onRegionChangeComplete={onRegionChangeComplete}
                          showsUserLocation={locationPermissionStatus === 'granted'} // Show user dot if permission given
                          showsMyLocationButton={false} // We can add a custom one if needed
                        >
                            {/* Display all markers from the store */}
                            {storeMarkers.map(marker => (
                                <Marker
                                    key={marker.id}
                                    coordinate={marker.coordinate}
                                    title={marker.title}
                                    description={marker.description}
                                    pinColor={marker.pinColor} // Works with default marker, or use MapPin for custom
                                >
                                   {/* Example: Use MapPin for route points, CarMarker for others */}
                                   {(marker.id === 'startPoint' || marker.id === 'destinationPoint') ?
                                        <MapPin type={marker.id === 'startPoint' ? 'start' : 'end'} size={36}/>
                                        : <CarMarker coordinate={marker.coordinate} carName={marker.title} />
                                    }
                                </Marker>
                            ))}

                            {/* Display routes from the store */}
                            {routes.map(route => (
                                <RoutePolyline key={route.id} coordinates={route.coordinates} />
                            ))}

                        </MapViewComponent>
                        <TouchableOpacity style={[styles.mapInfoButton, dynamicStyles.mapInfoButton]} onPress={() => currentLocation && animateToRegion({...currentLocation.coords, latitudeDelta: 0.02, longitudeDelta: 0.01})}>
                            <Ionicons name="navigate-circle-outline" size={24} color={dynamicStyles.mapInfoIcon.color} />
                        </TouchableOpacity>
                         {isFetchingRoute && <View style={styles.loadingOverlay}><Loader text="Fetching route..."/></View>}
                    </View>

                    <View style={[styles.previousRoutesContainer, dynamicStyles.previousRoutesContainer]}>
                       {/* ... (rest of the Previous Routes section remains same) ... */}
                         <View style={styles.previousHeader}>
                            <Text style={[styles.previousTitle, dynamicStyles.previousTitle]}>Recent Trips</Text>
                            <Link href="/(tabs)/trips" asChild>
                                <TouchableOpacity style={[styles.arrowButton, dynamicStyles.arrowButton]}>
                                    <Ionicons name="arrow-forward-outline" size={24} color={dynamicStyles.arrowIcon.color} />
                                </TouchableOpacity>
                            </Link>
                        </View>
                        {tripsIsLoading && recentTrips.length === 0 ? <Loader size="small" color={colors.primary}/> : null}
                        {recentTrips.length > 0 ? (
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
                                contentContainerStyle={{ paddingHorizontal: 20 }}
                            />
                        ) : (
                           !tripsIsLoading && <Text style={{ paddingHorizontal: 20, color: colors.text, opacity: 0.7 }}>No recent trips yet.</Text>
                        )}
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}


const styles = StyleSheet.create({
    flexContainer: { flex: 1 },
    scrollContent: { paddingBottom: 20 },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'android' ? 30 : 50,
        paddingBottom: 10
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    planningContainer: {
        marginHorizontal: 20,
        marginTop: 20,
        marginBottom: 10,
        borderRadius: 20,
        padding: 15, // Reduced padding
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    separatorLine: { height: 1, backgroundColor: '#4A4A4C', marginVertical: 8 }, // Simplified
    optionsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 15 },
    timeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A4A4C', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    timeText: { color: '#FFF', marginLeft: 5, fontSize: 14 },
    modeButton: { backgroundColor: '#4A4A4C', padding: 8, borderRadius: 20 },
    settingsButton: { backgroundColor: '#FF8C00', padding: 10, borderRadius: 10 },
    mapContainer: { height: 350, marginHorizontal: 20, borderRadius: 15, overflow: 'hidden', backgroundColor: '#E0E0E0', position: 'relative', marginTop: 10 },
    mapInfoButton: { position: 'absolute', top: 10, right: 10, padding: 8, borderRadius: 20 },
    previousRoutesContainer: { marginTop: 20, paddingVertical: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    previousHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
    previousTitle: { fontSize: 18, fontWeight: 'bold' },
    arrowButton: { padding: 8, borderRadius: 15 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    }
});