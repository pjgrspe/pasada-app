import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import JeepMarker from './JeepMarker';
import { useJeepTracking } from '../hooks/useJeepTracking';
import { useMapStore } from '../store/useMapStore';
import { useActiveTripStore } from '../store/useActiveTripStore';

interface JeepTrackingLayerProps {
  visibleRouteIds?: string[];
}

export default function JeepTrackingLayer({ visibleRouteIds = [] }: JeepTrackingLayerProps) {
  console.log(`[JeepTrackingLayer] Component rendering with visibleRouteIds:`, visibleRouteIds);
  
  const { 
    jeepLocations, 
    isTracking, 
    startTracking, 
    stopTracking, 
    getAllActiveJeeps 
  } = useJeepTracking();
  
  const { 
    showJeeps, 
    jeepTrackingEnabled, 
    updateJeepLocation, 
    clearJeepLocations,
    setJeepTrackingEnabled 
  } = useMapStore();
  
  console.log(`[JeepTrackingLayer] Store state - showJeeps: ${showJeeps}, jeepTrackingEnabled: ${jeepTrackingEnabled}, isTracking: ${isTracking}`);
  
  const { activeTrip } = useActiveTripStore();

  // Get route colors for jeep markers
  const routeColors = useMemo(() => {
    const colors: Record<string, string> = {
      'checkpoint-silver': '#C0C0C0',
      'checkpoint-violet': '#8A2BE2',
      'marisol': '#FF6347'
    };
    return colors;
  }, []);

  // Determine which routes should be tracked
  const routesToTrack = useMemo(() => {
    const trackingRoutes: string[] = [];
    
    // Add routes that are currently visible on map
    trackingRoutes.push(...visibleRouteIds);
    
    // Add routes from active trip if user is on a jeep leg
    if (activeTrip?.steps) {
      activeTrip.steps.forEach(step => {
        if (step.type === 'jeepney' && step.routeId && ('completed' in step ? !step.completed : true)) {
          trackingRoutes.push(step.routeId);
        }
      });
    }
    
    // Remove duplicates
    return [...new Set(trackingRoutes)];
  }, [visibleRouteIds, activeTrip]);

  // Start/stop tracking based on routes and settings
  useEffect(() => {
    if (jeepTrackingEnabled && routesToTrack.length > 0) {
      if (!isTracking) {
        console.log('[JeepTrackingLayer] Starting tracking for routes:', routesToTrack);
        startTracking(routesToTrack);
      }
    } else if (isTracking) {
      console.log('[JeepTrackingLayer] Stopping tracking');
      stopTracking();
      clearJeepLocations();
    }
  }, [jeepTrackingEnabled, routesToTrack, isTracking, startTracking, stopTracking, clearJeepLocations]);

  // Enable tracking automatically when there are routes to track
  useEffect(() => {
    if (routesToTrack.length > 0 && !jeepTrackingEnabled) {
      setJeepTrackingEnabled(true);
    }
  }, [routesToTrack, jeepTrackingEnabled, setJeepTrackingEnabled]);

  // Sync jeep locations with map store
  useEffect(() => {
    jeepLocations.forEach((jeep) => {
      updateJeepLocation(jeep);
    });
  }, [jeepLocations, updateJeepLocation]);

  // Get active jeeps to display
  const activeJeeps = useMemo(() => {
    console.log(`[JeepTrackingLayer] Checking activeJeeps - showJeeps: ${showJeeps}, isTracking: ${isTracking}, routesToTrack: ${JSON.stringify(routesToTrack)}`);
    
    if (!showJeeps || !isTracking) {
      console.log(`[JeepTrackingLayer] Not showing jeeps - showJeeps: ${showJeeps}, isTracking: ${isTracking}`);
      return [];
    }
    
    const allJeeps = getAllActiveJeeps();
    console.log(`[JeepTrackingLayer] All active jeeps:`, allJeeps);
    
    const filteredJeeps = allJeeps.filter(jeep => 
      routesToTrack.includes(jeep.routeId)
    );
    console.log(`[JeepTrackingLayer] Filtered jeeps for display:`, filteredJeeps);
    
    return filteredJeeps;
  }, [showJeeps, isTracking, getAllActiveJeeps, routesToTrack]);

  const handleJeepPress = (jeep: any) => {
    console.log(`[JeepTrackingLayer] Jeep ${jeep.jeepId} pressed on route ${jeep.routeId}`);
    // You could show a modal with jeep details here
  };

  if (!showJeeps || !isTracking || activeJeeps.length === 0) {
    console.log(`[JeepTrackingLayer] Not rendering markers - showJeeps: ${showJeeps}, isTracking: ${isTracking}, activeJeeps.length: ${activeJeeps.length}`);
    return null;
  }

  console.log(`[JeepTrackingLayer] Rendering ${activeJeeps.length} jeep markers`);

  return (
    <View>
      {activeJeeps.map((jeep) => {
        console.log(`[JeepTrackingLayer] Rendering jeep marker:`, jeep);
        return (
          <JeepMarker
            key={`${jeep.routeId}-${jeep.jeepId}`}
            jeep={jeep}
            routeColor={routeColors[jeep.routeId] || '#FF6B35'}
            onPress={handleJeepPress}
          />
        );
      })}
    </View>
  );
}
