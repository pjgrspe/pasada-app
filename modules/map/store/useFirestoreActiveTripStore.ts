import { create } from 'zustand';
import { 
  firestoreTripService, 
  FirestoreTrip 
} from '@/services/firestoreTripService';
import { PlannedTripLeg } from '../utils/routeTypes';

interface ActiveTripState {
  activeTrip: FirestoreTrip | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  startTrip: (
    startLocation: { name: string; latitude: number; longitude: number; placeId?: string },
    endLocation: { name: string; latitude: number; longitude: number; placeId?: string },
    selectedRouteIndex: number,
    tripLegs: PlannedTripLeg[]
  ) => Promise<string | null>;
  
  completeCurrentStep: () => Promise<boolean>;
  cancelActiveTrip: () => Promise<boolean>;
  addTripRating: (rating: number, notes?: string) => Promise<boolean>;
  updateTripTags: (tags: string[]) => Promise<boolean>;
  setActiveTrip: (trip: FirestoreTrip | null) => void;
  clearActiveTrip: () => void;
  
  // Subscriptions
  subscribeToActiveTrip: (tripId: string) => void;
  unsubscribeFromActiveTrip: () => void;
  
  // Utilities
  isActiveTrip: () => boolean;
  getCurrentStep: () => any | null;
  getProgressPercentage: () => number;
}

export const useFirestoreActiveTripStore = create<ActiveTripState>((set, get) => {
  let unsubscribe: (() => void) | null = null;
  
  return {
    activeTrip: null,
    isLoading: false,
    error: null,
    
    startTrip: async (startLocation, endLocation, selectedRouteIndex, tripLegs) => {
      set({ isLoading: true, error: null });
      try {
        const tripId = await firestoreTripService.createTrip(
          startLocation, 
          endLocation, 
          selectedRouteIndex, 
          tripLegs
        );
        
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
      
      const success = await firestoreTripService.completeStep(activeTrip.id!, currentStep.id);
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
      const success = await firestoreTripService.cancelTrip(activeTrip.id!);
      
      if (success) {
        // The subscription will update the state automatically
      } else {
        set({ 
          error: 'Failed to cancel trip',
          isLoading: false 
        });
      }
      
      return success;
    },

    addTripRating: async (rating: number, notes?: string) => {
      const { activeTrip } = get();
      if (!activeTrip) {
        set({ error: 'No active trip found' });
        return false;
      }

      try {
        const success = await firestoreTripService.updateTripFeedback(activeTrip.id!, rating, notes);
        if (!success) {
          set({ error: 'Failed to add trip rating' });
        }
        return success;
      } catch (error: any) {
        set({ error: error.message || 'Failed to add trip rating' });
        return false;
      }
    },

    updateTripTags: async (tags: string[]) => {
      const { activeTrip } = get();
      if (!activeTrip) {
        set({ error: 'No active trip found' });
        return false;
      }

      try {
        const success = await firestoreTripService.updateTripTags(activeTrip.id!, tags);
        if (!success) {
          set({ error: 'Failed to update trip tags' });
        }
        return success;
      } catch (error: any) {
        set({ error: error.message || 'Failed to update trip tags' });
        return false;
      }
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
      unsubscribe = firestoreTripService.subscribeToTrip(tripId, (trip) => {
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
    },

    getCurrentStep: () => {
      const { activeTrip } = get();
      if (!activeTrip) return null;
      
      return activeTrip.steps.find(step => step.status === 'active') || null;
    },

    getProgressPercentage: () => {
      const { activeTrip } = get();
      if (!activeTrip) return 0;
      
      const completedSteps = activeTrip.steps.filter(step => step.status === 'completed').length;
      const totalSteps = activeTrip.steps.length;
      
      return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    }
  };
});
