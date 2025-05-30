import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Text } from '@/components/Themed';
import { useTheme } from '@/hooks/useTheme';
import { useFavoritesStore } from '@/modules/favorites/store/useFavoritesStore';
import { FavoriteTrip } from '@/services/firestoreFavoritesService';

export default function FavoritesScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const {
    favorites,
    isLoading,
    error,
    fetchFavorites,
    deleteFavorite,
    markFavoriteAsUsed,
    searchFavorites,
    refreshFavorites
  } = useFavoritesStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredFavorites, setFilteredFavorites] = useState<FavoriteTrip[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    searchContainer: {
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchInput: {
      backgroundColor: colors.background,
      color: colors.text,
      borderColor: colors.border,
    },
    favoriteCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    favoriteText: {
      color: colors.text,
    },
    subText: {
      color: colors.text + '80',
    },
    emptyText: {
      color: colors.text + '60',
    },
    errorText: {
      color: colors.error,
    },
  });

  // Fetch favorites on component mount
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Update filtered favorites when search term or favorites change
  useEffect(() => {
    if (searchTerm.trim()) {
      searchFavorites(searchTerm).then(setFilteredFavorites);
    } else {
      setFilteredFavorites(favorites);
    }
  }, [searchTerm, favorites, searchFavorites]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshFavorites();
    setRefreshing(false);
  }, [refreshFavorites]);

  const handleDeleteFavorite = useCallback((favoriteId: string, favoriteName: string) => {
    Alert.alert(
      'Delete Favorite',
      `Are you sure you want to delete "${favoriteName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteFavorite(favoriteId)
        }
      ]
    );
  }, [deleteFavorite]);

  const handleUseFavorite = useCallback(async (favorite: FavoriteTrip) => {
    // Mark as used
    await markFavoriteAsUsed(favorite.id!);
      // Navigate to dashboard with the favorite's locations pre-filled
    router.push({
      pathname: '/(tabs)',
      params: {
        startLocation: JSON.stringify({
          name: favorite.startLocation.name,
          latitude: favorite.startLocation.latitude,
          longitude: favorite.startLocation.longitude
        }),
        endLocation: JSON.stringify({
          name: favorite.endLocation.name,
          latitude: favorite.endLocation.latitude,
          longitude: favorite.endLocation.longitude
        })
      }
    });
  }, [markFavoriteAsUsed, router]);

  const renderFavoriteItem = ({ item }: { item: FavoriteTrip }) => (
    <TouchableOpacity
      style={[styles.favoriteCard, dynamicStyles.favoriteCard]}
      onPress={() => handleUseFavorite(item)}
    >
      <View style={styles.favoriteHeader}>
        <Text style={[styles.favoriteName, dynamicStyles.favoriteText]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.favoriteActions}>
          {item.useCount && item.useCount > 0 && (
            <View style={styles.useCountBadge}>
              <Text style={styles.useCountText}>{item.useCount}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteFavorite(item.id!, item.name)}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color="#4CAF50" />
          <Text style={[styles.locationText, dynamicStyles.subText]} numberOfLines={2}>
            {item.startLocation.name}
          </Text>
        </View>
        <View style={styles.arrow}>
          <Ionicons name="arrow-down" size={16} color={dynamicStyles.subText.color} />
        </View>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={16} color="#F44336" />
          <Text style={[styles.locationText, dynamicStyles.subText]} numberOfLines={2}>
            {item.endLocation.name}
          </Text>
        </View>
      </View>

      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.slice(0, 3).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {item.tags.length > 3 && (
            <Text style={[styles.moreTagsText, dynamicStyles.subText]}>
              +{item.tags.length - 3} more
            </Text>
          )}
        </View>
      )}

      {item.lastUsed && (
        <Text style={[styles.lastUsedText, dynamicStyles.subText]}>
          Last used: {item.lastUsed.toDate().toLocaleDateString()}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="heart-outline" size={64} color={dynamicStyles.emptyText.color} />
      <Text style={[styles.emptyTitle, dynamicStyles.emptyText]}>No Favorites Yet</Text>
      <Text style={[styles.emptySubtitle, dynamicStyles.subText]}>
        Add your frequent routes to favorites for quick access
      </Text>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/(tabs)')}
      >
        <Text style={[styles.addButtonText, { color: colors.headerText }]}>
          Plan a Route
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="alert-circle-outline" size={64} color={colors.error} />
      <Text style={[styles.emptyTitle, dynamicStyles.errorText]}>Error Loading Favorites</Text>
      <Text style={[styles.emptySubtitle, dynamicStyles.subText]}>
        {error}
      </Text>
      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={fetchFavorites}
      >
        <Text style={[styles.addButtonText, { color: colors.headerText }]}>
          Try Again
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Add this before the return statement
  console.log('FavoritesScreen render:', {
    isLoading,
    error,
    favoritesCount: favorites.length,
    filteredCount: filteredFavorites.length,
    searchTerm
  });

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, dynamicStyles.searchContainer]}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={colors.text + '60'} />
          <TextInput
            style={[styles.searchInput, dynamicStyles.searchInput]}
            placeholder="Search favorites..."
            placeholderTextColor={colors.text + '60'}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color={colors.text + '60'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Action Bar */}
      <View style={[styles.actionBar, { backgroundColor: colors.card }]}>
        <Text style={[styles.countText, dynamicStyles.subText]}>
          {filteredFavorites.length} favorite{filteredFavorites.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefresh}
          disabled={refreshing}
        >
          <Ionicons 
            name="refresh" 
            size={20} 
            color={colors.primary} 
            style={refreshing ? { opacity: 0.5 } : {}}
          />
        </TouchableOpacity>
      </View>

      {/* Favorites List */}
      {isLoading && favorites.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, dynamicStyles.subText]}>Loading favorites...</Text>
        </View>
      ) : error && favorites.length === 0 ? (
        renderErrorState()
      ) : filteredFavorites.length === 0 && searchTerm.trim() ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color={dynamicStyles.emptyText.color} />
          <Text style={[styles.emptyTitle, dynamicStyles.emptyText]}>No Results Found</Text>
          <Text style={[styles.emptySubtitle, dynamicStyles.subText]}>
            Try a different search term
          </Text>
        </View>
      ) : filteredFavorites.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={filteredFavorites}
          renderItem={renderFavoriteItem}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  countText: {
    fontSize: 14,
  },
  refreshButton: {
    padding: 4,
  },
  listContainer: {
    padding: 16,
  },
  favoriteCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  favoriteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  favoriteName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  favoriteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  useCountBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  useCountText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  arrow: {
    alignItems: 'center',
    marginVertical: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 6,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 12,
    alignSelf: 'center',
  },
  lastUsedText: {
    fontSize: 12,
    textAlign: 'right',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  addButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
