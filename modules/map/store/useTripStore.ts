// store/useTripStore.ts
import { create } from 'zustand';
import { auth } from '@/FirebaseConfig';
import { getUserTrips, Trip as FirebaseTrip } from '@/services/tripService';

// Define the structure of a single trip for display
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
}

// Define the state structure
interface TripState {
  trips: Trip[];
  isLoading: boolean;
  error: string | null;
  fetchTrips: () => Promise<void>;
  getRecentTrips: (count: number) => Trip[];
}

// Helper function to convert Firebase trip to display trip
function convertFirebaseTripToDisplayTrip(fbTrip: FirebaseTrip): Trip {
  // Format date from timestamp
  const startDate = new Date(fbTrip.startTime);
  const formattedDate = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Format times
  const startTimeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Format end time if available
  let endTimeStr = 'In progress';
  if (fbTrip.endTime) {
    const endDate = new Date(fbTrip.endTime);
    endTimeStr = endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Calculate distance in km
  const distanceKm = (fbTrip.totalDistance / 1000).toFixed(1);
  
  // Calculate duration
  let durationStr = '';
  if (fbTrip.endTime) {
    const durationMinutes = Math.round((fbTrip.endTime - fbTrip.startTime) / 60000);
    durationStr = `${durationMinutes}m`;
  } else {
    durationStr = `${Math.round(fbTrip.estimatedDuration / 60)}m (est)`;
  }
  
  // Extract route coordinates
  const routeCoordinates = fbTrip.steps.flatMap(step => step.coordinates || []);
  
  return {
    id: fbTrip.id,
    date: formattedDate,
    startTime: startTimeStr,
    endTime: endTimeStr,
    startLocation: fbTrip.startLocation.name,
    endLocation: fbTrip.endLocation.name,
    distance: `${distanceKm} km`,
    duration: durationStr,
    status: fbTrip.status,
    routeCoordinates
  };
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  isLoading: false,
  error: null,

  fetchTrips: async () => {
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
      
      // Fetch trips from Firebase
      const firebaseTrips = await getUserTrips();
      
      // Convert to display format
      const formattedTrips = firebaseTrips.map(convertFirebaseTripToDisplayTrip);
      
      // Sort by date (newest first)
      formattedTrips.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      set({ trips: formattedTrips, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to fetch trips', isLoading: false });
    }
  },

  // Selectors / Getters
  getRecentTrips: (count: number) => {
    const allTrips = get().trips;
    return allTrips.slice(0, count);
  }
}));

// Optional: Call fetchTrips once when the app loads or store initializes
// This ensures data is available when screens mount.
// You might do this in your root _layout.tsx inside a useEffect.
// Example:
// useEffect(() => {
//   useTripStore.getState().fetchTrips();
// }, []);