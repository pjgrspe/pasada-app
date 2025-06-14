import { useState, useEffect, useCallback, useRef } from 'react';
import { jeepTrackingService, JeepLocation, JeepTrackingCallbacks } from '../services/jeepTrackingService';

interface UseJeepTrackingReturn {
  jeepLocations: Map<string, JeepLocation>;
  isTracking: boolean;
  error: string | null;
  startTracking: (routeIds: string[]) => void;
  stopTracking: () => void;
  getJeepsForRoute: (routeId: string) => JeepLocation[];
  getAllActiveJeeps: () => JeepLocation[];
  isJeepOnline: (jeepId: string, routeId: string) => boolean;
}

export function useJeepTracking(): UseJeepTrackingReturn {
  const [jeepLocations, setJeepLocations] = useState<Map<string, JeepLocation>>(new Map());
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callbacksRef = useRef<JeepTrackingCallbacks | undefined>(undefined);

  // Create callbacks for the tracking service
  const createCallbacks = useCallback((): JeepTrackingCallbacks => {
    return {
      onJeepUpdate: (jeep: JeepLocation) => {
        setJeepLocations(prev => {
          const newMap = new Map(prev);
          const jeepKey = `${jeep.routeId}-${jeep.jeepId}`;
          newMap.set(jeepKey, jeep);
          return newMap;
        });
        setError(null); // Clear any previous errors on successful update
      },
      
      onJeepOffline: (jeepId: string, routeId: string) => {
        setJeepLocations(prev => {
          const newMap = new Map(prev);
          const jeepKey = `${routeId}-${jeepId}`;
          const jeep = newMap.get(jeepKey);
          if (jeep) {
            newMap.set(jeepKey, { ...jeep, isOn: false });
          }
          return newMap;
        });
      },
      
      onError: (error: Error) => {
        console.error('[useJeepTracking] Error:', error);
        setError(error.message);
      }
    };
  }, []);

  // Initialize the service
  useEffect(() => {
    if (!callbacksRef.current) {
      callbacksRef.current = createCallbacks();
      jeepTrackingService.initialize(callbacksRef.current);
    }
  }, [createCallbacks]);

  const startTracking = useCallback((routeIds: string[]) => {
    console.log('[useJeepTracking] Starting tracking for routes:', routeIds);
    setIsTracking(true);
    setError(null);
    jeepTrackingService.startTracking(routeIds);
  }, []);

  const stopTracking = useCallback(() => {
    console.log('[useJeepTracking] Stopping tracking');
    setIsTracking(false);
    jeepTrackingService.stopTracking();
    setJeepLocations(new Map()); // Clear locations when stopping
  }, []);

  const getJeepsForRoute = useCallback((routeId: string): JeepLocation[] => {
    return jeepTrackingService.getJeepsForRoute(routeId);
  }, []);

  const getAllActiveJeeps = useCallback((): JeepLocation[] => {
    return jeepTrackingService.getAllActiveJeeps();
  }, []);

  const isJeepOnline = useCallback((jeepId: string, routeId: string): boolean => {
    return jeepTrackingService.isJeepOnline(jeepId, routeId);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    jeepLocations,
    isTracking,
    error,
    startTracking,
    stopTracking,
    getJeepsForRoute,
    getAllActiveJeeps,
    isJeepOnline
  };
}
