// pasada-app/modules/map/hooks/useMap.ts
import { useState, useCallback, useRef } from 'react';
import { Region } from 'react-native-maps'; // Corrected: Removed the trailing underscore
import { useMapStore } from '../store/useMapStore';
import MapView from 'react-native-maps'; // Import MapView type for ref

export const useMap = () => {
  const { currentRegion: globalRegion, setCurrentRegion: setGlobalRegion } = useMapStore();
  const mapRef = useRef<MapView>(null); // Typed ref

  const onRegionChangeComplete = useCallback((region: Region) => {
    setGlobalRegion(region);
  }, [setGlobalRegion]);

  const animateToRegion = useCallback((region: Region, duration: number = 1000) => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(region, duration);
    } else {
      console.warn("Map ref not available for animateToRegion");
      setGlobalRegion(region);
    }
  }, [mapRef, setGlobalRegion]);

  const setMapRef = useCallback((ref: MapView | null) => {
    if (ref) {
      mapRef.current = ref; // No @ts-ignore needed if ref is correctly typed
    }
  }, []);


  return {
    mapRef,
    setMapRef,
    currentRegion: globalRegion,
    onRegionChangeComplete,
    animateToRegion,
  };
};