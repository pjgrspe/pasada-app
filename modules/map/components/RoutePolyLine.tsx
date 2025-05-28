// pasada-gemini/modules/map/components/RoutePolyLine.tsx
import React from 'react';
// Correctly import MapPolylineProps from react-native-maps
import { Polyline, MapPolylineProps } from 'react-native-maps';
import { useTheme } from '../../../hooks/useTheme';

// Define the props our custom RoutePolyline will accept.
// We extend all standard MapPolylineProps but make strokeColor and strokeWidth
// explicitly optional in our custom component to handle defaults.
interface RoutePolylineProps extends Omit<MapPolylineProps, 'strokeColor' | 'strokeWidth'> {
  strokeColor?: string;
  strokeWidth?: number;
  // coordinates is inherited from MapPolylineProps and is mandatory there.
}

const RoutePolyline: React.FC<RoutePolylineProps> = ({
  strokeColor: propStrokeColor,
  strokeWidth: propStrokeWidth,
  ...restOfProps // Captures all other valid MapPolylineProps like coordinates, zIndex, lineDashPattern etc.
}) => {
  const { colors } = useTheme();

  // Determine the final stroke color: use the passed prop or fallback to theme's primary.
  const finalStrokeColor = propStrokeColor !== undefined ? propStrokeColor : colors.primary;
  // Determine the final stroke width: use the passed prop or fallback to a default.
  const finalStrokeWidth = propStrokeWidth !== undefined ? propStrokeWidth : 5;

  return (
    <Polyline
      {...restOfProps} // Spread the rest of the MapPolylineProps (like coordinates, zIndex)
      strokeColor={finalStrokeColor}
      strokeWidth={finalStrokeWidth}
    />
  );
};

export default RoutePolyline;
