// pasada-gemini/modules/map/components/TripOptionsDisplay.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Standard import
import { PlannedTripLeg } from '../utils/routeTypes';
import { useTheme } from '@/hooks/useTheme';

interface TripOptionsDisplayProps {
  tripOptions: PlannedTripLeg[][] | null;
  selectedTripIndex: number;
  currentDisplayedTrip: PlannedTripLeg[] | null;
  onSelectTripOption: (index: number) => void;
}

const getTripSummary = (tripLegs: PlannedTripLeg[]): string => {
  if (!tripLegs || tripLegs.length === 0) return "No details";
  const jeepLegs = tripLegs.filter(leg => leg.type === 'jeepney');
  const walkLegs = tripLegs.filter(leg => leg.type === 'walk');
  const totalWalkDuration = walkLegs.reduce((sum, leg) => sum + (typeof leg.duration === 'number' ? leg.duration : 0), 0);
  const totalWalkMinutes = Math.round(totalWalkDuration / 60);
  const numJeeps = jeepLegs.length;
  let summary = "";
  if (numJeeps > 0) summary += `${numJeeps} Jeep${numJeeps > 1 ? 's' : ''}`;
  if (totalWalkMinutes > 0) summary += `${numJeeps > 0 ? ', ' : ''}${totalWalkMinutes} min walk`;
  if (summary === "") {
    if (walkLegs.length > 0 && totalWalkMinutes > 0) return `${totalWalkMinutes} min walk (Direct)`;
    return "Route details unavailable";
  }
  return summary;
};

const TripOptionsDisplayComponent: React.FC<TripOptionsDisplayProps> = ({ // Renamed to avoid conflict if any
  tripOptions,
  selectedTripIndex,
  currentDisplayedTrip,
  onSelectTripOption,
}) => {
  const { colors, isDarkMode } = useTheme();

  if (!tripOptions || tripOptions.length === 0) {
    return null;
  }

  const renderLegIcon = (legType: 'walk' | 'jeepney') => {
    if (legType === 'walk') {
      return <Ionicons name="walk" size={22} color={colors.secondary} style={styles.legIcon} />;
    }
    return <Ionicons name="bus" size={22} color={colors.primary} style={styles.legIcon} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {tripOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.tabButton,
              { borderColor: colors.border },
              selectedTripIndex === index
                ? { backgroundColor: colors.primary, borderBottomWidth: 0 }
                : { backgroundColor: colors.background },
            ]}
            onPress={() => onSelectTripOption(index)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTripIndex === index
                  ? { color: colors.headerText }
                  : { color: colors.text },
              ]}
            >
              Option {index + 1}
            </Text>
            <Text style={[
                styles.tabSummaryText,
                 selectedTripIndex === index
                  ? { color: colors.headerText, opacity: 0.8 }
                  : { color: colors.text, opacity: 0.7 },
            ]}>
                ({getTripSummary(option)})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {currentDisplayedTrip && currentDisplayedTrip.length > 0 && (
        <FlatList
          data={currentDisplayedTrip}
          keyExtractor={(item, index) => `leg-${index}-${item.routeId || item.mode}`}
          renderItem={({ item: leg, index: legIndex }) => (
            <View style={[styles.legInstruction, { borderBottomColor: colors.border }]}>
              <View style={styles.legHeader}>
                {renderLegIcon(leg.type)}
                <Text style={[styles.legType, { color: leg.type === 'walk' ? colors.secondary : colors.primary }]}>
                  {legIndex + 1}. {leg.type === 'walk' ? 'Walk' : `Jeepney: ${leg.routeName || leg.routeId || 'Unknown Route'}`}
                </Text>
              </View>
              
              {leg.instructions && (
                <Text style={[styles.legDetail, { color: colors.text, opacity: 0.9 }]}>
                  {leg.instructions.replace(/<[^>]*>/g, '')}
                </Text>
              )}
              {(typeof leg.distance === 'number' || typeof leg.distance === 'string' && leg.distance) && (
                <Text style={[styles.legMeta, { color: colors.text, opacity: 0.7 }]}>
                  Distance: {typeof leg.distance === 'number' ? `${(leg.distance / 1000).toFixed(1)} km` : leg.distance}
                </Text>
              )}
              {(typeof leg.duration === 'number' || typeof leg.duration === 'string' && leg.duration) && (
                <Text style={[styles.legMeta, { color: colors.text, opacity: 0.7 }]}>
                  Est. Time: {typeof leg.duration === 'number' ? `${Math.round(leg.duration / 60)} min` : leg.duration}
                </Text>
              )}
               {leg.jeepBoardingPointInfo && (
                <Text style={[styles.legDetailHighlight, { color: colors.success }]}>
                    Board: {leg.jeepBoardingPointInfo}
                </Text>
              )}
              {leg.jeepAlightingPointInfo && (
                <Text style={[styles.legDetailHighlight, { color: colors.error }]}>
                    Alight: {leg.jeepAlightingPointInfo}
                </Text>
              )}
            </View>
          )}
          style={styles.instructionsList}
          contentContainerStyle={{ paddingBottom: 10 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabSummaryText: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  instructionsList: {
    paddingHorizontal: 15,
    maxHeight: 250, 
  },
  legInstruction: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  legHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legIcon: {
    marginRight: 8,
  },
  legType: {
    fontWeight: 'bold',
    fontSize: 16,
    flexShrink: 1,
  },
  legDetail: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 30, 
    marginBottom: 4,
  },
  legDetailHighlight: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 30,
    fontWeight: '500',
    marginVertical: 2,
  },
  legMeta: {
    fontSize: 12,
    marginLeft: 30,
  },
});

export default TripOptionsDisplayComponent; // Ensure this is the default export
