// Modify: pasada-app/app/(tabs)/trips/index.tsx
// Remove the <Text style={[styles.header, { color: colors.text }]}>My Trip History</Text>
// The title "My Trips" is now handled by the ScreenHeader in app/(tabs)/trips/_layout.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { useTripStore, Trip } from '../../../modules/map/store/useTripStore';
import Loader from '../../../components/Loader';
import Icon from 'react-native-vector-icons/Ionicons';

const TripListItem = ({ item }: { item: Trip }) => {
    const { colors } = useTheme(); // Removed unused themeMode, setThemeMode, isDarkMode
    const router = useRouter();

    return (
        <TouchableOpacity
            style={[styles.itemContainer, {
                backgroundColor: colors.card,
                shadowColor: '#000', // Consider theming shadow if needed
                borderColor: colors.border,
            }]}
            activeOpacity={0.8}
            onPress={() => router.push(`/(tabs)/trips/${item.id}`)}
        >
            <View style={styles.locationRow}>
                <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.startLocation}
                </Text>
                <Icon name="chevron-forward" size={20} color={colors.primary} style={styles.chevron} />
                <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                    {item.endLocation}
                </Text>
            </View>

            <Text style={[styles.itemSubtitle, { color: colors.text, opacity: 0.75 }]}>
                {item.date} | {item.startTime}–{item.endTime}
            </Text>

            <Text style={[styles.itemDetails, { color: colors.text, opacity: 0.6 }]}>
                {item.distance} • {item.duration.replace('m', '')} min
            </Text>

        </TouchableOpacity>
    );
};

const TripListScreen = () => {
    const { colors } = useTheme();
    const { trips, isLoading, error, fetchTrips } = useTripStore();
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (trips.length === 0 && !isLoading && !error) { // Fetch only if not already loading and no error
            fetchTrips();
        }
    }, [fetchTrips, trips.length, isLoading, error]); // Added isLoading and error to dependencies

    const filteredTrips = useMemo(() =>
        trips.filter(trip =>
            trip.startLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.endLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.date.includes(searchQuery) // Allow searching by date
        ), [trips, searchQuery]);

    if (isLoading && trips.length === 0) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Loader text="Loading trips..." color={colors.primary} />
            </View>
        );
    }

    if (error && trips.length === 0) { // Show error only if no trips are loaded
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.error, fontSize: 16 }}>Error loading trips: {error}</Text>
                 <TouchableOpacity onPress={() => fetchTrips()} style={{ marginTop: 10, padding: 10, backgroundColor: colors.primary, borderRadius: 5}}>
                    <Text style={{color: colors.headerText}}>Retry</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <TextInput
                style={[styles.searchInput, {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                    shadowColor: '#000', // Consider theming
                }]}
                placeholder="Search by location or date..."
                placeholderTextColor={colors.text + '88'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                keyboardType="default"
                autoCapitalize="words" // Consider 'none' if searching dates frequently
                accessibilityLabel="Search trips"
                accessibilityHint="Filter trips by start or end location, or date"
            />

            {/* The header <Text> "My Trip History" is removed from here. */}
            {/* It's now part of the ScreenHeader in _layout.tsx */}

            <FlatList
                data={filteredTrips}
                renderItem={({ item }) => <TripListItem item={item} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={filteredTrips.length === 0 ? styles.emptyListContent : styles.listContent}
                ListEmptyComponent={
                     !isLoading ? ( // Show empty only if not loading
                        <View style={styles.emptyContainer}>
                            <Icon name="file-tray-outline" size={60} color={colors.text + '88'} />
                            <Text style={[styles.emptyText, { color: colors.text }]}>
                                No trips match your search.
                            </Text>
                        </View>
                    ) : null // Don't show empty component while initial loading is happening
                }
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // paddingTop removed, handled by SafeAreaView in ScreenHeader
    },
    searchInput: {
        marginHorizontal: 16,
        marginTop: 16, // Space from header
        marginBottom: 12, // Space before list
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        paddingHorizontal: 20,
        borderRadius: 24,
        fontSize: 16,
        fontWeight: '500',
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
    },
    // header style removed
    itemContainer: {
        padding: 18,
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 5,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    chevron: {
        marginHorizontal: 8,
    },
    itemTitle: {
        fontSize: 17, // Slightly increased for better readability
        fontWeight: '600', // Adjusted weight
        flexShrink: 1, // Allow text to shrink if needed
    },
    itemSubtitle: {
        fontSize: 14,
        marginBottom: 6,
        fontWeight: '500',
    },
    itemDetails: {
        fontSize: 13,
        fontWeight: '400',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingBottom: 16, // Add some padding at the bottom of the list
    },
    emptyListContent: { // Style for when the list is empty
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: { // Container for icon and text when empty
        alignItems: 'center',
        paddingBottom: 50, // Give some space from bottom
    },
    emptyText: {
        fontSize: 17, // Adjusted size
        fontWeight: '500',
        opacity: 0.7,
        marginTop: 15,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});

export default TripListScreen;