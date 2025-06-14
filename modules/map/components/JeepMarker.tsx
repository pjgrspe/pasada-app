import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { JeepLocation } from '../services/jeepTrackingService';

interface JeepMarkerProps {
  jeep: JeepLocation;
  routeColor?: string;
  onPress?: (jeep: JeepLocation) => void;
}

export default function JeepMarker({ jeep, routeColor = '#FF6B35', onPress }: JeepMarkerProps) {
  const handlePress = () => {
    onPress?.(jeep);
  };

  return (
    <Marker
      coordinate={{
        latitude: jeep.latitude,
        longitude: jeep.longitude,
      }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.markerContainer, { borderColor: routeColor }]}>
        <View style={[styles.iconContainer, { backgroundColor: routeColor }]}>
          <Ionicons name="bus" size={16} color="white" />
        </View>
        <View style={styles.labelContainer}>
          <Text style={styles.jeepIdText} numberOfLines={1}>
            {jeep.jeepId}
          </Text>
        </View>
        {/* Pulse animation indicator */}
        {jeep.isOn && (
          <View style={[styles.pulseOuter, { borderColor: routeColor }]}>
            <View style={[styles.pulseInner, { backgroundColor: routeColor }]} />
          </View>
        )}
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  labelContainer: {
    marginTop: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  jeepIdText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  pulseOuter: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    opacity: 0.6,
    top: -8,
  },
  pulseInner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    opacity: 0.3,
    top: 3,
    left: 3,
  },
});
