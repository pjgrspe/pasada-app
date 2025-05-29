import { create } from 'zustand';
import { Trip, TripStep, createTrip, completeStep, cancelTrip, subscribeToTrip } from '../../../services/tripService';
import { PlannedTripLeg } from '../utils/routeTypes';

interface ActiveTripState {
  activeTrip: Trip | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startTrip: (
    startLocation: { name: string; latitude: number; longitude: number },
    endLocation: { name: string; latitude: number; longitude: number },
    selectedRouteIndex: number,
    tripLegs: PlannedTripLeg[]
  ) => Promise<string | null>;
  
  completeCurrentStep: () => Promise<boolean>;
  cancelActiveTrip: () => Promise<boolean>;
  setActiveTrip: (trip: Trip | null) => void;
  clearActiveTrip: () => void;
  
  // Subscriptions
  subscribeToActiveTrip: (tripId: string) => void;
  unsubscribeFromActiveTrip: () => void;
  
  // Check if trip is active
  isActiveTrip: () => boolean;
}

export const useActiveTripStore = create<ActiveTripState>((set, get) => {
  let unsubscribe: (() => void) | null = null;
  
  return {
    activeTrip: null,
    isLoading: false,
    error: null,
    
    startTrip: async (startLocation, endLocation, selectedRouteIndex, tripLegs) => {
      set({ isLoading: true, error: null });
      try {
        const tripId = await createTrip(startLocation, endLocation, selectedRouteIndex, tripLegs);
        
        if (tripId) {
          // Subscribe to updates for this trip
          get().subscribeToActiveTrip(tripId);
        } else {
          set({ error: 'Failed to create trip' });
        }
        
        set({ isLoading: false });
        return tripId;
      } catch (error: any) {
        set({ 
          error: error.message || 'Failed to start trip',
          isLoading: false 
        });
        return null;
      }
    },
    
    completeCurrentStep: async () => {
      const { activeTrip } = get();
      if (!activeTrip) {
        set({ error: 'No active trip found' });
        return false;
      }
      
      set({ isLoading: true, error: null });
      
      const currentStep = activeTrip.steps.find(step => step.status === 'active');
      if (!currentStep) {
        set({ 
          error: 'No active step found in this trip',
          isLoading: false
        });
        return false;
      }
      
      const success = await completeStep(activeTrip.id, currentStep.id);
      set({ isLoading: false });
      
      if (!success) {
        set({ error: 'Failed to complete step' });
      }
      
      return success;
    },
    
    cancelActiveTrip: async () => {
      const { activeTrip } = get();
      if (!activeTrip) {
        set({ error: 'No active trip found' });
        return false;
      }
      
      set({ isLoading: true, error: null });
      const success = await cancelTrip(activeTrip.id);
      
      if (success) {
        // The subscription will update the state
      } else {
        set({ 
          error: 'Failed to cancel trip',
          isLoading: false 
        });
      }
      
      return success;
    },
    
    setActiveTrip: (trip) => {
      set({ activeTrip: trip });
    },
    
    clearActiveTrip: () => {
      get().unsubscribeFromActiveTrip();
      set({ 
        activeTrip: null,
        isLoading: false,
        error: null
      });
    },
    
    subscribeToActiveTrip: (tripId) => {
      // Clean up any existing subscription
      get().unsubscribeFromActiveTrip();
      
      // Create new subscription
      unsubscribe = subscribeToTrip(tripId, (trip) => {
        set({ activeTrip: trip });
      });
    },
    
    unsubscribeFromActiveTrip: () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },
    
    isActiveTrip: () => {
      const { activeTrip } = get();
      return !!(activeTrip && activeTrip.status === 'active');
    }
  };
});