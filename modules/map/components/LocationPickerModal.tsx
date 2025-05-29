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
  initialAddress?: string;
  title: string;
  showCurrentLocationButton?: boolean;
}

export default function LocationPickerModal({
  visible,
  onClose,
  onLocationConfirm,
  initialLocation,
  initialAddress,
  title,
  showCurrentLocationButton = false,
}: LocationPickerModalProps) {
  const { colors, isDarkMode } = useTheme();
  const { currentLocation, getSingleLocation, locationPermissionStatus } = useLocationTracking();
  
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(null);
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

  // Initialize with saved values when modal opens
  useEffect(() => {
    if (visible) {
      if (initialLocation) {
        setSelectedLocation(initialLocation);
        setSelectedAddress(initialAddress || '');
        
        const newRegion = {
          ...initialLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.01,
        };
        setMapRegion(newRegion);
        
        // Animate to the saved location
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
          }
        }, 500);
      } else {
        // Reset state if no initial location
        setSelectedLocation(null);
        setSelectedAddress('');
      }
      
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
  }, [visible, initialLocation, initialAddress]);

  // Function to check if location is within Angeles City proper
  const isWithinAngelesCityProper = useCallback((coordinate: Coordinate, address: string): boolean => {
    // Angeles City approximate boundaries
    const ANGELES_CITY_BOUNDS = {
      north: 15.1750,  // Northern boundary
      south: 15.1000,  // Southern boundary
      east: 120.6500,  // Eastern boundary
      west: 120.5700,  // Western boundary
    };

    const { latitude, longitude } = coordinate;
    
    // Check coordinate bounds
    const isWithinBounds = 
      latitude >= ANGELES_CITY_BOUNDS.south && 
      latitude <= ANGELES_CITY_BOUNDS.north &&
      longitude >= ANGELES_CITY_BOUNDS.west && 
      longitude <= ANGELES_CITY_BOUNDS.east;

    // Check if address contains "Angeles" or "Angeles City"
    const addressContainsAngeles = address.toLowerCase().includes('angeles');

    return isWithinBounds && addressContainsAngeles;
  }, []);

  const reverseGeocode = useCallback(async (coordinate: Coordinate, forceUpdate = false) => {
    // Don't reverse geocode if we already have a specific address unless forced
    // Also check if the address is not just coordinates
    const isCoordinateAddress = selectedAddress && 
      selectedAddress.includes(coordinate.latitude.toFixed(6)) && 
      selectedAddress.includes(coordinate.longitude.toFixed(6));
    
    if (!forceUpdate && selectedAddress && selectedAddress !== '' && !isCoordinateAddress) {
      return;
    }

    setIsLoadingAddress(true);
    try {
      const result = await mapApiService.reverseGeocode(coordinate);
      if (result) {
        // Check if location is within Angeles City proper
        if (!isWithinAngelesCityProper(coordinate, result.formattedAddress)) {
          Alert.alert(
            'Location Not Allowed',
            'Please select a location within Angeles City proper only.',
            [{ text: 'OK' }]
          );
          setSelectedLocation(null);
          setSelectedAddress('');
          setIsLoadingAddress(false);
          return;
        }
        // Only update address if we don't have a proper address or if forced update
        if (!selectedAddress || isCoordinateAddress || forceUpdate) {
          setSelectedAddress(result.formattedAddress);
        }
      } else {
        // If no address found, still check coordinates
        if (!isWithinAngelesCityProper(coordinate, '')) {
          Alert.alert(
            'Location Not Allowed',
            'Please select a location within Angeles City proper only.',
            [{ text: 'OK' }]
          );
          setSelectedLocation(null);
          setSelectedAddress('');
          setIsLoadingAddress(false);
          return;
        }
        if (!selectedAddress || forceUpdate) {
          setSelectedAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
        }
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
      // Still check bounds even if geocoding fails
      if (!isWithinAngelesCityProper(coordinate, '')) {
        Alert.alert(
          'Location Not Allowed',
          'Please select a location within Angeles City proper only.',
          [{ text: 'OK' }]
        );
        setSelectedLocation(null);
        setSelectedAddress('');
        setIsLoadingAddress(false);
        return;
      }
      if (!selectedAddress || forceUpdate) {
        setSelectedAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
      }
    } finally {
      setIsLoadingAddress(false);
    }
  }, [isWithinAngelesCityProper, selectedAddress]);

  const handleMapPress = useCallback((event: any) => {
    const coordinate = event.nativeEvent.coordinate;
    setSelectedLocation(coordinate);
    
    // Only reverse geocode if this is a new location (significant coordinate change)
    // or if we don't have any address yet
    const hasSignificantLocationChange = !selectedLocation || 
      Math.abs(selectedLocation.latitude - coordinate.latitude) > 0.0001 ||
      Math.abs(selectedLocation.longitude - coordinate.longitude) > 0.0001;
    
    const hasNoAddress = !selectedAddress || selectedAddress === '';
    
    if (hasSignificantLocationChange || hasNoAddress) {
      reverseGeocode(coordinate, hasSignificantLocationChange);
    }
  }, [reverseGeocode, selectedLocation, selectedAddress]);

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
        
        // Check if current location is within Angeles City proper
        setIsLoadingAddress(true);
        try {
          const result = await mapApiService.reverseGeocode(coordinate);
          const address = result?.formattedAddress || '';
          
          if (!isWithinAngelesCityProper(coordinate, address)) {
            Alert.alert(
              'Location Not Allowed',
              'Your current location is outside Angeles City proper. Please select a location within the city limits.',
              [{ text: 'OK' }]
            );
            setIsLoadingAddress(false);
            return;
          }
          
          setSelectedLocation(coordinate);
          setSelectedAddress(address || `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
        } catch (error) {
          console.warn('Reverse geocoding failed:', error);
          if (!isWithinAngelesCityProper(coordinate, '')) {
            Alert.alert(
              'Location Not Allowed',
              'Your current location is outside Angeles City proper. Please select a location within the city limits.',
              [{ text: 'OK' }]
            );
            setIsLoadingAddress(false);
            return;
          }
          setSelectedLocation(coordinate);
          setSelectedAddress(`${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`);
        } finally {
          setIsLoadingAddress(false);
        }
        
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
  }, [locationPermissionStatus, getSingleLocation, isWithinAngelesCityProper]);

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