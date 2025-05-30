// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Button as RNButton,
  FlatList,
  ScrollView as HorizontalScrollView,
  ActivityIndicator, // Make sure this is imported
} from 'react-native';
import { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import RouteCard from '@/components/RouteCard';
import Loader from '@/components/Loader';
// TripOptionsDisplayComponent is no longer imported as a whole
import InstructionLegItem from '@/modules/map/components/InstructionLegItem'; // NEW IMPORT
import LoadingStatusDisplay from '@/modules/map/components/LoadingStatusDisplay';
import LocationPickerModal from '@/modules/map/components/LocationPickerModal'; // NEW IMPORT
import { AddFavoriteModal } from '@/components/favorites/AddFavoriteModal';

import MapViewComponent from '@/modules/map/components/MapViewComponent';
import MapPin from '@/modules/map/components/MapPin';
import SearchBar from '@/modules/map/components/SearchBar';
import RoutePolyline from '@/modules/map/components/RoutePolyLine';

import { useMap } from '@/modules/map/hooks/useMap';
import { useLocationTracking } from '@/modules/map/hooks/useLocationTracking';
import { useRouting } from '@/modules/map/hooks/useRouting';
import { useMapStore, Route as MapDisplayRoute, MapMarker as AppMapMarker } from '@/modules/map/store/useMapStore';
import mapApiService from '@/modules/map/services/mapApiServices';
import { Coordinate, PlannedTripLeg } from '@/modules/map/utils/routeTypes';

import { useTheme } from '@/hooks/useTheme';
import { useFirestoreTripStore } from '@/modules/trips/store/useFirestoreTripStore';
import { useFavoritesStore } from '@/modules/favorites/store/useFavoritesStore';
import * as DebugTestTrip from '@/modules/map/utils/DebugTestTrip';
import { Text } from '@/components/Themed';
import { DEBUG_MODE_ENABLED } from '@/modules/map/constants/tripPlanningConstants';
import { useActiveTripStore } from '@/modules/map/store/useActiveTripStore';
import { ActiveTripPanel } from '@/modules/map/components/ActiveTripPanel';
import { useAuth } from '@/modules/auth/hooks/useAuth'; // Import your auth hook
import { CheckpointSilver, CheckpointViolet, Marisol } from '@/modules/map/utils/jeepRoutes';

const initialMapRegion: Region = {
    latitude: 15.1446, 
    longitude: 120.5948,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};

// Helper to generate a summary for a trip option tab
const getTripSummaryForTab = (tripLegs: PlannedTripLeg[]): string => {
    if (!tripLegs || tripLegs.length === 0) return "No details";
    const jeepLegs = tripLegs.filter(leg => leg.type === 'jeepney');
    const walkLegs = tripLegs.filter(leg => leg.type === 'walk');
    const totalWalkDuration = walkLegs.reduce((sum, leg) => sum + (typeof leg.duration === 'number' ? leg.duration : 0), 0);
    const totalWalkMinutes = Math.round(totalWalkDuration / 60);
    const numJeeps = jeepLegs.length;
    let summary = "";
    if (numJeeps > 0) summary += `${numJeeps} Jeep${numJeeps > 1 ? 's' : ''}`;
    if (totalWalkMinutes > 0) summary += `${numJeeps > 0 ? ', ' : ''}${totalWalkMinutes}m walk`;
    if (summary === "") {
      if (walkLegs.length > 0 && totalWalkMinutes > 0) return `${totalWalkMinutes}m walk`;
      return "Details";
    }
    return summary;
};


export default function DashboardScreen() {    
    const router = useRouter();
    const params = useLocalSearchParams();
    const { colors, isDarkMode } = useTheme();
    const { trips, isLoading: tripsIsLoading, error: tripsError, fetchTrips, getRecentTrips } = useFirestoreTripStore();
    const { createFavorite } = useFavoritesStore();
    const recentTrips = getRecentTrips(5);

    const [startPointQuery, setStartPointQuery] = useState('');
    const [destinationQuery, setDestinationQuery] = useState('');

    // Add new state for location picker modal
    const [locationPickerVisible, setLocationPickerVisible] = useState(false);
    const [locationPickerType, setLocationPickerType] = useState<'start' | 'destination'>('start');
      // Add state for favorite modal
    const [favoriteModalVisible, setFavoriteModalVisible] = useState(false);

    // Add state for jeepney route visibility
    const [jeepneyRouteVisibility, setJeepneyRouteVisibility] = useState({
        'checkpoint-silver': false,
        'checkpoint-violet': false,
        'marisol': false
    });

    const { mapRef, setMapRef, animateToRegion, onRegionChangeComplete } = useMap();
    const { currentLocation, getSingleLocation: fetchDeviceLocation, locationPermissionStatus } = useLocationTracking();

    const {
        planAndDisplayTrip,
        isFetchingRoute,
        allTripOptions,
        currentDisplayedTrip,
        selectedTripIndex,
        selectTripOption,
        clearDisplayedTripInfo
    } = useRouting();

    const {
        markers: storeMarkers,
        routes: mapDisplayRoutes,        currentRegion: storeMapRegion,
        setCurrentRegion: setStoreCurrentRegion,
        isLoading: mapIsLoading,
        loadingStatus, // Add this
    } = useMapStore();
    
    const { activeTrip, startTrip } = useActiveTripStore();
    const authState = useAuth(); // Assuming you have an auth hook

    // Create enhanced map display routes that include visible jeepney routes
    const enhancedMapDisplayRoutes = React.useMemo(() => {
        const jeepneyRoutes: MapDisplayRoute[] = [];
          if (jeepneyRouteVisibility['checkpoint-silver']) {
            jeepneyRoutes.push({
                id: 'jeepney-checkpoint-silver',
                coordinates: CheckpointSilver.coordinates.map(coord => ({ latitude: coord.latitude, longitude: coord.longitude })),
                color: CheckpointSilver.color || '#c2cad8',
                routeType: 'jeepney'
            });
        }
        
        if (jeepneyRouteVisibility['checkpoint-violet']) {
            jeepneyRoutes.push({
                id: 'jeepney-checkpoint-violet',
                coordinates: CheckpointViolet.coordinates.map(coord => ({ latitude: coord.latitude, longitude: coord.longitude })),
                color: CheckpointViolet.color || '#5b4dad',
                routeType: 'jeepney'
            });
        }
        
        if (jeepneyRouteVisibility['marisol']) {
            jeepneyRoutes.push({
                id: 'jeepney-marisol',
                coordinates: Marisol.coordinates.map(coord => ({ latitude: coord.latitude, longitude: coord.longitude })),
                color: Marisol.color || '#0abc27',
                routeType: 'jeepney'
            });
        }
        
        return [...mapDisplayRoutes, ...jeepneyRoutes];
    }, [mapDisplayRoutes, jeepneyRouteVisibility]);

    // Handle URL parameters from favorites navigation
    useEffect(() => {
        if (params.startLocation && params.endLocation) {
            try {
                const startLocation = JSON.parse(params.startLocation as string);
                const endLocation = JSON.parse(params.endLocation as string);
                
                setStartPointQuery(startLocation.name);
                setDestinationQuery(endLocation.name);
                  // Clear the URL parameters to prevent re-triggering
                router.replace({ pathname: '/(tabs)' });
            } catch (error) {
                console.error('Error parsing location parameters:', error);
            }
        }
    }, [params.startLocation, params.endLocation, router]);

    // Add location picker handlers
    const handleLocationPickerOpen = useCallback((type: 'start' | 'destination') => {
        setLocationPickerType(type);
        setLocationPickerVisible(true);
    }, []);

    const handleLocationPickerClose = useCallback(() => {
        setLocationPickerVisible(false);
    }, []);    const handleLocationConfirm = useCallback((coordinate: Coordinate, address: string) => {
        if (locationPickerType === 'start') {
            setStartPointQuery(address);
        } else {
            setDestinationQuery(address);
        }
        setLocationPickerVisible(false);
    }, [locationPickerType]);

    // Favorite handlers
    const handleAddToFavorites = useCallback(() => {
        if (!startPointQuery.trim() || !destinationQuery.trim()) {
            Alert.alert('Missing Information', 'Please set both start and destination points before adding to favorites.');
            return;
        }
        setFavoriteModalVisible(true);
    }, [startPointQuery, destinationQuery]);

    const handleSaveFavorite = useCallback(async (name: string, tags: string[]) => {
        try {
            // Get coordinates for start and end locations
            let startCoord: Coordinate | null = null;
            let endCoord: Coordinate | null = null;

            if (startPointQuery.trim() === "My Current Location" && currentLocation) {
                startCoord = currentLocation.coords;
            } else if (startPointQuery.trim()) {
                const geocoded = await mapApiService.geocode(startPointQuery);
                if (geocoded) {
                    startCoord = geocoded.coordinate;
                }
            }

            if (destinationQuery.trim()) {
                const geocoded = await mapApiService.geocode(destinationQuery);
                if (geocoded) {
                    endCoord = geocoded.coordinate;
                }
            }

            if (!startCoord || !endCoord) {
                Alert.alert('Error', 'Could not determine coordinates for the locations.');
                return;
            }

            const startLocation = {
                name: startPointQuery,
                latitude: startCoord.latitude,
                longitude: startCoord.longitude
            };

            const endLocation = {
                name: destinationQuery,
                latitude: endCoord.latitude,
                longitude: endCoord.longitude
            };

            const favoriteId = await createFavorite(name, startLocation, endLocation, tags);
            
            if (favoriteId) {
                Alert.alert('Success', 'Route saved to favorites!');
            } else {
                Alert.alert('Error', 'Failed to save favorite. Please try again.');
            }        } catch (error) {
            console.error('Error saving favorite:', error);
            Alert.alert('Error', 'An unexpected error occurred while saving your favorite.');
        }
    }, [startPointQuery, destinationQuery, currentLocation, createFavorite]);    // Handler for toggling jeepney route visibility
    const handleJeepneyRouteToggle = useCallback((routeId: 'checkpoint-silver' | 'checkpoint-violet' | 'marisol') => {
        setJeepneyRouteVisibility(prev => ({
            ...prev,
            [routeId]: !prev[routeId]
        }));
    }, []);

    useEffect(() => {
        // ... (effect logic remains the same) ...
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

    const handleGeocodeAndSetPoint = useCallback(async (query: string, type: 'start' | 'destination'): Promise<Coordinate | null> => {
        // ... (function remains the same, using mapApiService.geocode) ...
        if (!query.trim()) return null;
        const geocoded = await mapApiService.geocode(query); 
        if (geocoded) {
            const { coordinate, formattedAddress } = geocoded;
            if (type === 'start') setStartPointQuery(formattedAddress);
            else setDestinationQuery(formattedAddress);
            if (animateToRegion) animateToRegion({ ...coordinate, latitudeDelta: 0.02, longitudeDelta: 0.01 });
            return coordinate;
        } else {
            Alert.alert("Geocode Error", `Could not find location for "${query}"`);
            return null;
        }
    }, [animateToRegion]); 

    const handlePlanTripFromInputs = async () => {
        // ... (function remains the same) ...
        let startCoord: Coordinate | null = null;
        let endCoord: Coordinate | null = null;

        if (startPointQuery.trim() === "My Current Location" && currentLocation) {
            startCoord = currentLocation.coords;
        } else if (startPointQuery.trim()) {
            startCoord = await handleGeocodeAndSetPoint(startPointQuery, 'start') ?? null;
        } else if (currentLocation) { 
            startCoord = currentLocation.coords;
            setStartPointQuery("My Current Location");
        }

        if (destinationQuery.trim()) {
            endCoord = await handleGeocodeAndSetPoint(destinationQuery, 'destination') ?? null;
        }

        if (startCoord && endCoord) {
            planAndDisplayTrip(startCoord, endCoord, startPointQuery || "Start", destinationQuery || "Destination");
        } else {
            Alert.alert("Missing Information", "Please set both start and destination points, or allow location access for 'My Location'.");
        }
    };

    const handleTestSampleTripButton = () => {
        console.log("Test Sample Trip (Dev) button pressed. Planning with predefined sample data.");
        setStartPointQuery("Sample Start Location"); 
        setDestinationQuery("Sample End Location (AUF)"); 

        if (DebugTestTrip.sampleTrip.startPoint && DebugTestTrip.sampleTrip.endPoint) {
            planAndDisplayTrip(
                DebugTestTrip.sampleTrip.startPoint,
                DebugTestTrip.sampleTrip.endPoint,
                "Sample Start: Diamond subd", 
                "Sample End: AUF Area"       
            );
        } else {
            Alert.alert("Test Error", "Sample trip data from DebugTestTrip.ts is incomplete or not loaded.");
        }
    };

    const handleTestSampleTripButton2 = () => {
        console.log("Test Sample Trip (Dev) button pressed. Planning with predefined sample data.");
        setStartPointQuery("Sample Start Location (AUF)"); 
        setDestinationQuery("Sample End Location (Diamond subd)"); 

        if (DebugTestTrip.sampleTrip.startPoint && DebugTestTrip.sampleTrip.endPoint) {
            planAndDisplayTrip(
                DebugTestTrip.sampleTrip.endPoint,
                DebugTestTrip.sampleTrip.startPoint,
                "Sample Start: AUF Area", 
                "Sample End: Diamond subd"       
            );
        } else {
            Alert.alert("Test Error", "Sample trip data from DebugTestTrip.ts is incomplete or not loaded.");
        }
    };

    const handleTestSampleTripButton3 = () => {
        console.log("Test Sample Trip (Dev) button pressed. Planning with predefined sample data.");
        setStartPointQuery("Sample Start Location"); 
        setDestinationQuery("Sample End Location"); 

        if (DebugTestTrip.sampleTrip2.startPoint && DebugTestTrip.sampleTrip2.endPoint) {
            planAndDisplayTrip(
                DebugTestTrip.sampleTrip2.endPoint,
                DebugTestTrip.sampleTrip2.startPoint,
                "Sample Start:", 
                "Sample End:"       
            );
        } else {
            Alert.alert("Test Error", "Sample trip data from DebugTestTrip.ts is incomplete or not loaded.");
        }
    };

    const handleTestSampleTripButton4 = () => {
        console.log("Test Sample Trip (Dev) button pressed. Planning with predefined sample data.");
        setStartPointQuery("Sample Start Location"); 
        setDestinationQuery("Sample End Location"); 

        if (DebugTestTrip.sampleTrip2.startPoint && DebugTestTrip.sampleTrip2.endPoint) {
            planAndDisplayTrip(
                DebugTestTrip.sampleTrip2.startPoint,
                DebugTestTrip.sampleTrip2.endPoint,
                "Sample Start:", 
                "Sample End:"       
            );
        } else {
            Alert.alert("Test Error", "Sample trip data from DebugTestTrip.ts is incomplete or not loaded.");
        }
    };

    const handleTestSampleTripButton5 = () => {
        console.log("Test Sample Trip (Dev) button pressed. Planning with predefined sample data.");
        setStartPointQuery("Sample Start Location"); 
        setDestinationQuery("Sample End Location"); 

        if (DebugTestTrip.sampleTrip3.startPoint && DebugTestTrip.sampleTrip3.endPoint) {
            planAndDisplayTrip(
                DebugTestTrip.sampleTrip3.startPoint,
                DebugTestTrip.sampleTrip3.endPoint,
                "Sample Start:", 
                "Sample End: AUF"       
            );
        } else {
            Alert.alert("Test Error", "Sample trip data from DebugTestTrip.ts is incomplete or not loaded.");
        }
    };

    const handleClearAll = () => {
        clearDisplayedTripInfo();
        setStartPointQuery('');
        setDestinationQuery('');
        const targetRegion = currentLocation?.coords
            ? { ...currentLocation.coords, latitudeDelta: 0.02, longitudeDelta: 0.01 }
            : initialMapRegion;

        if (animateToRegion) animateToRegion(targetRegion);
        else setStoreCurrentRegion(targetRegion);
    };

    const handleRouteCardPress = (id: string) => {
        router.push(`/(tabs)/trips/${id}`);
    };

    const handleStartTrip = async () => {
        if (!currentDisplayedTrip || !allTripOptions || selectedTripIndex >= allTripOptions.length) {
            Alert.alert("Error", "No valid trip option selected");
            return;
        }
        
        const startMarker = storeMarkers.find(m => m.id === 'startPoint');
        const destMarker = storeMarkers.find(m => m.id === 'destinationPoint');
        
        if (!startMarker || !destMarker) {
            Alert.alert("Error", "Start or destination point not found");
            return;
        }
        
        const startLocation = {
            name: startMarker.title || "Start Point",
            latitude: startMarker.coordinate.latitude,
            longitude: startMarker.coordinate.longitude
        };
        
        const endLocation = {
            name: destMarker.title || "Destination",
            latitude: destMarker.coordinate.latitude,
            longitude: destMarker.coordinate.longitude
        };
        
        try {
            const tripId = await startTrip(
                startLocation,
                endLocation,
                selectedTripIndex,
                allTripOptions[selectedTripIndex]
            );
            
            if (tripId) {
                console.log(`Trip started with ID: ${tripId}`);
            } else {
                Alert.alert(
                    "Error Starting Trip",
                    "Could not start a trip. Please try again or check your connection."
                );
            }
        } catch (error) {
            console.error("Error starting trip:", error);
            Alert.alert(
                "Error",
                "An unexpected error occurred while starting your trip."
            );
        }
    };    // --- Define sections for the main FlatList ---
    const listSections: Array<{type: string, key: string, data?: any}> = [
        { type: 'planning_inputs', key: 'planning_inputs' },
    ];

    // Only add test button section if debug mode is enabled
    if (DEBUG_MODE_ENABLED) {
        listSections.push({ type: 'test_button', key: 'test_button' });
    }

    // Add jeepney route toggles section
    listSections.push({ type: 'jeepney_routes', key: 'jeepney_routes' });

    listSections.push({ type: 'map_view', key: 'map_view' });

    if (allTripOptions && allTripOptions.length > 0) {
        listSections.push({ 
            type: 'trip_option_tabs', 
            key: 'trip_option_tabs', 
            data: { options: allTripOptions, selectedIndex: selectedTripIndex, onSelect: selectTripOption } 
        });
        if (currentDisplayedTrip) {
            currentDisplayedTrip.forEach((leg, index) => {
                listSections.push({ type: 'instruction_leg', key: `leg-${index}-${leg.routeId || leg.mode}`, data: { leg, legIndex: index } });
            });
        }
    }
    
    listSections.push({ type: 'recent_trips', key: 'recent_trips', data: recentTrips });

    const renderListSection = ({ item }: { item: {type: string, key: string, data?: any} }) => {
        switch (item.type) {
            case 'test_button':
                // Only render if debug mode is enabled (double-check for safety)
                return DEBUG_MODE_ENABLED ? (
                    <View style={dynamicStyles.testButtonContainer}>
                        <RNButton title="Test 1 Sample Trip (Dev)" onPress={handleTestSampleTripButton} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 2 Sample Trip (Dev)" onPress={handleTestSampleTripButton2} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 3 Sample Trip (Dev)" onPress={handleTestSampleTripButton3} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 4 Sample Trip (Dev)" onPress={handleTestSampleTripButton4} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 5 Sample Trip (Dev)" onPress={handleTestSampleTripButton5} color={isDarkMode ? colors.accent : colors.primary} />
                    </View>
                ) : null;
            case 'planning_inputs':
                return (
                    <View style={[styles.planningContainer, dynamicStyles.planningContainer]}>
                        {/* Replace SearchBar with TouchableOpacity for start point */}
                        <TouchableOpacity 
                            style={[dynamicStyles.inputContainer, styles.inputTouchable]}
                            onPress={() => handleLocationPickerOpen('start')}
                        >
                            <View style={styles.inputRow}>
                                <Ionicons name="navigate-circle-outline" size={20} color={colors.primary} />
                                <Text style={[
                                    styles.inputText, 
                                    { color: startPointQuery ? colors.text : colors.text + '80' }
                                ]}>
                                    {startPointQuery || "Start Point (or 'My Location')"}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.text + '60'} />
                            </View>
                        </TouchableOpacity>

                        <View style={styles.separatorLine}></View>

                        {/* Replace SearchBar with TouchableOpacity for destination */}
                        <TouchableOpacity 
                            style={[dynamicStyles.inputContainer, styles.inputTouchable]}
                            onPress={() => handleLocationPickerOpen('destination')}
                        >
                            <View style={styles.inputRow}>
                                <Ionicons name="location-outline" size={20} color={colors.primary} />
                                <Text style={[
                                    styles.inputText, 
                                    { color: destinationQuery ? colors.text : colors.text + '80' }
                                ]}>
                                    {destinationQuery || "Destination"}
                                </Text>
                                <Ionicons name="chevron-forward" size={16} color={colors.text + '60'} />
                            </View>
                        </TouchableOpacity>
                          <View style={styles.optionsRow}>
                            <TouchableOpacity 
                                style={[styles.actionButton, {backgroundColor: colors.primary}]} 
                                onPress={handlePlanTripFromInputs}
                                disabled={isFetchingRoute}
                            >
                                <Ionicons name="paper-plane-outline" size={18} color={colors.headerText} />
                                <Text style={[styles.actionButtonText, {color: colors.headerText}]}>Find Route</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.actionButton, {backgroundColor: colors.accent}]} 
                                onPress={handleAddToFavorites}
                                disabled={isFetchingRoute}
                            >
                                <Ionicons name="heart-outline" size={18} color={colors.headerText} />
                                <Text style={[styles.actionButtonText, {color: colors.headerText}]}>Favorite</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.actionButton, {backgroundColor: colors.secondary}]} 
                                onPress={handleClearAll}
                                disabled={isFetchingRoute}
                            >
                                <Ionicons name="close-circle-outline" size={18} color={colors.headerText} />
                                <Text style={[styles.actionButtonText, {color: colors.headerText}]}>Clear</Text>
                            </TouchableOpacity>                        </View>
                    </View>
                );
            case 'jeepney_routes':
                return (
                    <View style={[styles.jeepneyRoutesContainer, dynamicStyles.jeepneyRoutesContainer]}>
                        <Text style={[styles.jeepneyRoutesTitle, { color: colors.text }]}>Jeepney Routes</Text>
                        <View style={styles.jeepneyButtonsRow}>
                            <TouchableOpacity                                style={[
                                    styles.jeepneyRouteButton,
                                    { 
                                        backgroundColor: jeepneyRouteVisibility['checkpoint-silver'] ? '#c2cad8' : colors.card,
                                        borderColor: '#c2cad8',
                                        borderWidth: 2
                                    }
                                ]}
                                onPress={() => handleJeepneyRouteToggle('checkpoint-silver')}
                            >
                                <Text style={[
                                    styles.jeepneyRouteButtonText,
                                    { color: jeepneyRouteVisibility['checkpoint-silver'] ? '#000' : colors.text }
                                ]}>
                                    Silver
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.jeepneyRouteButton,
                                    { 
                                        backgroundColor: jeepneyRouteVisibility['checkpoint-violet'] ? '#5b4dad' : colors.card,
                                        borderColor: '#5b4dad',
                                        borderWidth: 2
                                    }
                                ]}
                                onPress={() => handleJeepneyRouteToggle('checkpoint-violet')}
                            >
                                <Text style={[
                                    styles.jeepneyRouteButtonText,
                                    { color: jeepneyRouteVisibility['checkpoint-violet'] ? '#fff' : colors.text }
                                ]}>
                                    Violet
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.jeepneyRouteButton,
                                    { 
                                        backgroundColor: jeepneyRouteVisibility['marisol'] ? '#0abc27' : colors.card,
                                        borderColor: '#0abc27',
                                        borderWidth: 2
                                    }
                                ]}
                                onPress={() => handleJeepneyRouteToggle('marisol')}
                            >
                                <Text style={[
                                    styles.jeepneyRouteButtonText,
                                    { color: jeepneyRouteVisibility['marisol'] ? '#fff' : colors.text }
                                ]}>
                                    Marisol
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            case 'map_view':
                return (
                    <View style={styles.mapContainer}>
                        <MapViewComponent
                          ref={setMapRef}
                          initialRegion={storeMapRegion || initialMapRegion}
                          onRegionChangeComplete={onRegionChangeComplete}
                          showsUserLocation={locationPermissionStatus === 'granted'}
                          showsMyLocationButton={false}
                        >
                            {storeMarkers.map((marker: AppMapMarker) => (
                                <Marker key={marker.id} coordinate={marker.coordinate} title={marker.title} description={marker.description}>
                                    <MapPin type={marker.id === 'startPoint' ? 'start' : marker.id === 'destinationPoint' ? 'end' : 'generic'} color={marker.pinColor} size={marker.id === 'startPoint' || marker.id === 'destinationPoint' ? 40 : 30} />
                                </Marker>
                            ))}                            {enhancedMapDisplayRoutes.map((route: MapDisplayRoute) => (
                                <RoutePolyline 
                                    key={route.id} 
                                    coordinates={route.coordinates} 
                                    strokeColor={route.color} 
                                    strokeWidth={route.routeType === 'walk' ? 4 : 6} 
                                    lineDashPattern={route.routeType === 'walk' ? [1, 8] : route.routeType === 'jeepney' ? [5, 10] : undefined} 
                                    zIndex={route.routeType === 'jeepney' ? 10 : 5} 
                                />
                            ))}
                        </MapViewComponent>
                        
                        {/* Add the LoadingStatusDisplay as an overlay inside the map container */}
                        {(isFetchingRoute || loadingStatus) && (
                            <LoadingStatusDisplay
                                isLoading={isFetchingRoute}
                                status={loadingStatus}
                                defaultMessage="Planning your route..."
                            />
                        )}
                        
                        <TouchableOpacity style={[styles.mapActionButton, styles.locateButton, dynamicStyles.mapInfoButton]} onPress={() => currentLocation?.coords && animateToRegion && animateToRegion({...currentLocation.coords, latitudeDelta: 0.01, longitudeDelta: 0.005})}>
                            <Ionicons name="locate" size={22} color={dynamicStyles.mapInfoIcon.color} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.mapActionButton, styles.recenterButton, dynamicStyles.mapInfoButton]} onPress={() => currentDisplayedTrip && currentDisplayedTrip.length > 0 && mapApiService.regionFromCoordinates(currentDisplayedTrip.flatMap(leg => leg.coordinates)) ? animateToRegion(mapApiService.regionFromCoordinates(currentDisplayedTrip.flatMap(leg => leg.coordinates), 0.3)!) : animateToRegion(storeMapRegion || initialMapRegion)}>
                            <Ionicons name="expand-outline" size={22} color={dynamicStyles.mapInfoIcon.color} />
                        </TouchableOpacity>
                        {isFetchingRoute && <View style={styles.loadingOverlay}><Loader text="Planning trip..." color={colors.primary}/></View>}
                    </View>
                );
            case 'trip_option_tabs':
                return (
                    <View style={[styles.tripOptionsContainer, {backgroundColor: colors.card}]}>
                        {activeTrip && activeTrip.status === 'active' ? (
                            <ActiveTripPanel />
                        ) : (
                            <>
                                <HorizontalScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainerScrollView}>
                                    <View style={styles.tabsContainer}>
                                        {allTripOptions?.map((option, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={[
                                                    styles.tripOptionTab,
                                                    selectedTripIndex === index ? {backgroundColor: colors.primary} : {backgroundColor: colors.card}
                                                ]}
                                                onPress={() => selectTripOption(index)}
                                            >
                                                <Text style={[
                                                    styles.tripOptionTabText,
                                                    selectedTripIndex === index ? {color: colors.headerText} : {color: colors.text}
                                                ]}>
                                                    Option {index + 1}
                                                </Text>
                                                <Text style={[
                                                    styles.tripOptionTabDescription,
                                                    selectedTripIndex === index ? {color: colors.headerText} : {color: colors.text}
                                                ]}>
                                                    {getTripSummaryForTab(option)}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </HorizontalScrollView>
                                
                                {/* Choose This Option Button */}
                                {allTripOptions && allTripOptions.length > 0 && (
                                    <TouchableOpacity
                                        style={[styles.chooseOptionButton, {backgroundColor: colors.success}]}
                                        onPress={handleStartTrip}
                                    >
                                        <Text style={[styles.chooseOptionButtonText, {color: colors.headerText}]}>
                                            Choose This Option
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>
                );
            case 'instruction_leg':
                return <InstructionLegItem leg={item.data.leg} legIndex={item.data.legIndex} />;
            case 'recent_trips':
                 return (
                    <View style={[styles.previousRoutesContainer, dynamicStyles.previousRoutesContainer]}>
                        <View style={styles.previousHeader}>
                            <Text style={[styles.previousTitle, dynamicStyles.previousTitle]}>Recent Trips</Text>
                            <TouchableOpacity style={[styles.arrowButton, dynamicStyles.arrowButton]} onPress={() => router.push('/(tabs)/trips')}>
                                <Ionicons name="arrow-forward-outline" size={22} color={dynamicStyles.arrowIcon.color} />
                            </TouchableOpacity>
                        </View>

                        {/* BETTER STATE FLOW LOGIC APPLIED HERE */}
                        {(() => {
                            // Loading state - only show if we're loading AND have no trips yet
                            if (tripsIsLoading && trips.length === 0) {
                                return (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="small" color={colors.primary} />
                                        <Text style={[styles.loadingText, { color: colors.text + '80' }]}>
                                            Loading recent trips...
                                        </Text>
                                    </View>
                                );
                            }

                            // Error state - only show if there's an error AND no trips loaded
                            if (tripsError && trips.length === 0) {
                                return (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
                                        <Text style={[styles.emptyText, { color: colors.error }]}>
                                            Error loading trips
                                        </Text>
                                        <TouchableOpacity 
                                            onPress={() => fetchTrips()} 
                                            style={[styles.retryButton, { backgroundColor: colors.primary }]}
                                        >
                                            <Text style={[styles.retryText, { color: colors.headerText }]}>
                                                Retry
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            }

                            // Empty state - when no recent trips are found
                            if (item.data.length === 0) {
                                return (
                                    <View style={styles.emptyContainer}>
                                        <Ionicons name="map-outline" size={32} color={colors.text + '40'} />
                                        <Text style={[styles.emptyText, { color: colors.text }]}>
                                            No recent trips
                                        </Text>
                                        <Text style={[styles.emptySubtext, { color: colors.text + '80' }]}>
                                            Start a trip to see your history here
                                        </Text>
                                    </View>
                                );
                            }

                            // Success state - show the trips list
                            return (
                                <FlatList
                                    data={item.data} // recentTrips
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={(tripItem) => tripItem.id}
                                    renderItem={({ item: tripItem }) => (
                                        <RouteCard 
                                            startTime={tripItem.startTime} 
                                            endTime={tripItem.endTime} 
                                            startLocation={tripItem.startLocation} 
                                            endLocation={tripItem.endLocation} 
                                            onPress={() => handleRouteCardPress(tripItem.id)} 
                                        />
                                    )}
                                    contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
                                />
                            );
                        })()}
                    </View>
                );
            default:
                return null;
        }
    };

    const dynamicStyles = StyleSheet.create({
        flexContainer: { backgroundColor: colors.background, flex: 1 },
        planningContainer: { 
            backgroundColor: colors.card, 
            marginHorizontal: 10,
            marginTop: 10,
            marginBottom: 10,
            borderRadius: 15,
            padding: 15,
            elevation: 3,
            shadowColor: colors.text,
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDarkMode ? 0.2 : 0.1,
            shadowRadius: 3,
        },
        mapInfoButton: { 
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
        },
        mapInfoIcon: { color: colors.text },
        previousRoutesContainer: { 
            backgroundColor: colors.card, 
            paddingBottom: 10,
        },
        previousTitle: { color: colors.text },
        arrowButton: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        arrowIcon: { color: colors.text },
        inputStyle: { color: colors.text, backgroundColor: colors.inputBackground },
        inputContainer: { 
            backgroundColor: colors.inputBackground, 
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,        },
        jeepneyRoutesContainer: { 
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
        },
        testButtonContainer: {
            marginVertical: 10,
            marginHorizontal: 15,
        },
        loadingOverlay: {
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            borderRadius: 15,
        },
        mapActionButton: {
            position: 'absolute',
            padding: 8,
            borderRadius: 20,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            zIndex: 1500,
        },
        chooseOptionButton: {
            paddingVertical: 12,
            borderRadius: 8,
            marginHorizontal: 16,
            marginTop: 8,
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'center',
        },
        chooseOptionButtonText: {
            fontSize: 16,
            fontWeight: '600',
        },
    });

    return (
        <KeyboardAvoidingView
            style={dynamicStyles.flexContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
            <FlatList
                style={dynamicStyles.flexContainer}
                data={listSections}
                renderItem={renderListSection}
                keyExtractor={(item) => item.key}
                ListFooterComponent={<View style={{ height: 50 }} />}
                keyboardShouldPersistTaps="handled"
            />
              {/* Location Picker Modal */}
            <LocationPickerModal
                visible={locationPickerVisible}
                onClose={handleLocationPickerClose}
                onLocationConfirm={handleLocationConfirm}
                title={locationPickerType === 'start' ? 'Select Start Point' : 'Select Destination'}
                showCurrentLocationButton={locationPickerType === 'start'}
            />
            
            {/* Add Favorite Modal */}
            <AddFavoriteModal
                visible={favoriteModalVisible}
                onClose={() => setFavoriteModalVisible(false)}
                onSave={handleSaveFavorite}
                startLocation={{
                    name: startPointQuery,
                    latitude: 0, // Will be resolved in handleSaveFavorite
                    longitude: 0
                }}
                endLocation={{
                    name: destinationQuery,
                    latitude: 0, // Will be resolved in handleSaveFavorite
                    longitude: 0
                }}
            />
        </KeyboardAvoidingView>
    );
}

// Add new styles for the touchable inputs
const styles = StyleSheet.create({
    planningContainer: { /* Base styles, theming in dynamicStyles */ },
    separatorLine: { height: 1, backgroundColor: '#4A4A4C', marginVertical: 10 },
    inputTouchable: {
        marginVertical: 2,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    inputText: {
        fontSize: 16,
        flex: 1,
        marginLeft: 12,
    },
    optionsRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        marginTop: 15 
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 20,
        elevation: 2,
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },    actionButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    jeepneyRoutesContainer: {
        marginHorizontal: 10,
        marginVertical: 8,
        padding: 12,
        borderRadius: 12,
        elevation: 1,
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    jeepneyRoutesTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    jeepneyButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        gap: 8,
    },
    jeepneyRouteButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
        alignItems: 'center',
        elevation: 1,
        shadowOffset: {width: 0, height: 1},
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    jeepneyRouteButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    mapContainer: {
        height: 350,
        marginHorizontal: 10,
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#E0E0E0',
        position: 'relative',
        marginTop: 0,
        marginBottom: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)'
    },
    mapActionButton: {
        position: 'absolute',
        padding: 8,
        borderRadius: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        zIndex: 1500,
    },
    locateButton: { top: 10, right: 10, },
    recenterButton: { top: 60, right: 10, },
    tripOptionsContainer: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 0,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        marginBottom: 0,
    },
    tabsContainerScrollView: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
    },
    tabsContainer: {
        flexDirection: 'row',
    },
    tripOptionTab: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginHorizontal: 5,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    tripOptionTabText: { fontSize: 14, fontWeight: '600', textAlign: 'center', },
    tripOptionTabDescription: { fontSize: 11, textAlign: 'center', marginTop: 2, },
    previousRoutesContainer: { /* Base styles, theming in dynamicStyles */ },
    previousHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 15,
        marginBottom: 10
    },
    previousTitle: { fontSize: 18, fontWeight: '600' },
    arrowButton: { padding: 8, borderRadius: 15, },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        borderRadius: 15,
    },
    chooseOptionButton: {
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chooseOptionButtonText: {
        paddingVertical: 12,
        borderRadius: 8,
        marginHorizontal: 16,
        marginTop: 8,
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
    // New styles for better empty/loading/error states
    loadingContainer: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 20,
    },
    loadingText: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '500',
        marginTop: 8,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 4,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
    },
    retryText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
