// app/(tabs)/index.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'; // Import PROVIDER_GOOGLE
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';

import Input from '../../components/Input';
import MapPin from '../../components/MapPin';
import RouteCard from '../../components/RouteCard';
import { useTheme } from '../../hooks/useTheme'; // Import useTheme
import { darkMapStyle } from '../../utils/mapStyles'; // Import map styles
import { useTripStore } from '../../store/useTripStore'; // Import Trip Store

// Dummy location
const mapRegion = {
    latitude: 14.8433, // Malolos
    longitude: 120.8134,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};
const carMarkers = [
    { id: 'car1', lat: 14.8450, lon: 120.8100, name: 'CAR-001' },
    { id: 'car2', lat: 14.8400, lon: 120.8150, name: 'CAR-007' },
];

export default function DashboardScreen() {
    const router = useRouter();
    const { colors, isDarkMode } = useTheme(); // Use theme
    // --- Get Trips from Store ---
    const { trips, isLoading: tripsIsLoading, error: tripsError, fetchTrips, getRecentTrips } = useTripStore();
    const recentTrips = getRecentTrips(5);

    // Fetch trips when the component mounts if not already loaded
    useEffect(() => {
        // Fetch trips only if they are not loaded, not currently loading, and no error occurred.
        // This complements the initial fetch in _layout.tsx.
        if (trips.length === 0 && !tripsIsLoading && !tripsError) {
            console.log("DashboardScreen: Trips are empty and not loading, fetching trips.");
            fetchTrips();
        }
    }, [trips.length, tripsIsLoading, tripsError, fetchTrips]);
    // ----------------------------

    const handleRouteCardPress = (id: string) => {
        router.push(`/(tabs)/trips/${id}`);
    };

    const dynamicStyles = StyleSheet.create({
        flexContainer: { backgroundColor: colors.background },
        headerBar: { backgroundColor: isDarkMode ? colors.card : '#FFD700', }, // Themed header
        headerTitle: { color: isDarkMode ? colors.text : '#333' },
        planningContainer: { backgroundColor: '#2C2C2E' }, // Keep this dark
        mapInfoButton: { backgroundColor: colors.card },
        mapInfoIcon: { color: colors.text },
        previousRoutesContainer: { backgroundColor: colors.card }, // Themed card bg
        previousTitle: { color: colors.text },
        arrowButton: { backgroundColor: colors.background }, // Use main bg
        arrowIcon: { color: colors.text },
    });

    return (
        <KeyboardAvoidingView
            style={[styles.flexContainer, dynamicStyles.flexContainer]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
            <View style={[styles.flexContainer, dynamicStyles.flexContainer]}>
                <View style={[styles.headerBar, dynamicStyles.headerBar]}>
                    <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>CarTrack Pro</Text>
                    <TouchableOpacity>
                        <Ionicons name="notifications-outline" size={26} color={dynamicStyles.headerTitle.color} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={[styles.flexContainer, dynamicStyles.flexContainer]}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={[styles.planningContainer, dynamicStyles.planningContainer]}>
                        {/* Inputs remain dark */}
                        <Input placeholder="Current Location / Start Point" iconName="navigate-circle-outline" iconColor="#FF8C00" />
                        <View style={styles.separatorLine}></View>
                        <Input placeholder="Where are you going?" iconName="location-outline" iconColor="#FF8C00" />
                        <View style={styles.optionsRow}>
                            {/* ... Buttons ... */}
                             <TouchableOpacity style={styles.timeButton}>
                                 <Ionicons name="time-outline" size={18} color="#FFF" />
                                 <Text style={styles.timeText}>Now</Text>
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.modeButton}>
                                <Ionicons name="car-sport-outline" size={22} color="#FFF" />
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.settingsButton}>
                                <Ionicons name="options-outline" size={22} color="#FFF" />
                             </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.mapContainer}>
                        <MapView
                            style={styles.map}
                            initialRegion={mapRegion}
                            provider={PROVIDER_GOOGLE} // Recommended for custom styles
                            customMapStyle={isDarkMode ? darkMapStyle : []} // Apply dark style if needed
                        >
                            {carMarkers.map(car => (
                                <Marker key={car.id} coordinate={{ latitude: car.lat, longitude: car.lon }} title={car.name}>
                                    <MapPin type="car" size={30} />
                                </Marker>
                            ))}
                            <Marker coordinate={{ latitude: 14.85, longitude: 120.82 }} title="Destination">
                                <MapPin type="end" size={36} />
                            </Marker>
                        </MapView>
                        <TouchableOpacity style={[styles.mapInfoButton, dynamicStyles.mapInfoButton]}>
                            <Ionicons name="information-circle-outline" size={24} color={dynamicStyles.mapInfoIcon.color} />
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.previousRoutesContainer, dynamicStyles.previousRoutesContainer]}>
                        <View style={styles.previousHeader}>
                            <Text style={[styles.previousTitle, dynamicStyles.previousTitle]}>Previous Routes</Text>
                            <Link href="/(tabs)/trips" asChild>
                                <TouchableOpacity style={[styles.arrowButton, dynamicStyles.arrowButton]}>
                                    <Ionicons name="arrow-forward-outline" size={24} color={dynamicStyles.arrowIcon.color} />
                                </TouchableOpacity>
                            </Link>
                        </View>
                        {/* --- Use Data from Store --- */}
                        {recentTrips.length > 0 ? (
                            <FlatList
                                data={recentTrips} // Use recentTrips from store
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
                           <Text style={{ paddingHorizontal: 20, color: colors.text, opacity: 0.7 }}>No recent trips yet.</Text>
                        )}
                        {/* --------------------------- */}
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}


// Base Styles (Keep most)
const styles = StyleSheet.create({
    flexContainer: { flex: 1 },
    scrollContent: { paddingBottom: 20 },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 10,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    planningContainer: {
        margin: 20,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    separatorLine: { height: 1, backgroundColor: '#4A4A4C', marginHorizontal: 10, marginBottom: 10, marginTop: 2 },
    optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    timeButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4A4A4C', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    timeText: { color: '#FFF', marginLeft: 5, fontSize: 14 },
    modeButton: { backgroundColor: '#4A4A4C', padding: 8, borderRadius: 20 },
    settingsButton: { backgroundColor: '#FF8C00', padding: 10, borderRadius: 10 },
    mapContainer: { height: 300, marginHorizontal: 20, borderRadius: 15, overflow: 'hidden', backgroundColor: '#E0E0E0', position: 'relative', marginTop: 10 },
    map: { ...StyleSheet.absoluteFillObject },
    mapInfoButton: { position: 'absolute', top: 10, right: 10, padding: 5, borderRadius: 15 },
    previousRoutesContainer: { marginTop: 30, paddingVertical: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    previousHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
    previousTitle: { fontSize: 18, fontWeight: 'bold' },
    arrowButton: { padding: 8, borderRadius: 15 },
});