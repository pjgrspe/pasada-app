import { auth } from '../FirebaseConfig';
import { 
  getDatabase, 
  ref, 
  push, 
  set, 
  update, 
  onValue,
  off,
  query,
  orderByChild,
  equalTo,  // Add this import
  get,
  remove
} from 'firebase/database';
import { Coordinate, PlannedTripLeg } from '../modules/map/utils/routeTypes';
// Add this import for generating unique IDs
import uuid from 'react-native-uuid';
// If you don't have uuid installed, run: npm install uuid @types/uuid

const db = getDatabase();

export interface TripStep {
  id: string;
  type: 'walk' | 'jeepney';
  routeId?: string;
  routeName?: string;
  routeColor?: string;
  startLocation: {
    name: string;
    latitude: number;
    longitude: number;
  };
  endLocation: {
    name: string;
    latitude: number;
    longitude: number;
  };
  status: 'pending' | 'active' | 'completed';
  distance: number;
  duration: number;
  startTime: number | null;
  endTime: number | null;
  coordinates: Coordinate[];
  instructions?: string;
}

export interface Trip {
  id: string;
  status: 'active' | 'completed' | 'cancelled';
  startTime: number;
  endTime: number | null;
  startLocation: {
    name: string;
    latitude: number;
    longitude: number;
  };
  endLocation: {
    name: string;
    latitude: number;
    longitude: number;
  };
  selectedRouteIndex: number;
  totalDistance: number;
  estimatedDuration: number;
  steps: TripStep[];
}

// Create a new trip
export async function createTrip(
  startLocation: { name: string; latitude: number; longitude: number },
  endLocation: { name: string; latitude: number; longitude: number },
  selectedRouteIndex: number,
  tripLegs: PlannedTripLeg[]
): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user found');
      return null;
    }

    // Convert trip legs to steps
    const steps: TripStep[] = tripLegs.map((leg, index) => {
    const coordinates = leg.coordinates || [];
      
      // Generate a unique routeId for steps that don't have one (like walking segments)
    const routeId = leg.routeId || `${leg.type}-${String(uuid.v4()).substring(0, 8)}`;      
      return {
        id: `step-${index}`,
        type: leg.type as 'walk' | 'jeepney',
        routeId: routeId, // Use the generated ID if original is missing
        routeName: leg.routeName || (leg.type === 'walk' ? 'Walking' : 'Unknown Route'),
        routeColor: leg.routeColor || (leg.type === 'walk' ? '#777777' : '#0066CC'),
        startLocation: {
          name: leg.jeepBoardingPointInfo || (index === 0 ? startLocation.name : '') || 'Start point',
          latitude: coordinates[0]?.latitude || 0,
          longitude: coordinates[0]?.longitude || 0,
        },
        endLocation: {
          name: leg.jeepAlightingPointInfo || (index === tripLegs.length - 1 ? endLocation.name : '') || 'End point',
          latitude: coordinates[coordinates.length - 1]?.latitude || 0,
          longitude: coordinates[coordinates.length - 1]?.longitude || 0,
        },
        status: index === 0 ? 'active' : 'pending',
        distance: typeof leg.distance === 'number' ? leg.distance : 0,
        duration: typeof leg.duration === 'number' ? leg.duration : 0,
        startTime: index === 0 ? Date.now() : null,
        endTime: null,
        coordinates: coordinates,
        instructions: leg.instructions || undefined,
      };
    });

    // Calculate total distance and duration
    const totalDistance = steps.reduce((sum, step) => sum + step.distance, 0);
    const estimatedDuration = steps.reduce((sum, step) => sum + step.duration, 0);

    // Create the trip object
    const tripData: Omit<Trip, 'id'> = {
      status: 'active',
      startTime: Date.now(),
      endTime: null,
      startLocation,
      endLocation,
      selectedRouteIndex,
      totalDistance,
      estimatedDuration,
      steps,
    };

    // Save to Firebase
    const tripRef = push(ref(db, `users/${user.uid}/trips`));
    await set(tripRef, tripData);
    
    return tripRef.key;
  } catch (error) {
    console.error('Error creating trip:', error);
    return null;
  }
}

// Get active trip
export async function getActiveTrip(userId: string): Promise<Trip | null> {
  try {
    const tripsRef = ref(db, `users/${userId}/trips`);
    const tripsSnapshot = await get(query(tripsRef, orderByChild('status'), equalTo('active')));

    if (tripsSnapshot.exists()) {
      const trips = tripsSnapshot.val();
      const tripId = Object.keys(trips)[0]; // Get the first active trip
      return { id: tripId, ...trips[tripId] };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting active trip:', error);
    return null;
  }
}

// Mark a step as completed
export async function completeStep(tripId: string, stepId: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    // Get the trip to find the next step
    const tripRef = ref(db, `users/${user.uid}/trips/${tripId}`);
    const tripSnapshot = await get(tripRef);
    
    if (!tripSnapshot.exists()) return false;
    
    const trip = tripSnapshot.val();
    const stepIndex = trip.steps.findIndex((step: TripStep) => step.id === stepId);
    
    if (stepIndex === -1) return false;
    
    // Mark current step as completed
    const updates: any = {};
    updates[`steps/${stepIndex}/status`] = 'completed';
    updates[`steps/${stepIndex}/endTime`] = Date.now();
    
    // If there's a next step, mark it as active
    if (stepIndex < trip.steps.length - 1) {
      updates[`steps/${stepIndex + 1}/status`] = 'active';
      updates[`steps/${stepIndex + 1}/startTime`] = Date.now();
    } else {
      // This was the last step, mark the trip as completed
      updates['status'] = 'completed';
      updates['endTime'] = Date.now();
    }
    
    await update(tripRef, updates);
    return true;
  } catch (error) {
    console.error('Error completing step:', error);
    return false;
  }
}

// Cancel a trip
export async function cancelTrip(tripId: string): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    const tripRef = ref(db, `users/${user.uid}/trips/${tripId}`);
    await update(tripRef, {
      status: 'cancelled',
      endTime: Date.now()
    });
    
    return true;
  } catch (error) {
    console.error('Error cancelling trip:', error);
    return false;
  }
}

// Get user trips
export async function getUserTrips(): Promise<Trip[]> {
  try {
    const user = auth.currentUser;
    if (!user) return [];
    
    const tripsRef = ref(db, `users/${user.uid}/trips`);
    const snapshot = await get(tripsRef);
    
    if (!snapshot.exists()) return [];
    
    const tripsData = snapshot.val();
    return Object.keys(tripsData).map(id => ({
      id,
      ...tripsData[id]
    }));
  } catch (error) {
    console.error('Error fetching user trips:', error);
    return [];
  }
}

// Listen to active trip updates
export function subscribeToTrip(
  tripId: string, 
  callback: (trip: Trip | null) => void
): () => void {
  const user = auth.currentUser;
  if (!user) {
    callback(null);
    return () => {};
  }
  
  const tripRef = ref(db, `users/${user.uid}/trips/${tripId}`);
  
  onValue(tripRef, (snapshot) => {
    if (snapshot.exists()) {
      const tripData = snapshot.val();
      callback({
        id: tripId,
        ...tripData
      });
    } else {
      callback(null);
    }
  });
  
  // Return unsubscribe function
  return () => off(tripRef);
}