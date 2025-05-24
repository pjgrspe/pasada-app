// components/RouteCard.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme'; // Import useTheme

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
  const { colors } = useTheme(); // Get themed colors

  return (
    <TouchableOpacity
      style={[
        styles.routeCardBase,
        { backgroundColor: colors.routeCard }, // Themed background
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.routeTime, { color: colors.text, opacity: 0.7 }]}>{startTime} - {endTime}</Text>
      <View style={styles.routeDetails}>
        <View style={styles.locations}>
          <Text style={[styles.routeLocation, { color: colors.text }]} numberOfLines={1}>{startLocation}</Text>
          <Text style={[styles.routeLocation, { color: colors.text }]} numberOfLines={1}>{endLocation}</Text>
        </View>
        <View style={[styles.routeArrow, { backgroundColor: colors.primary }]}>
          {/* Assuming white icon contrasts well with primary color */}
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  routeCardBase: { // Renamed to indicate it's a base style
    padding: 15,
    borderRadius: 15,
    width: 250,
    marginRight: 15,
    shadowColor: '#000', // Shadow color can often remain black or be themed if desired
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, // Adjusted for potentially lighter cards in light mode
    shadowRadius: 3,
    elevation: 2, // Adjusted elevation
  },
  routeTime: {
    fontSize: 14,
    marginBottom: 10,
  },
  routeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locations: {
    flex: 1,
    marginRight: 10,
  },
  routeLocation: {
    fontSize: 15,
    marginBottom: 3,
    fontWeight: '500', // Slightly bolder for better readability
  },
  routeArrow: {
    padding: 8,
    borderRadius: 15,
  },
});

export default RouteCard;