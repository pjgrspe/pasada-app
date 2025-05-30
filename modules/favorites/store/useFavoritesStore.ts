import { create } from 'zustand';
import { auth } from '@/FirebaseConfig';
import { 
  firestoreFavoritesService, 
  FavoriteTrip
} from '@/services/firestoreFavoritesService';

// Define the state structure
interface FavoritesState {
  favorites: FavoriteTrip[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchFavorites: () => Promise<void>;
  getFavoriteById: (favoriteId: string) => Promise<FavoriteTrip | null>;
  createFavorite: (
    name: string,
    startLocation: { name: string; latitude: number; longitude: number; placeId?: string },
    endLocation: { name: string; latitude: number; longitude: number; placeId?: string },
    tags?: string[]
  ) => Promise<string | null>;
  updateFavorite: (favoriteId: string, updates: { name?: string; tags?: string[] }) => Promise<boolean>;
  deleteFavorite: (favoriteId: string) => Promise<boolean>;
  markFavoriteAsUsed: (favoriteId: string) => Promise<boolean>;
  searchFavorites: (searchTerm: string) => Promise<FavoriteTrip[]>;
  refreshFavorites: () => Promise<void>;

  // Selectors / Getters
  getRecentlyUsedFavorites: (count: number) => FavoriteTrip[];
  getMostUsedFavorites: (count: number) => FavoriteTrip[];
  getFavoritesByTag: (tag: string) => FavoriteTrip[];
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  isLoading: false,
  error: null,

  fetchFavorites: async () => {
    set({ isLoading: true, error: null });
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        set({ 
          error: 'You must be logged in to view favorites',
          isLoading: false,
          favorites: [] 
        });
        return;
      }
      
      // Fetch favorites from Firestore
      const firestoreFavorites = await firestoreFavoritesService.getUserFavorites();
      
      set({ favorites: firestoreFavorites, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to fetch favorites', isLoading: false });
    }
  },

  getFavoriteById: async (favoriteId: string) => {
    try {
      if (!auth.currentUser) {
        console.error('User must be logged in to get favorite details');
        return null;
      }

      const favorite = await firestoreFavoritesService.getFavoriteById(favoriteId);
      if (!favorite) {
        return null;
      }

      return favorite;
    } catch (e: any) {
      console.error('Failed to get favorite by ID:', e);
      return null;
    }
  },

  createFavorite: async (name, startLocation, endLocation, tags) => {
    try {
      if (!auth.currentUser) {
        set({ error: 'You must be logged in to create favorites' });
        return null;
      }

      const favoriteId = await firestoreFavoritesService.createFavorite(
        name,
        startLocation,
        endLocation,
        tags
      );

      if (favoriteId) {
        // Refresh the favorites list
        await get().fetchFavorites();
      }

      return favoriteId;
    } catch (e: any) {
      set({ error: e.message || 'Failed to create favorite' });
      return null;
    }
  },

  updateFavorite: async (favoriteId: string, updates: { name?: string; tags?: string[] }) => {
    try {
      const success = await firestoreFavoritesService.updateFavorite(favoriteId, updates);
      
      if (success) {
        // Update local state
        set(state => ({
          favorites: state.favorites.map(favorite =>
            favorite.id === favoriteId ? { ...favorite, ...updates } : favorite
          )
        }));
      }
      
      return success;
    } catch (e: any) {
      set({ error: e.message || 'Failed to update favorite' });
      return false;
    }
  },

  deleteFavorite: async (favoriteId: string) => {
    try {
      const success = await firestoreFavoritesService.deleteFavorite(favoriteId);
      
      if (success) {
        // Remove from local state
        set(state => ({
          favorites: state.favorites.filter(favorite => favorite.id !== favoriteId)
        }));
      }
      
      return success;
    } catch (e: any) {
      set({ error: e.message || 'Failed to delete favorite' });
      return false;
    }
  },

  markFavoriteAsUsed: async (favoriteId: string) => {
    try {
      const success = await firestoreFavoritesService.markFavoriteAsUsed(favoriteId);
      
      if (success) {
        // Refresh favorites to get updated use count and last used
        await get().fetchFavorites();
      }
      
      return success;
    } catch (e: any) {
      set({ error: e.message || 'Failed to mark favorite as used' });
      return false;
    }
  },

  searchFavorites: async (searchTerm: string) => {
    try {
      return await firestoreFavoritesService.searchFavorites(searchTerm);
    } catch (e: any) {
      set({ error: e.message || 'Failed to search favorites' });
      return [];
    }
  },

  refreshFavorites: async () => {
    const currentState = get();
    await currentState.fetchFavorites();
  },

  // Selectors / Getters
  getRecentlyUsedFavorites: (count: number) => {
    const allFavorites = get().favorites;
    return allFavorites
      .filter(favorite => favorite.lastUsed)
      .sort((a, b) => {
        const aTime = a.lastUsed?.seconds || 0;
        const bTime = b.lastUsed?.seconds || 0;
        return bTime - aTime;
      })
      .slice(0, count);
  },

  getMostUsedFavorites: (count: number) => {
    const allFavorites = get().favorites;
    return allFavorites
      .filter(favorite => (favorite.useCount || 0) > 0)
      .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
      .slice(0, count);
  },

  getFavoritesByTag: (tag: string) => {
    const allFavorites = get().favorites;
    return allFavorites.filter(favorite => favorite.tags?.includes(tag));
  }
}));

// Export as useFirestoreFavoritesStore for clarity
export const useFirestoreFavoritesStore = useFavoritesStore;

// Also export as default
export default useFavoritesStore;
