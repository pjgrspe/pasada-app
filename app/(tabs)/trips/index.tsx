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
import { useTripStore, Trip } from '../../../store/useTripStore';
import Loader from '../../../components/Loader';
import { useTheme } from '../../../hooks/useTheme'; // Import useTheme
import { useTripStore, Trip } from '../../../modules/map/store/useTripStore'; // Import Trip Store & Trip Type
import Icon from 'react-native-vector-icons/Ionicons';

const TripListItem = ({ item }: { item: Trip }) => {
    const { colors, themeMode, setThemeMode, isDarkMode } = useTheme();
    const router = useRouter();

    return (
        <TouchableOpacity
            style={[styles.itemContainer, {
                backgroundColor: colors.card,
                shadowColor: '#000',
                borderColor: colors.border,
            }]}
            activeOpacity={0.8}
            onPress={() => router.push(`/(tabs)/trips/${item.id}`)}
        >
            <View style={styles.locationRow}>
                <Text style={[styles.itemTitle, { color: colors.text }]}>
                    {item.startLocation}
                </Text>
                <Icon name="chevron-forward" size={20} color={colors.primary} style={styles.chevron} />
                <Text style={[styles.itemTitle, { color: colors.text }]}>
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
        if (trips.length === 0) {
            fetchTrips();
        }
    }, [fetchTrips, trips.length]);

    const filteredTrips = useMemo(() =>
        trips.filter(trip =>
            trip.startLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
            trip.endLocation.toLowerCase().includes(searchQuery.toLowerCase())
        ), [trips, searchQuery]);

    if (isLoading && trips.length === 0) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Loader text="Loading trips..." color={colors.primary} />
            </View>
        );
    }

    if (error) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Text style={{ color: colors.error, fontSize: 16 }}>Error loading trips: {error}</Text>
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
                    shadowColor: '#000',
                }]}
                placeholder="Search previous trips..."
                placeholderTextColor={colors.text + '88'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                keyboardType="default"
                autoCapitalize="words"
                accessibilityLabel="Search trips"
                accessibilityHint="Filter trips by start or end location"
            />

            <Text style={[styles.header, { color: colors.text }]}>My Trip History</Text>

            <FlatList
                data={filteredTrips}
                renderItem={({ item }) => <TripListItem item={item} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={filteredTrips.length === 0 ? styles.emptyList : undefined}
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors.text }]}>
                        No trips found.
                    </Text>
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
        paddingTop: Platform.OS === 'android' ? 24 : 0,
    },
    searchInput: {
        marginHorizontal: 16,
        marginTop: 16,
        paddingVertical: 12,
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
    header: {
        fontSize: 24,
        fontWeight: '700',
        paddingHorizontal: 16,
        marginTop: 24,
        marginBottom: 12,
        letterSpacing: 0.6,
    },
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
        fontSize: 18,
        fontWeight: '700',
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
    emptyList: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '500',
        opacity: 0.7,
        marginTop: 20,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});

export default TripListScreen;
