// pasada-app/modules/map/services/locationService.ts
import * as Location from 'expo-location';
import { usePermissions } from '../../../hooks/usePermissions'; // Corrected path

const locationService = {
    getCurrentLocation: async (accuracy: Location.Accuracy = Location.Accuracy.Balanced): Promise<Location.LocationObject | null> => {
        // Permissions are now primarily handled by useLocationTracking hook
        // but can be checked here for one-off calls if needed.
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
            // Optionally, you could try requesting here, but hooks are preferred for UI components
            console.warn("Location permission not granted. Consider requesting via useLocationTracking or usePermissions hook.");
            return null;
        }

        try {
            return await Location.getCurrentPositionAsync({ accuracy });
        } catch (error) {
            console.error("Error getting current location:", error);
            return null;
        }
    },

    // The useLocationTracking hook is now the primary way to track location.
    // Background location setup can also be initiated via a hook or a dedicated setup function.
};

export default locationService;