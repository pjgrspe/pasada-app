// components/MapPin.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MapPinProps {
  type?: 'car' | 'start' | 'end' | 'generic';
  color?: string;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
}

const MapPin: React.FC<MapPinProps> = ({
  type = 'generic',
  color,
  iconName,
  size = 36,
}) => {
  const getDefaultIcon = () => {
    switch (type) {
      case 'car':
        return 'car-sport';
      case 'start':
        return 'flag';
      case 'end':
        return 'location';
      case 'generic':
      default:
        return 'pin';
    }
  };

  const getPinColor = () => {
     if (color) return color;
     switch (type) {
        case 'car':
            return '#FF8C00'; // Orange
        case 'start':
            return '#28A745'; // Green
        case 'end':
            return '#DC3545'; // Red
        case 'generic':
        default:
            return '#007BFF'; // Blue
     }
  };

  const finalIconName = iconName || getDefaultIcon();
  const pinColor = getPinColor();
  const iconSize = size * 0.5;

  return (
    <View style={[styles.pinContainer, { width: size, height: size * 1.2 }]}>
        <View style={[styles.pinHead, { backgroundColor: pinColor, width: size, height: size, borderRadius: size / 2 }]}>
             <Ionicons name={finalIconName} size={iconSize} color="#FFFFFF" />
        </View>
         <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  pinContainer: {
    alignItems: 'center',
  },
  pinHead: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 4,
  },
  pinTail: {
     width: 0,
     height: 0,
     borderLeftWidth: 6,
     borderRightWidth: 6,
     borderTopWidth: 10,
     borderLeftColor: 'transparent',
     borderRightColor: 'transparent',
     marginTop: -2, // Overlap slightly
  },
});

export default MapPin;