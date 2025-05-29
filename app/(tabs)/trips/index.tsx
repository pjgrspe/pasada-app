// Update the trips screen with status indicators and filters
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
import { useTripStore, Trip } from '@/modules/map/store/useTripStore';
import Loader from '../../../components/Loader';
import Icon from 'react-native-vector-icons/Ionicons';

const TripListItem = ({ item }: { item: Trip }) => {
    const { colors } = useTheme();
    const router = useRouter();

    // Helper to determine the status indicator color
    const getStatusColor = () => {
        switch (item.status) {
            case 'active': return colors.primary;
            case 'completed': return colors.success;
            case 'cancelled': return colors.error;
            default: return colors.text;
        }
    };

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
            {/* Status indicator */}
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
            
            <View style={styles.itemContent}>
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
            </View>
        </TouchableOpacity>
    );
};

const TripListScreen = () => {
    const { colors } = useTheme();
    const { trips, isLoading, error, fetchTrips } = useTripStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

    useEffect(() => {
        if (trips.length === 0 && !isLoading && !error) {
            fetchTrips();
        }
    }, [fetchTrips, trips.length, isLoading, error]);

    const filteredTrips = useMemo(() =>
        trips.filter(trip =>
            // Apply text search
            (trip.startLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
             trip.endLocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
             trip.date.includes(searchQuery)) &&
            // Apply status filter
            (statusFilter === 'all' || trip.status === statusFilter)
        ), [trips, searchQuery, statusFilter]);

    if (isLoading && trips.length === 0) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Loader text="Loading trips..." color={colors.primary} />
            </View>
        );
    }

    if (error && trips.length === 0) {
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
                    shadowColor: '#000',
                }]}
                placeholder="Search by location or date..."
                placeholderTextColor={colors.text + '88'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                keyboardType="default"
                autoCapitalize="words"
                accessibilityLabel="Search trips"
                accessibilityHint="Filter trips by start or end location, or date"
            />

            {/* Status filter tabs */}
            <View style={styles.filterTabs}>
                {(['all', 'active', 'completed', 'cancelled'] as const).map((status) => (
                    <TouchableOpacity
                        key={status}
                        style={[
                            styles.filterTab,
                            statusFilter === status && { backgroundColor: colors.primary + '20', borderColor: colors.primary }
                        ]}
                        onPress={() => setStatusFilter(status)}
                    >
                        <Text 
                            style={[
                                styles.filterTabText,
                                { color: statusFilter === status ? colors.primary : colors.text + '99' }
                            ]}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={filteredTrips}
                renderItem={({ item }) => <TripListItem item={item} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={filteredTrips.length === 0 ? styles.emptyListContent : styles.listContent}
                ListEmptyComponent={
                     !isLoading ? (
                        <View style={styles.emptyContainer}>
                            <Icon name="file-tray-outline" size={60} color={colors.text + '88'} />
                            <Text style={[styles.emptyText, { color: colors.text }]}>
                                No trips match your search.
                            </Text>
                        </View>
                    ) : null
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
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchInput: {
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 12,
        paddingVertical: Platform.OS === 'ios' ? 14 : 12,
        paddingHorizontal: 20,
        borderRadius: 24,
        fontSize: 16,
        fontWeight: '500',
        borderWidth: 1,
    },
    filterTabs: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        marginBottom: 12,
    },
    filterTab: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginHorizontal: 4,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    filterTabText: {
        fontSize: 13,
        fontWeight: '600',
    },
    itemContainer: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    statusIndicator: {
        width: 6,
        height: '100%',
    },
    itemContent: {
        flex: 1,
        padding: 16,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    itemTitle: {
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
    itemSubtitle: {
        fontSize: 14,
        marginBottom: 4,
    },
    itemDetails: {
        fontSize: 13,
    },
    chevron: {
        marginHorizontal: 8,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        marginTop: 12,
        textAlign: 'center',
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    emptyListContent: {
        flexGrow: 1,
    },
});

export default TripListScreen;