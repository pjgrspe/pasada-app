// utils/mapStyles.ts
import { darkThemeColors } from '../hooks/useTheme'; // Import your colors for reference

/**
 * Dark Map Style for react-native-maps (Google Maps Provider).
 * Tailored to the "Deep Archipelago Night" theme.
 * It uses deep navy for water, slate blues/greys for land,
 * and incorporates the theme's primary and accent colors for key features.
 */
export const darkMapStyle = [
  // --- Base ---
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": darkThemeColors.card // #1C2541 - Dark Slate Blue for land
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": darkThemeColors.card // #1C2541 - Match land for clean text edges
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#A0AEC0" // Muted Grey - Readable but not overpowering
      }
    ]
  },
  // --- Water ---
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": darkThemeColors.background // #0B132B - Deepest Navy for water
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#718096" // Darker Muted Grey for water labels
      }
    ]
  },
    {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": darkThemeColors.background // #0B132B - Match water
      }
    ]
  },
  // --- Roads ---
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": darkThemeColors.routeCard // #3A506B - Muted Teal/Blue-Grey
      }
    ]
  },
    {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": darkThemeColors.border // #2D3748 - Subtle stroke
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": darkThemeColors.text // #E2E8F0 - Bright text for roads
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": darkThemeColors.primary // #3B82F6 - Primary Blue for highways
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [
      {
        "color": darkThemeColors.card // #1C2541 - Contrast against blue
      }
    ]
  },
    {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#FFFFFF" // Pure white for max visibility on highways
      }
    ]
  },
  // --- Points of Interest (POI) & Features ---
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": darkThemeColors.accent, // #FCD116 - Yellow accent for towns
        "weight": 1.5 // Make them slightly more prominent
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#A0AEC0" // Muted Grey - Keep POIs subtle unless needed
      }
    ]
  },
    {
    "featureType": "poi",
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off" // Often cleans up dark maps to hide icons
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#1E4620" // Deep, dark green for parks
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#68D391" // Lighter green for park names
      }
    ]
  },
  // --- Transit ---
  {
    "featureType": "transit",
    "elementType": "geometry",
    "stylers": [
      {
        "color": darkThemeColors.border // #2D3748 - Use border color for transit lines
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": darkThemeColors.accent // #FCD116 - Yellow accent for stations
      }
    ]
  },
  // --- Hide Features (Optional, cleans up the look) ---
  {
      "featureType": "landscape.man_made",
      "elementType": "geometry.stroke",
      "stylers": [
          {
              "visibility": "off"
          }
      ]
  },
    {
      "featureType": "landscape.natural",
      "elementType": "labels",
      "stylers": [
          {
              "visibility": "off"
          }
      ]
  },
];