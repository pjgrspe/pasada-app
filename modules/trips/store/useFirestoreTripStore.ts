import { create } from 'zustand';
import { auth } from '@/FirebaseConfig';
import { 
  firestoreTripService, 
  FirestoreTrip, 
  TripStats 
} from '@/services/firestoreTripService';
import { Timestamp } from 'firebase/firestore';

// Define the structure of a single trip for display (keeping the same interface for UI compatibility)
export interface Trip {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distance: string;
  duration: string;
  status: 'active' | 'completed' | 'cancelled';
  routeCoordinates?: { latitude: number; longitude: number }[];
  rating?: number;
  notes?: string;
  tags?: string[];
  totalFare?: string;
  // Additional properties for UI compatibility
  totalDistance?: number;
  actualDuration?: number;
  estimatedDuration?: number;
}

// Define the state structure
interface TripState {
  trips: Trip[];
  isLoading: boolean;
  error: string | null;
  stats: TripStats | null;
    // Actions
  fetchTrips: (filters?: {
    status?: 'active' | 'completed' | 'cancelled';
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    tags?: string[];
  }) => Promise<void>;
  
  getTripById: (tripId: string) => Promise<Trip | null>;
  fetchTripStats: (startDate?: Date, endDate?: Date) => Promise<void>;
  refreshTrips: () => Promise<void>;
  addTripRating: (tripId: string, rating: number, notes?: string) => Promise<boolean>;
  updateTripTags: (tripId: string, tags: string[]) => Promise<boolean>;
  deleteTrip: (tripId: string) => Promise<boolean>;
  exportTrips: (format?: 'json' | 'csv') => Promise<string>;
  
  // Getters
  getRecentTrips: (count: number) => Trip[];
  getTripsByStatus: (status: 'active' | 'completed' | 'cancelled') => Trip[];
  getTripsByDateRange: (startDate: Date, endDate: Date) => Trip[];
  getTripsWithTag: (tag: string) => Trip[];
}

// Helper function to convert Firestore trip to display trip
function convertFirestoreTripToDisplayTrip(fbTrip: FirestoreTrip): Trip {
  // Format date from Firestore timestamp
  const startDate = fbTrip.startTime.toDate();
  const formattedDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Format times
  const startTimeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Format end time if available
  let endTimeStr = 'In progress';
  if (fbTrip.endTime) {
    const endDate = fbTrip.endTime.toDate();
    endTimeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Calculate distance in km
  const distanceKm = (fbTrip.totalDistance / 1000).toFixed(1);
  
  // Calculate duration
  let durationStr = '';
  if (fbTrip.endTime && fbTrip.actualDuration) {
    const durationMinutes = Math.round(fbTrip.actualDuration / 60);
    durationStr = `${durationMinutes}m`;
  } else {
    const estimatedMinutes = Math.round(fbTrip.estimatedDuration / 60);
    durationStr = `${estimatedMinutes}m (est)`;
  }
  
  // Extract route coordinates from steps
  const routeCoordinates = fbTrip.steps.flatMap(step => step.coordinates || []);
  
  // Format total fare
  const totalFareStr = fbTrip.totalFare ? `₱${fbTrip.totalFare.toFixed(2)}` : undefined;
    return {
    id: fbTrip.id!,
    date: formattedDate,
    startTime: startTimeStr,
    endTime: endTimeStr,
    startLocation: fbTrip.startLocation.name,
    endLocation: fbTrip.endLocation.name,
    distance: `${distanceKm} km`,
    duration: durationStr,
    status: fbTrip.status,
    routeCoordinates,
    rating: fbTrip.rating,
    notes: fbTrip.notes,
    tags: fbTrip.tags,
    totalFare: totalFareStr,
    // Additional properties for UI compatibility
    totalDistance: fbTrip.totalDistance,
    actualDuration: fbTrip.actualDuration,
    estimatedDuration: fbTrip.estimatedDuration,
  };
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  isLoading: false,
  error: null,
  stats: null,

  fetchTrips: async (filters) => {
    set({ isLoading: true, error: null });
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        set({ 
          error: 'You must be logged in to view trips',
          isLoading: false,
          trips: [] 
        });
        return;
      }
      
      // Fetch trips from Firestore
      const firestoreTrips = await firestoreTripService.getUserTrips(filters);
      
      // Convert to display format
      const formattedTrips = firestoreTrips.map(convertFirestoreTripToDisplayTrip);
      
      // Sort by date (newest first) - Firestore query already orders by createdAt desc
      formattedTrips.sort((a, b) => {
        return new Date(b.date + ' ' + b.startTime).getTime() - new Date(a.date + ' ' + a.startTime).getTime();
      });
      
      set({ trips: formattedTrips, isLoading: false });    } catch (e: any) {
      set({ error: e.message || 'Failed to fetch trips', isLoading: false });
    }
  },

  getTripById: async (tripId: string) => {
    try {
      if (!auth.currentUser) {
        console.error('User must be logged in to get trip details');
        return null;
      }

      const fbTrip = await firestoreTripService.getTripById(tripId);
      if (!fbTrip) {
        return null;
      }

      return convertFirestoreTripToDisplayTrip(fbTrip);
    } catch (e: any) {
      console.error('Failed to get trip by ID:', e);
      return null;
    }
  },

  fetchTripStats: async (startDate, endDate) => {
    try {
      if (!auth.currentUser) {
        set({ error: 'You must be logged in to view stats' });
        return;
      }

      const stats = await firestoreTripService.getTripStats(startDate, endDate);
      set({ stats });
    } catch (e: any) {
      set({ error: e.message || 'Failed to fetch trip statistics' });
    }
  },

  refreshTrips: async () => {
    const currentState = get();
    await currentState.fetchTrips();
  },

  addTripRating: async (tripId: string, rating: number, notes?: string) => {
    try {
      const success = await firestoreTripService.updateTripFeedback(tripId, rating, notes);
      
      if (success) {
        // Update local state
        set(state => ({
          trips: state.trips.map(trip => 
            trip.id === tripId 
              ? { ...trip, rating, notes: notes || trip.notes }
              : trip
          )
        }));
      }
      
      return success;
    } catch (e: any) {
      set({ error: e.message || 'Failed to add trip rating' });
      return false;
    }
  },

  updateTripTags: async (tripId: string, tags: string[]) => {
    try {
      const success = await firestoreTripService.updateTripTags(tripId, tags);
      
      if (success) {
        // Update local state
        set(state => ({
          trips: state.trips.map(trip => 
            trip.id === tripId 
              ? { ...trip, tags }
              : trip
          )
        }));
      }
      
      return success;
    } catch (e: any) {
      set({ error: e.message || 'Failed to update trip tags' });
      return false;
    }
  },

  deleteTrip: async (tripId: string) => {
    try {
      const success = await firestoreTripService.deleteTrip(tripId);
      
      if (success) {
        // Remove from local state
        set(state => ({
          trips: state.trips.filter(trip => trip.id !== tripId)
        }));
      }
      
      return success;
    } catch (e: any) {
      set({ error: e.message || 'Failed to delete trip' });
      return false;
    }
  },

  exportTrips: async (format = 'json') => {
    try {
      return await firestoreTripService.exportUserTrips(format);
    } catch (e: any) {
      set({ error: e.message || 'Failed to export trips' });
      return '';
    }
  },

  // Selectors / Getters
  getRecentTrips: (count: number) => {
    const allTrips = get().trips;
    return allTrips.slice(0, count);
  },

  getTripsByStatus: (status: 'active' | 'completed' | 'cancelled') => {
    const allTrips = get().trips;
    return allTrips.filter(trip => trip.status === status);
  },

  getTripsByDateRange: (startDate: Date, endDate: Date) => {
    const allTrips = get().trips;
    return allTrips.filter(trip => {
      const tripDate = new Date(trip.date);
      return tripDate >= startDate && tripDate <= endDate;
    });
  },
  getTripsWithTag: (tag: string) => {
    const allTrips = get().trips;
    return allTrips.filter(trip => trip.tags?.includes(tag));
  }
}));

// Export as useFirestoreTripStore for clarity
export const useFirestoreTripStore = useTripStore;

// Also export as default
export default useTripStore;
