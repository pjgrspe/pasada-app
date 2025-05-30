import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Dimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTripStore } from '@/modules/trips/store/useFirestoreTripStore';
import Loader from '@/components/Loader';

const { width } = Dimensions.get('window');

export const TripAnalytics: React.FC = () => {
  const { colors } = useTheme();
  const { stats, fetchTripStats, isLoading } = useTripStore();
  const [timeFrame, setTimeFrame] = useState<'week' | 'month' | 'year' | 'all'>('month');

  useEffect(() => {
    loadStats();
  }, [timeFrame]);

  const loadStats = () => {
    const now = new Date();
    let startDate: Date | undefined;

    switch (timeFrame) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
      default:
        startDate = undefined;
        break;
    }

    fetchTripStats(startDate);
  };

  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatCurrency = (amount: number): string => {
    return `₱${amount.toFixed(2)}`;
  };

  const timeFrameOptions = [
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
    { key: 'all', label: 'All Time' },
  ];

  if (isLoading && !stats) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Loader text="Loading analytics..." />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          Failed to load analytics
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Time Frame Selector */}
      <View style={styles.timeFrameContainer}>
        {timeFrameOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.timeFrameButton,
              { 
                backgroundColor: timeFrame === option.key ? colors.primary : colors.card,
                borderColor: colors.border 
              }
            ]}
            onPress={() => setTimeFrame(option.key as any)}
          >
            <Text
              style={[
                styles.timeFrameText,
                { 
                  color: timeFrame === option.key ? '#FFFFFF' : colors.text 
                }
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Overview Stats */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="car" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {stats.totalTrips}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text, opacity: 0.7 }]}>
            Total Trips
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="map" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDistance(stats.totalDistance)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text, opacity: 0.7 }]}>
            Total Distance
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="time" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDuration(stats.totalDuration)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text, opacity: 0.7 }]}>
            Total Time
          </Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="analytics" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDistance(stats.averageDistance)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.text, opacity: 0.7 }]}>
            Avg Distance
          </Text>
        </View>
      </View>

      {/* Most Used Routes */}
      {stats.mostUsedRoutes.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Most Used Routes
          </Text>
          {stats.mostUsedRoutes.slice(0, 5).map((route, index) => (
            <View key={route.routeName} style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Text style={[styles.rankText, { color: colors.primary }]}>
                  #{index + 1}
                </Text>
                <Text style={[styles.routeName, { color: colors.text }]}>
                  {route.routeName}
                </Text>
              </View>
              <Text style={[styles.routeCount, { color: colors.text, opacity: 0.7 }]}>
                {route.count} trips
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Favorite Destinations */}
      {stats.favoriteDestinations.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Favorite Destinations
          </Text>
          {stats.favoriteDestinations.slice(0, 5).map((destination, index) => (
            <View key={destination.locationName} style={styles.listItem}>
              <View style={styles.listItemLeft}>
                <Text style={[styles.rankText, { color: colors.primary }]}>
                  #{index + 1}
                </Text>
                <Text style={[styles.routeName, { color: colors.text }]}>
                  {destination.locationName}
                </Text>
              </View>
              <Text style={[styles.routeCount, { color: colors.text, opacity: 0.7 }]}>
                {destination.count} visits
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {stats.totalTrips === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="analytics-outline" size={64} color={colors.text} style={{ opacity: 0.3 }} />
          <Text style={[styles.emptyStateText, { color: colors.text, opacity: 0.7 }]}>
            No trip data available for {timeFrameOptions.find(o => o.key === timeFrame)?.label.toLowerCase()}
          </Text>
          <Text style={[styles.emptyStateSubtext, { color: colors.text, opacity: 0.5 }]}>
            Start taking trips to see your analytics here!
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  timeFrameContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  timeFrameButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  timeFrameText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: (width - 48) / 2,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankText: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 24,
  },
  routeName: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  routeCount: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
});
