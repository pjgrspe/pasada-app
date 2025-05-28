// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity, // ScrollView removed from here
  KeyboardAvoidingView,
  Platform,
  Alert,
  Button as RNButton,
  FlatList, // FlatList is now the main scroller
  ScrollView as HorizontalScrollView, // For tabs
} from 'react-native';
import { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import RouteCard from '@/components/RouteCard';
import Loader from '@/components/Loader';
// TripOptionsDisplayComponent is no longer imported as a whole
import InstructionLegItem from '@/modules/map/components/InstructionLegItem'; // NEW IMPORT

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
import { useTripStore } from '@/modules/map/store/useTripStore';
import * as DebugTestTrip from '@/modules/map/utils/DebugTestTrip';
import { Text } from '@/components/Themed';

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
    const { colors, isDarkMode } = useTheme();
    const { trips, isLoading: tripsIsLoading, error: tripsError, fetchTrips, getRecentTrips } = useTripStore();
    const recentTrips = getRecentTrips(5);

    const [startPointQuery, setStartPointQuery] = useState('');
    const [destinationQuery, setDestinationQuery] = useState('');

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
        routes: mapDisplayRoutes,
        currentRegion: storeMapRegion,
        setCurrentRegion: setStoreCurrentRegion,
    } = useMapStore();


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
        // ... (function remains the same) ...
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
        // ... (function remains the same) ...
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
        // ... (function remains the same) ...
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
        // ... (function remains the same) ...
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
        // ... (function remains the same) ...
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
        // ... (function remains the same) ...
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

    // --- Define sections for the main FlatList ---
    const listSections: Array<{type: string, key: string, data?: any}> = [
        { type: 'planning_inputs', key: 'planning_inputs' },
        { type: 'test_button', key: 'test_button' },
        { type: 'map_view', key: 'map_view' },
    ];

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
                return (
                    <View style={dynamicStyles.testButtonContainer}>
                        <RNButton title="Test 1 Sample Trip (Dev)" onPress={handleTestSampleTripButton} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 2 Sample Trip (Dev)" onPress={handleTestSampleTripButton2} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 3 Sample Trip (Dev)" onPress={handleTestSampleTripButton3} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 4 Sample Trip (Dev)" onPress={handleTestSampleTripButton4} color={isDarkMode ? colors.accent : colors.primary} />
                        <RNButton title="Test 5 Sample Trip (Dev)" onPress={handleTestSampleTripButton5} color={isDarkMode ? colors.accent : colors.primary} />
                    </View>
                );
            case 'planning_inputs':
                return (
                    <View style={[styles.planningContainer, dynamicStyles.planningContainer]}>
                        <SearchBar
                            placeholder="Start Point (or 'My Location')"
                            value={startPointQuery}
                            onChangeText={setStartPointQuery}
                            onSearchSubmit={() => handleGeocodeAndSetPoint(startPointQuery, 'start')}
                            iconName="navigate-circle-outline"
                            style={dynamicStyles.inputContainer}
                        />
                        <View style={styles.separatorLine}></View>
                        <SearchBar
                            placeholder="Destination"
                            value={destinationQuery}
                            onChangeText={setDestinationQuery}
                            onSearchSubmit={() => handleGeocodeAndSetPoint(destinationQuery, 'destination')}
                            iconName="location-outline"
                            style={dynamicStyles.inputContainer}
                        />
                        <View style={styles.optionsRow}>
                            <TouchableOpacity style={[styles.actionButton, {backgroundColor: colors.primary}]} onPress={handlePlanTripFromInputs}>
                                 <Ionicons name="paper-plane-outline" size={18} color={colors.headerText} />
                                 <Text style={[styles.actionButtonText, {color: colors.headerText}]}>Find Route</Text>
                             </TouchableOpacity>
                             <TouchableOpacity style={[styles.actionButton, {backgroundColor: colors.secondary}]} onPress={handleClearAll}>
                                 <Ionicons name="close-circle-outline" size={18} color={colors.headerText} />
                                 <Text style={[styles.actionButtonText, {color: colors.headerText}]}>Clear</Text>
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
                            ))}
                            {mapDisplayRoutes.map((route: MapDisplayRoute) => (
                                <RoutePolyline key={route.id} coordinates={route.coordinates} strokeColor={route.color} strokeWidth={route.routeType === 'walk' ? 4 : 6} lineDashPattern={route.routeType === 'walk' ? [1, 8] : undefined} zIndex={route.routeType === 'jeepney' ? 10 : 5} />
                            ))}
                        </MapViewComponent>
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
                        <HorizontalScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainerScrollView}>
                            {item.data.options.map((option: PlannedTripLeg[], index: number) => (
                              <TouchableOpacity
                                key={index}
                                style={[
                                  styles.tabButton, { borderColor: colors.border },
                                  item.data.selectedIndex === index ? { backgroundColor: colors.primary, borderBottomWidth: 0 } : { backgroundColor: colors.background },
                                ]}
                                onPress={() => item.data.onSelect(index)}
                              >
                                <Text style={[ styles.tabText, item.data.selectedIndex === index ? { color: colors.headerText } : { color: colors.text } ]}>
                                  Option {index + 1}
                                </Text>
                                <Text style={[ styles.tabSummaryText, item.data.selectedIndex === index ? { color: colors.headerText, opacity: 0.8 } : { color: colors.text, opacity: 0.7 } ]}>
                                    ({getTripSummaryForTab(option)})
                                </Text>
                              </TouchableOpacity>
                            ))}
                        </HorizontalScrollView>
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
                        {tripsIsLoading && item.data.length === 0 ? <Loader size="small" color={colors.primary}/> : null}
                        {item.data.length > 0 ? (
                            <FlatList
                                data={item.data} // recentTrips
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(tripItem) => tripItem.id}
                                renderItem={({ item: tripItem }) => (
                                    <RouteCard startTime={tripItem.startTime} endTime={tripItem.endTime} startLocation={tripItem.startLocation} endLocation={tripItem.endLocation} onPress={() => handleRouteCardPress(tripItem.id)} />
                                )}
                                contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10 }}
                            />
                        ) : (
                           !tripsIsLoading && <Text style={{ paddingHorizontal: 20, color: colors.text, opacity: 0.7, paddingBottom: 10 }}>No recent trips yet.</Text>
                        )}
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
            // marginTop: 10, // Removed, as it's now part of FlatList flow
            paddingBottom: 10,
        },
        previousTitle: { color: colors.text },
        arrowButton: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        arrowIcon: { color: colors.text },
        inputStyle: { color: colors.text, backgroundColor: colors.inputBackground },
        inputContainer: { backgroundColor: colors.inputBackground, borderColor: colors.border },
        testButtonContainer: {
            marginVertical: 10,
            marginHorizontal: 15,
        },
        // bottomSheetContainer removed as TripOptionsDisplay is broken down
    });

    return (
        <KeyboardAvoidingView
            style={dynamicStyles.flexContainer}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // Adjust if necessary based on header height
        >
            <FlatList
                style={dynamicStyles.flexContainer}
                data={listSections}
                renderItem={renderListSection}
                keyExtractor={(item) => item.key}
                ListFooterComponent={<View style={{ height: 50 }} />} // Add some padding at the bottom
                keyboardShouldPersistTaps="handled"
                // stickyHeaderIndices={allTripOptions && allTripOptions.length > 0 ? [2] : undefined} // Adjust index if needed
            />
        </KeyboardAvoidingView>
    );
}

// Styles for sections rendered by the FlatList
const styles = StyleSheet.create({
    // scrollContent removed as FlatList handles its own content container
    planningContainer: { /* Base styles, theming in dynamicStyles */ },
    separatorLine: { height: 1, backgroundColor: '#4A4A4C', marginVertical: 10 },
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
    },
    actionButtonText: {
        marginLeft: 8,
        fontSize: 14,
        fontWeight: '600',
    },
    mapContainer: {
        height: 350,
        marginHorizontal: 10, // Keep consistent with planning container
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#E0E0E0',
        position: 'relative',
        marginTop: 0, // No margin if it's an item in FlatList
        marginBottom: 10, // Space before next section
        elevation: 2,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)'
    },
    mapActionButton: {
        position: 'absolute',
        padding: 8,
        borderRadius: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    locateButton: { top: 10, right: 10, },
    recenterButton: { top: 60, right: 10, },
    tripOptionsContainer: { // New style for the tabs section
        // Similar to old TripOptionsDisplay container style
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 0,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        marginBottom: 0, // No margin if instruction legs follow directly
    },
    tabsContainerScrollView: { // Style for the horizontal ScrollView for tabs
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderBottomWidth: 1,
        // borderBottomColor will be themed by parent View's backgroundColor
    },
    tabButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginHorizontal: 5,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },
    tabText: { fontSize: 14, fontWeight: '600', textAlign: 'center', },
    tabSummaryText: { fontSize: 11, textAlign: 'center', marginTop: 2, },
    // InstructionLegItem styles are now in InstructionLegItem.tsx
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
    }
});
