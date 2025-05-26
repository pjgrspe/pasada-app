// pasada-gemini/modules/map/components/InstructionLegItem.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PlannedTripLeg } from '../utils/routeTypes';
import { useTheme } from '@/hooks/useTheme';

interface InstructionLegItemProps {
  leg: PlannedTripLeg;
  legIndex: number;
}

const InstructionLegItem: React.FC<InstructionLegItemProps> = ({ leg, legIndex }) => {
  const { colors } = useTheme();

  const renderLegIcon = (legType: 'walk' | 'jeepney') => {
    if (legType === 'walk') {
      return <Ionicons name="walk" size={22} color={colors.secondary} style={styles.legIcon} />;
    }
    return <Ionicons name="bus" size={22} color={colors.primary} style={styles.legIcon} />;
  };

  return (
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
  );
};

const styles = StyleSheet.create({
  legInstruction: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    paddingHorizontal: 15, // Added padding to match old instructionsList
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

export default InstructionLegItem;
