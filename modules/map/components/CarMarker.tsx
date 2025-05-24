// pasada-app/modules/map/components/CarMarker.tsx
import React from 'react';
import { Marker, MapMarkerProps } from 'react-native-maps';
import MapPin from './MapPin'; // Assuming MapPin is moved here

interface CarMarkerProps extends Omit<MapMarkerProps, 'children'> {
  carName?: string;
  pinSize?: number;
}

const CarMarker: React.FC<CarMarkerProps> = ({ coordinate, carName, pinSize = 30, ...rest }) => {
  return (
    <Marker coordinate={coordinate} title={carName} {...rest}>
      <MapPin type="car" size={pinSize} />
    </Marker>
  );
};

export default CarMarker;