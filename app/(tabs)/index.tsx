// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Alert, Button as RNButton } from 'react-native';
import { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';

import RouteCard from '@/components/RouteCard';
import Loader from '@/components/Loader';

import MapViewComponent from '@/modules/map/components/MapViewComponent';
// import CarMarker from '@/modules/map/components/CarMarker'; // Not used in this specific test flow
import MapPin from '@/modules/map/components/MapPin';
import SearchBar from '@/modules/map/components/SearchBar';
import RoutePolyline from '@/modules/map/components/RoutePolyLine';

import { useMap } from '@/modules/map/hooks/useMap';
import { useLocationTracking } from '@/modules/map/hooks/useLocationTracking';
import { useRouting } from '@/modules/map/hooks/useRouting';
import { useMapStore, MapMarker as AppMapMarker, Route as MapDisplayRoute } from '@/modules/map/store/useMapStore';
import mapApiService from '@/modules/map/services/mapApiServices';

import { useTheme } from '@/hooks/useTheme';
import { useTripStore } from '@/modules/map/store/useTripStore'; // Adjusted path
import { sampleTrip } from '@/modules/map/utils/DebugTestTrip'; // Adjusted path

const initialMapRegion: Region = {
    latitude: 15.1446,
    longitude: 120.5948,
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

    const { setMapRef, animateToRegion, onRegionChangeComplete } = useMap();
    const { currentLocation, getSingleLocation: fetchDeviceLocation, locationPermissionStatus } = useLocationTracking();

    const { planAndDisplayTrip, isFetchingRoute, currentPlannedTripLegs, clearDisplayedTripInfo } = useRouting();

    const {
        markers: storeMarkers,
        routes,
        currentRegion: storeMapRegion,
        setCurrentRegion: setStoreCurrentRegion,
    } = useMapStore();


    useEffect(() => {
        if (trips.length === 0 && !tripsIsLoading && !tripsError) {
            fetchTrips();
        }
        if (!storeMapRegion) {
             if (currentLocation && locationPermissionStatus === 'granted') {
                const region = {
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.01,
                };
                setStoreCurrentRegion(region);
                if (animateToRegion) animateToRegion(region);
            } else if (locationPermissionStatus === 'granted' && !currentLocation) {
                fetchDeviceLocation().then(loc => {
                    if (loc) {
                        const region = {
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            latitudeDelta: 0.02,
                            longitudeDelta: 0.01,
                        };
                        setStoreCurrentRegion(region);
                        if (animateToRegion) animateToRegion(region);
                    } else {
                         setStoreCurrentRegion(initialMapRegion);
                    }
                });
            } else {
                 setStoreCurrentRegion(initialMapRegion);
            }
        }
    }, [
        trips.length, tripsIsLoading, tripsError, fetchTrips,
        currentLocation, fetchDeviceLocation, locationPermissionStatus,
        animateToRegion, storeMapRegion, setStoreCurrentRegion
    ]);

    const handleGeocodeAndSetPoint = useCallback(async (query: string, type: 'start' | 'destination') => {
        if (!query.trim()) {
            return;
        }
        const geocoded = await mapApiService.geocode(query);
        if (geocoded) {
            const { coordinate, formattedAddress } = geocoded;
            if (type === 'start') {
                setStartPointQuery(formattedAddress);
            } else {
                setDestinationQuery(formattedAddress);
            }
            if (animateToRegion) {
                animateToRegion({ ...coordinate, latitudeDelta: 0.05, longitudeDelta: 0.05 });
            }
        } else {
            Alert.alert("Geocode Error", `Could not find location for "${query}"`);
        }
    }, [animateToRegion]);

    const handleTestTrip = () => {
        console.log("Test button pressed. Planning trip with sample data:", sampleTrip);
        if (sampleTrip.startPoint && sampleTrip.endPoint) {
            planAndDisplayTrip(sampleTrip.startPoint, sampleTrip.endPoint, "Sample Start", "Sample End");
        } else {
            Alert.alert("Test Error", "Sample trip data is incomplete.");
        }
    };

    const handleClearAll = () => {
        useMapStore.getState().clearRoutePoints();
        setStartPointQuery('');
        setDestinationQuery('');
        clearDisplayedTripInfo();
        const targetRegion = currentLocation && currentLocation.coords
            ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude, latitudeDelta: 0.02, longitudeDelta: 0.01 }
            : initialMapRegion;

        if (animateToRegion) animateToRegion(targetRegion);
        else setStoreCurrentRegion(targetRegion);
    };


    const handleRouteCardPress = (id: string) => {
        router.push(`/(tabs)/trips/${id}`);
    };

    const dynamicStyles = StyleSheet.create({
        flexContainer: { backgroundColor: colors.background, flex: 1 },
        headerBar: { backgroundColor: isDarkMode ? colors.card : '#FFD700', },
        headerTitle: { color: isDarkMode ? colors.text : '#333' },
        planningContainer: { backgroundColor: colors.card, },
        mapInfoButton: { backgroundColor: colors.card },
        mapInfoIcon: { color: colors.text },
        previousRoutesContainer: { backgroundColor: colors.card },
        previousTitle: { color: colors.text },
        arrowButton: { backgroundColor: colors.background },
        arrowIcon: { color: colors.text },
        inputStyle: { color: colors.text, backgroundColor: colors.inputBackground },
        inputContainer: { backgroundColor: colors.inputBackground, borderColor: colors.border },
        instructionsContainer: {
            padding: 15,
            backgroundColor: colors.card,
            margin: 10,
            borderRadius: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 2,
        },
        legInstruction: {
            marginBottom: 10,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        legType: {
            fontWeight: 'bold',
            fontSize: 16,
            color: colors.primary,
            marginBottom: 4,
        },
        legDetail: {
            fontSize: 14,
            color: colors.text,
            opacity: 0.8,
        },
        testButtonContainer: {
            marginVertical: 10,
            marginHorizontal: 20,
        }
    });

    return (
        <KeyboardAvoidingView
            style={dynamicStyles.flexContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
            <View style={dynamicStyles.flexContainer}>
                <View style={[styles.headerBar, dynamicStyles.headerBar]}>
                    <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Plan & Map</Text>
                    <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')}>
                        <Ionicons name="notifications-outline" size={26} color={dynamicStyles.headerTitle.color} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={dynamicStyles.flexContainer}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={dynamicStyles.testButtonContainer}>
                        <RNButton title="Test Sample Trip" onPress={handleTestTrip} color={colors.primary} />
                    </View>

                    <View style={[styles.planningContainer, dynamicStyles.planningContainer]}>
                        <SearchBar
                            placeholder="Current Location / Start Point"
                            value={startPointQuery}
                            onChangeText={setStartPointQuery}
                            onSearchSubmit={() => handleGeocodeAndSetPoint(startPointQuery, 'start')}
                            iconName="navigate-circle-outline"
                            style={dynamicStyles.inputContainer}
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
                             <TouchableOpacity style={styles.timeButton} onPress={handleClearAll}>
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
                          showsUserLocation={locationPermissionStatus === 'granted'}
                          showsMyLocationButton={false}
                        >
                            {storeMarkers.map(marker => (
                                <Marker
                                    key={marker.id}
                                    coordinate={marker.coordinate}
                                    title={marker.title}
                                    description={marker.description}
                                >
                                    <MapPin
                                        type={marker.id === 'startPoint' ? 'start' : marker.id === 'destinationPoint' ? 'end' : 'generic'}
                                        color={marker.pinColor}
                                        size={36}
                                    />
                                </Marker>
                            ))}

                            {/* CORRECTED LINE BELOW */}
                            {routes.map((route: MapDisplayRoute) => (
                                <RoutePolyline
                                  key={route.id}
                                  coordinates={route.coordinates}
                                  strokeColor={route.color || (route.routeType === 'walk' ? colors.secondary : colors.primary)}
                                  strokeWidth={route.routeType === 'walk' ? 3 : 6}
                                  lineDashPattern={route.routeType === 'walk' ? [1, 8] : undefined}
                                  zIndex={route.routeType === 'jeepney' ? 1 : 0}
                                />
                            ))}
                        </MapViewComponent>
                        <TouchableOpacity
                            style={[styles.mapInfoButton, dynamicStyles.mapInfoButton]}
                            onPress={() => currentLocation && animateToRegion && animateToRegion({...currentLocation.coords, latitudeDelta: 0.02, longitudeDelta: 0.01})}
                        >
                            <Ionicons name="navigate-circle-outline" size={24} color={dynamicStyles.mapInfoIcon.color} />
                        </TouchableOpacity>
                         {isFetchingRoute && <View style={styles.loadingOverlay}><Loader text="Planning trip..."/></View>}
                    </View>

                    {currentPlannedTripLegs && currentPlannedTripLegs.length > 0 && (
                        <View style={dynamicStyles.instructionsContainer}>
                            <Text style={[styles.previousTitle, dynamicStyles.previousTitle, {marginBottom: 10}]}>Trip Plan:</Text>
                            {currentPlannedTripLegs.map((leg, index) => (
                                <View key={index} style={dynamicStyles.legInstruction}>
                                <Text style={dynamicStyles.legType}>
                                    {leg.type === 'walk' ? '🚶 Walk' : `🚌 Jeepney: ${leg.routeName || leg.routeId}`}
                                </Text>
                                {leg.instructions && <Text style={dynamicStyles.legDetail}>{leg.instructions}</Text>}
                                {typeof leg.distance === 'number' && <Text style={dynamicStyles.legDetail}>Distance: {(leg.distance / 1000).toFixed(1)} km</Text>}
                                {typeof leg.duration === 'number' && <Text style={dynamicStyles.legDetail}>Est. Time: {Math.round(leg.duration / 60)} min</Text>}
                                {leg.startAddress && <Text style={dynamicStyles.legDetail}>From: {leg.startAddress}</Text>}
                                {leg.endAddress && <Text style={dynamicStyles.legDetail}>To: {leg.endAddress}</Text>}
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={[styles.previousRoutesContainer, dynamicStyles.previousRoutesContainer]}>
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
    scrollContent: { paddingBottom: 20, flexGrow: 1 },
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
        marginTop: 10,
        marginBottom: 10,
        borderRadius: 20,
        padding: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    separatorLine: { height: 1, backgroundColor: '#4A4A4C', marginVertical: 8 },
    optionsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: 15 },
    timeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A4A4C', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    timeText: { color: '#FFF', marginLeft: 5, fontSize: 14 },
    modeButton: { backgroundColor: '#4A4A4C', padding: 8, borderRadius: 20 },
    settingsButton: { backgroundColor: '#FF8C00', padding: 10, borderRadius: 10 },
    mapContainer: {
        height: 300,
        marginHorizontal: 20,
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#E0E0E0',
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
        marginTop: 20,
        paddingVertical: 20,
    },
    previousHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15
    },
    previousTitle: { fontSize: 18, fontWeight: 'bold' },
    arrowButton: { padding: 8, borderRadius: 15, },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    }
});
