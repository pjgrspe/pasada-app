import { auth } from '../FirebaseConfig';
import { 
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';

const db = getFirestore();

// Interface for favorite trip
export interface FavoriteTrip {
  id?: string; // Firestore document ID
  userId: string;
  name: string; // User-provided name for the favorite
  startLocation: {
    name: string;
    latitude: number;
    longitude: number;
    placeId?: string;
  };
  endLocation: {
    name: string;
    latitude: number;
    longitude: number;
    placeId?: string;
  };
  createdAt: Timestamp;
  lastUsed?: Timestamp; // When this favorite was last used
  useCount?: number; // How many times this favorite has been used
  tags?: string[]; // Optional tags for categorization
}

// Favorites Service Class
export class FirestoreFavoritesService {
  private static instance: FirestoreFavoritesService;

  static getInstance(): FirestoreFavoritesService {
    if (!FirestoreFavoritesService.instance) {
      FirestoreFavoritesService.instance = new FirestoreFavoritesService();
    }
    return FirestoreFavoritesService.instance;
  }

  // Create a new favorite
  async createFavorite(
    name: string,
    startLocation: { name: string; latitude: number; longitude: number; placeId?: string },
    endLocation: { name: string; latitude: number; longitude: number; placeId?: string },
    tags?: string[]
  ): Promise<string | null> {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error('No authenticated user found');
        return null;
      }

      const favoriteData: Omit<FavoriteTrip, 'id'> = {
        userId: user.uid,
        name,
        startLocation,
        endLocation,
        createdAt: Timestamp.now(),
        useCount: 0,
        tags: tags || []
      };

      // Save to Firestore
      const favoritesCollection = collection(db, 'favorites');
      const docRef = await addDoc(favoritesCollection, favoriteData);
      
      console.log('Favorite created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating favorite:', error);
      return null;
    }
  }

  // Get user favorites
  // Simplify the query to avoid compound index issues
  async getUserFavorites(): Promise<FavoriteTrip[]> {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      // Simplified query - just filter by userId and order by createdAt
      const q = query(
        collection(db, 'favorites'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const favorites: FavoriteTrip[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data() as FavoriteTrip;
        favorites.push({
          id: doc.id,
          ...data,
        });
      });

      // Sort by lastUsed in memory if needed
      return favorites.sort((a, b) => {
        if (!a.lastUsed && !b.lastUsed) return 0;
        if (!a.lastUsed) return 1;
        if (!b.lastUsed) return -1;
        return b.lastUsed.seconds - a.lastUsed.seconds;
      });
    } catch (error) {
      console.error('Error fetching user favorites:', error);
      return [];
    }
  }

  // Get favorite by ID
  async getFavoriteById(favoriteId: string): Promise<FavoriteTrip | null> {
    try {
      const user = auth.currentUser;
      if (!user) return null;

      const favoriteDoc = await getDoc(doc(db, 'favorites', favoriteId));
      
      if (!favoriteDoc.exists()) {
        return null;
      }

      const favoriteData = favoriteDoc.data() as FavoriteTrip;
      
      // Verify that this favorite belongs to the current user
      if (favoriteData.userId !== user.uid) {
        return null;
      }

      return {
        id: favoriteDoc.id,
        ...favoriteData,
      };
    } catch (error) {
      console.error('Error getting favorite by ID:', error);
      return null;
    }
  }

  // Update favorite (name, tags)
  async updateFavorite(
    favoriteId: string,
    updates: { name?: string; tags?: string[] }
  ): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      const favoriteRef = doc(db, 'favorites', favoriteId);
      await updateDoc(favoriteRef, updates);

      return true;
    } catch (error) {
      console.error('Error updating favorite:', error);
      return false;
    }
  }

  // Mark favorite as used (increment use count and update last used)
  async markFavoriteAsUsed(favoriteId: string): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      // Get current favorite to increment use count
      const favoriteDoc = await getDoc(doc(db, 'favorites', favoriteId));
      if (!favoriteDoc.exists()) return false;

      const favoriteData = favoriteDoc.data() as FavoriteTrip;
      if (favoriteData.userId !== user.uid) return false;

      const favoriteRef = doc(db, 'favorites', favoriteId);
      await updateDoc(favoriteRef, {
        lastUsed: Timestamp.now(),
        useCount: (favoriteData.useCount || 0) + 1
      });

      return true;
    } catch (error) {
      console.error('Error marking favorite as used:', error);
      return false;
    }
  }

  // Delete favorite
  async deleteFavorite(favoriteId: string): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) return false;

      // Verify ownership before deletion
      const favoriteRef = doc(db, 'favorites', favoriteId);
      const favoriteDoc = await getDoc(favoriteRef);
      
      if (!favoriteDoc.exists()) return false;

      const favoriteData = favoriteDoc.data() as FavoriteTrip;
      if (favoriteData.userId !== user.uid) return false;

      await deleteDoc(favoriteRef);
      return true;
    } catch (error) {
      console.error('Error deleting favorite:', error);
      return false;
    }
  }

  // Search favorites by name
  async searchFavorites(searchTerm: string): Promise<FavoriteTrip[]> {
    try {
      const favorites = await this.getUserFavorites();
      
      if (!searchTerm.trim()) {
        return favorites;
      }

      const searchLower = searchTerm.toLowerCase();
      return favorites.filter(favorite => 
        favorite.name.toLowerCase().includes(searchLower) ||
        favorite.startLocation.name.toLowerCase().includes(searchLower) ||
        favorite.endLocation.name.toLowerCase().includes(searchLower) ||
        favorite.tags?.some(tag => tag.toLowerCase().includes(searchLower))
      );
    } catch (error) {
      console.error('Error searching favorites:', error);
      return [];
    }
  }
}

// Export singleton instance
export const firestoreFavoritesService = FirestoreFavoritesService.getInstance();
