// components/RouteCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RouteCardProps {
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

const RouteCard: React.FC<RouteCardProps> = ({
  startTime,
  endTime,
  startLocation,
  endLocation,
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity style={[styles.routeCard, style]} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.routeTime}>{startTime} - {endTime}</Text>
      <View style={styles.routeDetails}>
        <View style={styles.locations}>
          <Text style={styles.routeLocation} numberOfLines={1}>{startLocation}</Text>
          <Text style={styles.routeLocation} numberOfLines={1}>{endLocation}</Text>
        </View>
        <View style={styles.routeArrow}>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  routeCard: {
    backgroundColor: '#2C2C2E', // Dark card
    padding: 15,
    borderRadius: 15,
    width: 250,
    marginRight: 15, // Default margin, can be overridden by style
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  routeTime: {
    color: '#AAA',
    fontSize: 14,
    marginBottom: 10,
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locations: {
      flex: 1, // Allow text to take space but be limited by container
      marginRight: 10,
  },
  routeLocation: {
    color: '#FFF',
    fontSize: 15,
    marginBottom: 3,
  },
  routeArrow: {
    backgroundColor: '#FF8C00',
    padding: 8,
    borderRadius: 15,
  },
});

export default RouteCard;