// pasada-app/modules/map/hooks/useLocationTracking.ts
import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { usePermissions } from '../../../hooks/usePermissions'; // Ensure this path is correct

export interface TrackedLocation extends Location.LocationObject {
  // Add any custom properties if needed
}

export const useLocationTracking = (options?: Location.LocationTaskOptions) => {
  const [currentLocation, setCurrentLocation] = useState<TrackedLocation | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const { status: locationPermissionStatus, requestPermission: requestLocationPermission } = usePermissions('location');

  const defaultOptions: Location.LocationTaskOptions = {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000, // 5 seconds
    distanceInterval: 10, // 10 meters
    ...options,
  };

  const startTracking = useCallback(async () => {
    if (locationPermissionStatus !== Location.PermissionStatus.GRANTED) {
      const status = await requestLocationPermission();
      if (status !== Location.PermissionStatus.GRANTED) {
        setErrorMsg('Location permission not granted.');
        setIsTracking(false);
        return;
      }
    }

    try {
      setErrorMsg(null);
      setIsTracking(true);
      // Watch position for continuous updates
      const subscription = await Location.watchPositionAsync(defaultOptions, (location) => {
        setCurrentLocation(location);
      });
      return () => subscription.remove(); // Cleanup function for useEffect
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to start location tracking.');
      setIsTracking(false);
    }
  }, [locationPermissionStatus, requestLocationPermission, defaultOptions]);

  const stopTracking = useCallback(async () => {
    // For watchPositionAsync, the cleanup in useEffect handles stopping.
    // If using background location tasks, you'd stop the task here.
    setIsTracking(false);
    // In this setup, the useEffect cleanup handles unsubscription.
  }, []);

  const getSingleLocation = useCallback(async () => {
    if (locationPermissionStatus !== Location.PermissionStatus.GRANTED) {
      const status = await requestLocationPermission();
      if (status !== Location.PermissionStatus.GRANTED) {
        setErrorMsg('Location permission not granted.');
        return null;
      }
    }
    try {
      setErrorMsg(null);
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation(location);
      return location;
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to get current location.');
      return null;
    }
  }, [locationPermissionStatus, requestLocationPermission]);


  // Initial permission check
  useEffect(() => {
    if (locationPermissionStatus === null) {
      requestLocationPermission();
    }
  }, [locationPermissionStatus, requestLocationPermission]);

  return {
    currentLocation,
    errorMsg,
    isTracking,
    startTracking,
    stopTracking,
    getSingleLocation,
    locationPermissionStatus,
  };
};