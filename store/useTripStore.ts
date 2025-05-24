// store/useTripStore.ts
import { create } from 'zustand';

// Define the structure of a single trip
export interface Trip {
  id: string;
  date: string; // Consider using Date objects or ISO strings
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distance: string; // Or number
  duration: string;
  routeCoordinates?: { latitude: number; longitude: number }[]; // Optional route
}

// Define the state structure
interface TripState {
  trips: Trip[];
  isLoading: boolean;
  error: string | null;
  fetchTrips: () => Promise<void>; // Function to load trips (e.g., from API/local)
  getRecentTrips: (count: number) => Trip[];
}

// Example Dummy Data (Replace with actual fetching logic)
const dummyTripsData: Trip[] = [
    { id: '1', date: '2025-05-23', startTime: '14:05', endTime: '14:31', startLocation: 'Home Base', endLocation: 'Client Office', distance: '15 km', duration: '26m', routeCoordinates: [{ latitude: 14.8433, longitude: 120.8134 }, { latitude: 14.80, longitude: 120.90 }] },
    { id: '2', date: '2025-05-22', startTime: '09:15', endTime: '09:45', startLocation: 'Client Office', endLocation: 'Warehouse', distance: '25 km', duration: '30m', routeCoordinates: [{ latitude: 14.80, longitude: 120.90 }, { latitude: 14.75, longitude: 120.95 }] },
    { id: '3', date: '2025-05-21', startTime: '17:30', endTime: '18:10', startLocation: 'Warehouse', endLocation: 'Home Base', distance: '28 km', duration: '40m', routeCoordinates: [{ latitude: 14.75, longitude: 120.95 }, { latitude: 14.8433, longitude: 120.8134 }] },
    { id: '4', date: '2025-05-20', startTime: '11:00', endTime: '11:20', startLocation: 'Home Base', endLocation: 'Supermarket', distance: '8 km', duration: '20m' },
];

export const useTripStore = create<TripState>((set, get) => ({
  trips: [], // Start empty, fetch on load
  isLoading: false,
  error: null,

  // --- Actions ---
  fetchTrips: async () => {
    set({ isLoading: true, error: null });
    try {
      // ** In a real app, you'd fetch from an API or AsyncStorage here **
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading
      set({ trips: dummyTripsData, isLoading: false });
    } catch (e: any) {
      set({ error: e.message || 'Failed to fetch trips', isLoading: false });
    }
  },

  // --- Selectors / Getters ---
  getRecentTrips: (count: number) => {
      const allTrips = get().trips;
      // Sort by date/time if needed before slicing, assuming newest first for now
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