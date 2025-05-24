// pasada-app/modules/map/components/MapViewComponent.tsx
import React, { forwardRef } from 'react';
import MapView, { MapViewProps as ReactNativeMapViewProps, PROVIDER_GOOGLE } from 'react-native-maps'; // Renamed to avoid conflict
import { StyleSheet } from 'react-native';
import { useTheme } from '../../../hooks/useTheme';
import { darkMapStyle } from '../../../utils/mapStyles';

// Define props for your custom component, extending the original MapViewProps
interface MapViewComponentProps extends ReactNativeMapViewProps {
  // You can add specific props later if needed
  // Example: customControls?: boolean;
}

const MapViewComponent = forwardRef<MapView, MapViewComponentProps>((props, ref) => {
  const { isDarkMode } = useTheme();

  return (
    <MapView
      ref={ref} // Apply the forwarded ref here
      style={styles.map}
      provider={PROVIDER_GOOGLE}
      customMapStyle={isDarkMode ? darkMapStyle : []}
      {...props}
    >
      {props.children}
    </MapView>
  );
});

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default MapViewComponent;