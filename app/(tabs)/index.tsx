// app/(tabs)/index.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
// --- IMPORT YOUR COMPONENTS ---
import Input from '../../components/Input';
import MapPin from '../../components/MapPin';
import RouteCard from '../../components/RouteCard';

// Dummy data for previous routes
const previousRoutes = [
    { id: '1', time: '14:05 - 14:31', start: 'Home Base', end: 'Client Office' },
    { id: '2', time: '09:15 - 09:45', start: 'Client Office', end: 'Warehouse' },
    { id: '3', time: '17:30 - 18:10', start: 'Warehouse', end: 'Home Base' },
];

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
    const router = useRouter(); // Get router instance

    const handleRouteCardPress = (id: string) => {
        router.push(`/(tabs)/trips/${id}`); // Navigate using router
    };

    return (
        <View style={styles.flexContainer}>
             <View style={styles.headerBar}>
                 <Text style={styles.headerTitle}>CarTrack Pro</Text>
                 <TouchableOpacity>
                     <Ionicons name="notifications-outline" size={26} color="#333" />
                 </TouchableOpacity>
             </View>

            <ScrollView style={styles.flexContainer} contentContainerStyle={styles.scrollContent}>
                <View style={styles.planningContainer}>
                    {/* --- USE YOUR INPUT COMPONENT --- */}
                    {/* We no longer need a custom containerStyle,
                        or if we do, ensure it doesn't set borderWidth to 0.
                        Let's remove it for simplicity to see the default/focus styles. */}
                    <Input
                        placeholder="Current Location / Start Point"
                        iconName="navigate-circle-outline"
                        iconColor="#FF8C00"
                    />
                     <View style={styles.separatorLine}></View>
                    <Input
                        placeholder="Where are you going?"
                        iconName="location-outline"
                        iconColor="#FF8C00"
                    />
                    {/* --------------------------------- */}
                     <View style={styles.optionsRow}>
                        {/* (Buttons remain as is) */}
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

                {/* --- Map Section (Uses MapPin, remains as is) --- */}
                <View style={styles.mapContainer}>
                    {/* ... MapView with MapPin ... */}
                    <MapView style={styles.map} initialRegion={mapRegion}>
                        {carMarkers.map(car => (
                            <Marker
                                key={car.id}
                                coordinate={{ latitude: car.lat, longitude: car.lon }}
                                title={car.name}
                            >
                                <MapPin type="car" size={30} />
                            </Marker>
                        ))}
                         <Marker coordinate={{ latitude: 14.85, longitude: 120.82 }} title="Destination">
                             <MapPin type="end" size={36} />
                         </Marker>
                    </MapView>
                </View>

                {/* --- Previous Routes (Uses RouteCard, remains as is) --- */}
                 <View style={styles.previousRoutesContainer}>
                    <View style={styles.previousHeader}>
                        <Text style={styles.previousTitle}>Previous Routes</Text>
                        <Link href="/(tabs)/trips" asChild>
                            <TouchableOpacity style={styles.arrowButton}>
                                <Ionicons name="arrow-forward-outline" size={24} color="#333" />
                            </TouchableOpacity>
                        </Link>
                    </View>
                    <FlatList
                        data={previousRoutes}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <RouteCard
                                startTime={item.time.split(' - ')[0]}
                                endTime={item.time.split(' - ')[1]}
                                startLocation={item.start}
                                endLocation={item.end}
                                onPress={() => handleRouteCardPress(item.id)} // Use router here
                            />
                        )}
                         contentContainerStyle={{ paddingHorizontal: 20 }}
                    />
                </View>
            </ScrollView>
        </View>
    );
}

// Styles (Remove inputContainerStyle or ensure it doesn't set borderWidth: 0)
const styles = StyleSheet.create({
    // ... (Keep all other styles)
    flexContainer: {
        flex: 1,
        backgroundColor: '#F8F8F8', // Light background
    },
    scrollContent: {
       paddingBottom: 20,
    },
     headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 50, // Adjust for status bar
        paddingBottom: 10,
        backgroundColor: '#FFD700', // Yellowish header
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    planningContainer: {
        backgroundColor: '#2C2C2E', // Dark background for planning
        margin: 20,
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    separatorLine: {
        height: 1,
        backgroundColor: '#4A4A4C',
        marginHorizontal: 10,
        marginBottom: 10,
        marginTop: 2, // Add some space after input
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    timeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4A4A4C',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    timeText: {
        color: '#FFF',
        marginLeft: 5,
        fontSize: 14,
    },
    modeButton: {
        backgroundColor: '#4A4A4C',
        padding: 8,
        borderRadius: 20,
    },
     settingsButton: {
        backgroundColor: '#FF8C00', // Orange button
        padding: 10,
        borderRadius: 10,
    },
    mapContainer: {
        height: 300,
        marginHorizontal: 20,
        borderRadius: 15,
        overflow: 'hidden',
        backgroundColor: '#E0E0E0',
        position: 'relative',
        marginTop: 10,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    previousRoutesContainer: {
        marginTop: 30,
        backgroundColor: '#FFF', // White background
        paddingVertical: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    previousHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    previousTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    arrowButton: {
        backgroundColor: '#EFEFEF',
        padding: 8,
        borderRadius: 15,
    },
    // ... (Keep other styles if any)
});