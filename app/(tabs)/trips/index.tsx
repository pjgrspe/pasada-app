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
import { useFirestoreTripStore, Trip } from '@/modules/trips/store/useFirestoreTripStore';
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

    // Format the trip data for display
    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString();
    };

    const formatTime = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDistance = (distance: number) => {
        if (!distance) return 'N/A';
        return `${(distance / 1000).toFixed(1)} km`;
    };

    const formatDuration = (duration: number) => {
        if (!duration) return 'N/A';
        const minutes = Math.round(duration / 60);
        return `${minutes} min`;
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
            
            <View style={styles.itemContent}>                <View style={styles.locationRow}>
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                        {item.startLocation || 'Unknown Start'}
                    </Text>
                    <Icon name="chevron-forward" size={20} color={colors.primary} style={styles.chevron} />
                    <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                        {item.endLocation || 'Unknown End'}
                    </Text>
                </View>

                <Text style={[styles.itemSubtitle, { color: colors.text, opacity: 0.75 }]}>
                    {formatDate(item.startTime)} | {formatTime(item.startTime)}–{item.endTime ? formatTime(item.endTime) : 'In progress'}
                </Text>                <Text style={[styles.itemDetails, { color: colors.text, opacity: 0.6 }]}>
                    {formatDistance(item.totalDistance || 0)} • {formatDuration(item.actualDuration || item.estimatedDuration || 0)}
                    {item.rating && (
                        <Text style={{ color: colors.primary }}> • ⭐ {item.rating}</Text>
                    )}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const TripListScreen = () => {
    const { colors } = useTheme();
    const { trips, isLoading, error, fetchTrips } = useFirestoreTripStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

    useEffect(() => {
        // Always fetch trips when component mounts
        fetchTrips();
    }, []);

    const filteredTrips = useMemo(() =>
        trips.filter(trip => {
            // Apply text search
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery || 
                trip.startLocation?.toLowerCase().includes(searchLower) ||
                trip.endLocation?.toLowerCase().includes(searchLower);
            
            // Apply status filter
            const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        }), [trips, searchQuery, statusFilter]);

    // Loading state - only show if we're loading AND have no trips yet
    if (isLoading && trips.length === 0) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Loader text="Loading trips..." color={colors.primary} />
            </View>
        );
    }

    // Error state - only show if there's an error AND no trips loaded
    if (error && trips.length === 0) {
        return (
            <View style={[styles.centered, { backgroundColor: colors.background }]}>
                <Icon name="alert-circle-outline" size={60} color={colors.error} />
                <Text style={[styles.errorText, { color: colors.error }]}>
                    Error loading trips
                </Text>
                <Text style={[styles.errorSubtext, { color: colors.text, opacity: 0.7 }]}>
                    {error}
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

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Search Input */}
            <TextInput
                style={[styles.searchInput, {
                    backgroundColor: colors.card,
                    color: colors.text,
                    borderColor: colors.border,
                }]}
                placeholder="Search by location..."
                placeholderTextColor={colors.text + '88'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
            />

            {/* Status filter tabs */}
            <View style={styles.filterTabs}>
                {(['all', 'active', 'completed', 'cancelled'] as const).map((status) => (
                    <TouchableOpacity
                        key={status}
                        style={[
                            styles.filterTab,
                            statusFilter === status && { 
                                backgroundColor: colors.primary + '20', 
                                borderColor: colors.primary 
                            }
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

            {/* Trip List */}
            <FlatList
                data={filteredTrips}
                renderItem={({ item }) => <TripListItem item={item} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={filteredTrips.length === 0 ? styles.emptyListContent : styles.listContent}
                ListEmptyComponent={() => (
                    <View style={styles.emptyContainer}>
                        <Icon name="map-outline" size={80} color={colors.text + '40'} />
                        <Text style={[styles.emptyText, { color: colors.text }]}>
                            {searchQuery || statusFilter !== 'all' 
                                ? 'No trips match your search' 
                                : 'No trips yet'
                            }
                        </Text>
                        <Text style={[styles.emptySubtext, { color: colors.text, opacity: 0.6 }]}>
                            {searchQuery || statusFilter !== 'all' 
                                ? 'Try adjusting your filters' 
                                : 'Start a trip from the home screen to see it here'
                            }
                        </Text>
                    </View>
                )}
                showsVerticalScrollIndicator={false}
                refreshing={isLoading}
                onRefresh={fetchTrips}
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
        paddingHorizontal: 20,
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
        paddingTop: 100,
        paddingHorizontal: 20,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    emptySubtext: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    listContent: {
        paddingTop: 8,
        paddingBottom: 24,
    },
    emptyListContent: {
        flexGrow: 1,
    },
    errorText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
        textAlign: 'center',
    },
    errorSubtext: {
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    retryText: {
        fontSize: 16,
        fontWeight: '600',
    },
});

export default TripListScreen;