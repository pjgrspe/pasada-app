import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Alert,
  SafeAreaView,
  Animated,
} from 'react-native';
import { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import MapViewComponent from './MapViewComponent';
import MapPin from './MapPin';
import { useTheme } from '@/hooks/useTheme';
import { useLocationTracking } from '../hooks/useLocationTracking';
import { Coordinate } from '../utils/routeTypes';
import mapApiService from '../services/mapApiServices';

interface LocationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationConfirm: (coordinate: Coordinate, address: string) => void;
  initialLocation?: Coordinate;
  title: string;
  showCurrentLocationButton?: boolean;
}

export default function LocationPickerModal({
  visible,
  onClose,
  onLocationConfirm,
  initialLocation,
  title,
  showCurrentLocationButton = false,
}: LocationPickerModalProps) {
  const { colors, isDarkMode } = useTheme();
  const { currentLocation, getSingleLocation, locationPermissionStatus } = useLocationTracking();
  
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(initialLocation || null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: initialLocation?.latitude || 15.1446,
    longitude: initialLocation?.longitude || 120.5948,
    latitudeDelta: 0.02,
    longitudeDelta: 0.01,
  });
  
  const mapRef = useRef<any>(null);
  const slideAnim = useRef(new Animated.Value(visible ? 0 : 1000)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      Animated.spring(slideAnim, {
        toValue: 1000,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
  }, [visible]);

  const reverseGeocode = useCallback(async (coordinate: Coordinate) => {
    setIsLoadingAddress(true);
    try {
      const result = await mapApiService.reverseGeocode(coordinate);
      if (result) {
        setSelectedAddress(result.formattedAddress);
      } else {
        setSelectedAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      setSelectedAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
    } finally {
      setIsLoadingAddress(false);
    }
  }, []);

  const handleMapPress = useCallback((event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedLocation(coordinate);
    reverseGeocode(coordinate);
  }, [reverseGeocode]);

  const handleCurrentLocation = useCallback(async () => {
    if (locationPermissionStatus !== 'granted') {
      Alert.alert(
        'Location Permission Required',
        'Please grant location permission to use this feature.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const location = await getSingleLocation();
      if (location) {
        const coordinate = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        setSelectedLocation(coordinate);
        setSelectedAddress('My Current Location');
        
        const newRegion = {
          ...coordinate,
          latitudeDelta: 0.01,
          longitudeDelta: 0.005,
        };
        
        setMapRegion(newRegion);
        if (mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    }
  }, [locationPermissionStatus, getSingleLocation]);

  const handleConfirm = useCallback(() => {
    if (selectedLocation && selectedAddress) {
      onLocationConfirm(selectedLocation, selectedAddress);
      onClose();
    } else {
      Alert.alert('No Location Selected', 'Please select a location on the map first.');
    }
  }, [selectedLocation, selectedAddress, onLocationConfirm, onClose]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Animated.View 
        style={[
          styles.container,
          { backgroundColor: colors.background, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            <MapViewComponent
              ref={mapRef}
              initialRegion={mapRegion}
              onPress={handleMapPress}
              showsUserLocation={locationPermissionStatus === 'granted'}
              showsMyLocationButton={false}
              style={styles.map}
            >
              {selectedLocation && (
                <Marker coordinate={selectedLocation}>
                  <MapPin 
                    type={showCurrentLocationButton && selectedAddress === 'My Current Location' ? 'start' : 'generic'} 
                    color={colors.primary} 
                    size={40} 
                  />
                </Marker>
              )}
            </MapViewComponent>

            {/* Current Location Button */}
            {showCurrentLocationButton && (
              <TouchableOpacity 
                style={[styles.currentLocationButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleCurrentLocation}
              >
                <Ionicons name="locate" size={24} color={colors.primary} />
              </TouchableOpacity>
            )}

            {/* Crosshair indicator */}
            {!selectedLocation && (
              <View style={styles.crosshairContainer}>
                <Ionicons name="add" size={30} color={colors.primary} />
              </View>
            )}
          </View>

          {/* Bottom Panel */}
          <View style={[styles.bottomPanel, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.addressContainer}>
              <Text style={[styles.addressLabel, { color: colors.text }]}>Selected Location:</Text>
              {isLoadingAddress ? (
                <Text style={[styles.addressText, { color: colors.text, opacity: 0.7 }]}>
                  Getting address...
                </Text>
              ) : (
                <Text style={[styles.addressText, { color: colors.text }]}>
                  {selectedAddress || 'Tap on the map to select a location'}
                </Text>
              )}
            </View>

            <TouchableOpacity 
              style={[
                styles.confirmButton, 
                { 
                  backgroundColor: selectedLocation ? colors.primary : colors.border,
                  opacity: selectedLocation ? 1 : 0.5 
                }
              ]}
              onPress={handleConfirm}
              disabled={!selectedLocation}
            >
              <Ionicons name="checkmark" size={20} color={colors.headerText} />
              <Text style={[styles.confirmButtonText, { color: colors.headerText }]}>
                Confirm Location
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32, // Same width as close button for centering
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  currentLocationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  crosshairContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -15,
    marginLeft: -15,
    pointerEvents: 'none',
  },
  bottomPanel: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addressContainer: {
    marginBottom: 16,
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 16,
    lineHeight: 20,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});