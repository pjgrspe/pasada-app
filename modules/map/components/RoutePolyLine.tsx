// pasada-app/modules/map/components/RoutePolyline.tsx
import React from 'react';
import { Polyline, MapPolylineProps } from 'react-native-maps';
import { useTheme } from '../../../hooks/useTheme';

interface RoutePolylineProps extends Omit<MapPolylineProps, 'strokeColor' | 'strokeWidth'> {
  // Additional props if needed
}

const RoutePolyline: React.FC<RoutePolylineProps> = (props) => {
  const { colors } = useTheme();
  return (
    <Polyline
      strokeColor={colors.primary}
      strokeWidth={5}
      {...props}
    />
  );
};

export default RoutePolyline;