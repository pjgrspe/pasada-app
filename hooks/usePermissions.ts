// hooks/usePermissions.ts
import { useState, useCallback } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import * as Location from 'expo-location';

type PermissionType = 'location' | 'backgroundLocation'; // | 'camera' | etc.
type PermissionStatus = Location.PermissionStatus | null;

/**
 * Hook to manage and request device permissions, with a focus on location.
 *
 * @param type The type of permission to manage ('location' or 'backgroundLocation').
 * @returns An object containing the current permission status,
 * and functions to check and request the permission.
 */
export const usePermissions = (type: PermissionType) => {
  const [status, setStatus] = useState<PermissionStatus>(null);

  /**
   * Checks the current status of the specified permission.
   */
  const checkPermission = useCallback(async () => {
    let currentStatus: Location.PermissionStatus;
    try {
        if (type === 'location') {
            currentStatus = (await Location.getForegroundPermissionsAsync()).status;
        } else if (type === 'backgroundLocation') {
            currentStatus = (await Location.getBackgroundPermissionsAsync()).status;
        } else {
             console.warn(`Permission type "${type}" not implemented yet.`);
             return null;
        }
        setStatus(currentStatus);
        return currentStatus;
    } catch (error) {
        console.error("Error checking permissions:", error);
        setStatus(Location.PermissionStatus.UNDETERMINED);
        return Location.PermissionStatus.UNDETERMINED;
    }

  }, [type]);

  /**
   * Shows an alert guiding the user to app settings if permission is denied.
   */
   const showSettingsAlert = () => {
       Alert.alert(
           'Permission Required',
           `To use this feature, please enable ${type.replace('Location', ' Location')} access in your device settings.`,
           [
               { text: 'Cancel', style: 'cancel' },
               { text: 'Open Settings', onPress: () => Linking.openSettings() },
           ]
       );
   };

  /**
   * Requests the specified permission from the user.
   * Handles cases where permission is denied or needs to be set in settings.
   */
  const requestPermission = useCallback(async () => {
    let currentStatus: Location.PermissionStatus;
    try {
        if (type === 'location') {
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            currentStatus = foregroundStatus;
        } else if (type === 'backgroundLocation') {
            // Must request foreground first!
            const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
            if (foregroundStatus !== 'granted') {
                 setStatus(foregroundStatus);
                 if (foregroundStatus === Location.PermissionStatus.DENIED) {
                     showSettingsAlert();
                 }
                 return foregroundStatus;
            }
            const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
            currentStatus = backgroundStatus;
        } else {
             console.warn(`Permission type "${type}" not implemented yet.`);
             return null;
        }

        setStatus(currentStatus);

        if (currentStatus === Location.PermissionStatus.DENIED) {
             // If denied multiple times, it might require settings change
             const { canAskAgain } = await (type === 'location'
                 ? Location.getForegroundPermissionsAsync()
                 : Location.getBackgroundPermissionsAsync());

             if (!canAskAgain) {
                 showSettingsAlert();
             }
        }
        return currentStatus;

    } catch (error) {
         console.error("Error requesting permissions:", error);
         setStatus(Location.PermissionStatus.UNDETERMINED);
         return Location.PermissionStatus.UNDETERMINED;
    }
  }, [type]);

  return {
    status,
    checkPermission,
    requestPermission,
  };
};