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
    Alert,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';
import { useFirestoreTripStore, Trip } from '@/modules/trips/store/useFirestoreTripStore';
import Loader from '../../../components/Loader';
import Icon from 'react-native-vector-icons/Ionicons';

const TripListItem = ({ item, onDelete }: { item: Trip; onDelete: (tripId: string) => void }) => {
    const { colors } = useTheme();
    const router = useRouter();
    const translateX = useSharedValue(0);

    // Helper to determine the status indicator color
    const getStatusColor = () => {
        switch (item.status) {
            case 'active': return colors.primary;
            case 'completed': return colors.success;
            case 'cancelled': return colors.error;
            default: return colors.text;
        }
    };

    // Simplified formatting functions (keep existing)
    const formatDate = (timestamp: any) => {
        if (typeof timestamp === 'string' && timestamp.includes('-')) {
            try {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    return date.toLocaleDateString([], { 
                        year: 'numeric', 
                        month: 'short', 
                        day: 'numeric' 
                    });
                }
            } catch (error) {
                return 'N/A';
            }
        }
        return 'N/A';
    };

    const formatDistance = (distance: number | string) => {
        if (typeof distance === 'string') {
            return distance;
        }
        if (!distance || isNaN(distance)) return 'N/A';
        return `${(distance / 1000).toFixed(1)} km`;
    };

    const formatDuration = (duration: number | string) => {
        if (typeof duration === 'string') {
            return duration;
        }
        if (!duration || isNaN(duration)) return 'N/A';
        const minutes = Math.round(duration / 60);
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${minutes}m`;
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Trip',
            'Are you sure you want to delete this trip? This action cannot be undone.',
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                    onPress: () => {
                        // Reset position
                        translateX.value = withSpring(0);
                    }
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        onDelete(item.id);
                        // Reset position
                        translateX.value = withSpring(0);
                    }
                }
            ]
        );
    };

    // Pan gesture using new Gesture API
    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            // Only allow left swipe (negative values)
            if (event.translationX < 0) {
                translateX.value = event.translationX;
            }
        })
        .onEnd((event) => {
            if (event.translationX < -80) {
                // Show delete button
                translateX.value = withSpring(-80);
            } else {
                // Reset position
                translateX.value = withSpring(0);
            }
        });

    // Animated style for the main item
    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }],
        };
    });

    // Animated style for the delete button to control its visibility
    const deleteButtonStyle = useAnimatedStyle(() => {
        return {
            opacity: translateX.value < -20 ? 1 : 0,
        };
    });

    // Get location names with proper fallbacks
    const startLocationName = typeof item.startLocation === 'object' ? (item.startLocation as any)?.name : item.startLocation || 'Unknown Start';
    const endLocationName = typeof item.endLocation === 'object' ? (item.endLocation as any)?.name : item.endLocation || 'Unknown End';

    return (
        <GestureHandlerRootView style={styles.swipeContainer}>
            {/* Delete button (behind the item) */}
            <Animated.View style={[styles.deleteButton, { backgroundColor: colors.error }, deleteButtonStyle]}>
                <TouchableOpacity
                    style={styles.deleteButtonTouchable}
                    onPress={handleDelete}
                    activeOpacity={0.8}
                >
                    <Icon name="trash-outline" size={24} color="white" />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Main item */}
            <GestureDetector gesture={panGesture}>
                <Animated.View
                    style={[
                        styles.itemContainer,
                        {
                            backgroundColor: colors.card,
                            shadowColor: '#000',
                            borderColor: colors.border,
                        },
                        animatedStyle,
                    ]}
                >
                    <TouchableOpacity
                        style={styles.itemTouchable}
                        activeOpacity={0.8}
                        onPress={() => router.push(`/(tabs)/trips/${item.id}`)}
                    >
                        {/* Status indicator */}
                        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]} />
                        
                        <View style={styles.itemContent}>
                            <View style={styles.locationRow}>
                                <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                                    {startLocationName}
                                </Text>
                                <Icon name="chevron-forward" size={20} color={colors.primary} style={styles.chevron} />
                                <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                                    {endLocationName}
                                </Text>
                            </View>

                            <Text style={[styles.itemSubtitle, { color: colors.text, opacity: 0.75 }]}>
                                {item.date || formatDate(item.startTime)} | {item.startTime || 'N/A'}–{item.endTime || 'In progress'}
                            </Text>

                            <View style={styles.itemDetailsContainer}>
                                <Text style={[styles.itemDetails, { color: colors.text, opacity: 0.6 }]}>
                                    {item.distance || formatDistance(item.totalDistance || 0)} • {item.duration || formatDuration(item.actualDuration || item.estimatedDuration || 0)}
                                </Text>
                                {item.rating && (
                                    <Text style={[styles.itemRating, { color: colors.primary }]}>
                                        {' '} • ⭐ {item.rating}
                                    </Text>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                </Animated.View>
            </GestureDetector>
        </GestureHandlerRootView>
    );
};

const TripListScreen = () => {
    const { colors } = useTheme();
    const { trips, isLoading, error, fetchTrips, deleteTrip } = useFirestoreTripStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        // Always fetch trips when component mounts
        fetchTrips();
    }, [fetchTrips]);

    // Handle pull-to-refresh
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetchTrips();
        } catch (error) {
            console.error('Error refreshing trips:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Handle trip deletion
    const handleDeleteTrip = async (tripId: string) => {
        try {
            await deleteTrip(tripId);
            // Optionally show a success message
        } catch (error) {
            console.error('Error deleting trip:', error);
            Alert.alert(
                'Error',
                'Failed to delete trip. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    const filteredTrips = useMemo(() =>
        trips.filter((trip: Trip) => {
            // Apply text search - FIXED to handle proper data structure
            const searchLower = searchQuery.toLowerCase();
            const startLocationName = typeof trip.startLocation === 'object' ? (trip.startLocation as any)?.name : trip.startLocation || '';
            const endLocationName = typeof trip.endLocation === 'object' ? (trip.endLocation as any)?.name : trip.endLocation || '';
            
            const matchesSearch = !searchQuery || 
                startLocationName.toLowerCase().includes(searchLower) ||
                endLocationName.toLowerCase().includes(searchLower);
            
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
                renderItem={({ item }) => <TripListItem item={item} onDelete={handleDeleteTrip} />}
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
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
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
    swipeContainer: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        position: 'relative',
        overflow: 'hidden',
    },
    deleteButton: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: 80,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
        zIndex: 1, // Ensure it's above other elements
    },
    deleteButtonTouchable: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButtonText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
    itemContainer: {
        borderRadius: 12,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
        flexDirection: 'row',
        overflow: 'hidden',
        backgroundColor: 'white', // Ensure it has a background
        zIndex: 2, // Ensure it's above the delete button initially
    },
    itemTouchable: {
        flex: 1,
        flexDirection: 'row',
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
    itemDetailsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemRating: {
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