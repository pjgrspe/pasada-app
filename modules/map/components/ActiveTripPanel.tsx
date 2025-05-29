import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useActiveTripStore } from '../store/useActiveTripStore';
import { useTheme } from '../../../hooks/useTheme';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { router } from 'expo-router';

export const ActiveTripPanel = () => {
  const { colors } = useTheme();
  const { activeTrip, completeCurrentStep, cancelActiveTrip, isLoading } = useActiveTripStore();
  
  if (!activeTrip) return null;
  
  const currentStep = activeTrip.steps.find(step => step.status === 'active');
  if (!currentStep) return null;
  
  const totalSteps = activeTrip.steps.length;
  const currentStepIndex = activeTrip.steps.findIndex(step => step.id === currentStep.id);
  const progress = `Step ${currentStepIndex + 1} of ${totalSteps}`;
  
  const handleCompleteStep = async () => {
    const isLastStep = currentStepIndex === totalSteps - 1;
    const message = isLastStep 
      ? 'This is your final step. Mark as complete to finish the trip?'
      : 'Mark this step as complete and proceed to the next?';
      
    Alert.alert(
      isLastStep ? 'Complete Trip?' : 'Complete Step?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Yes, Complete', 
          onPress: async () => {
            const success = await completeCurrentStep();
            if (success && isLastStep) {
              Alert.alert('Trip Completed', 'Your trip has been completed successfully!');
              router.push('/(tabs)/trips');
            }
          }
        }
      ]
    );
  };
  
  const handleCancelTrip = () => {
    Alert.alert(
      'Cancel Trip?',
      'Are you sure you want to cancel this trip? This action cannot be undone.',
      [
        { text: 'No, Keep Trip', style: 'cancel' },
        { 
          text: 'Yes, Cancel Trip', 
          style: 'destructive',
          onPress: async () => {
            const success = await cancelActiveTrip();
            if (success) {
              Alert.alert('Trip Cancelled', 'Your trip has been cancelled.');
              router.push('/(tabs)/trips');
            }
          }
        }
      ]
    );
  };
  
  const getStepIcon = () => {
    return currentStep.type === 'walk' 
      ? 'walk-outline'
      : 'bus-outline';
  };
  
  const getStepInstructions = () => {
    if (currentStep.type === 'walk') {
      return 'Walk to destination';
    }
    
    return `Take ${currentStep.routeName || 'jeepney'}`;
  };
  
  const getStepDetail = () => {
    if (currentStep.type === 'walk') {
      return `${(currentStep.distance / 1000).toFixed(1)} km • ~${Math.round(currentStep.duration / 60)} min`;
    }
    
    return `${currentStep.startLocation.name || 'Start'} → ${currentStep.endLocation.name || 'End'}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Active Trip</Text>
        <Text style={[styles.progress, { color: colors.primary }]}>{progress}</Text>
      </View>
      
      <View style={styles.stepContainer}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name={getStepIcon()} size={24} color={colors.primary} />
        </View>
        
        <View style={styles.stepInfo}>
          <Text style={[styles.stepType, { color: colors.text }]}>
            {currentStep.type === 'walk' ? 'Walking' : 'Jeepney'}
          </Text>
          
          <Text style={[styles.instructions, { color: colors.text }]}>
            {getStepInstructions()}
          </Text>
          
          <Text style={[styles.detail, { color: colors.text + 'AA' }]}>
            {getStepDetail()}
          </Text>
        </View>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton, { backgroundColor: colors.error + '20', borderColor: colors.error }]}
          onPress={handleCancelTrip}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: colors.error }]}>Cancel Trip</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, styles.completeButton, { backgroundColor: colors.success + '20', borderColor: colors.success }]}
          onPress={handleCompleteStep}
          disabled={isLoading}
        >
          <Text style={[styles.buttonText, { color: colors.success }]}>Complete Step</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginTop: 'auto', // Push to bottom
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  progress: {
    fontSize: 14,
    fontWeight: '600',
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepInfo: {
    flex: 1,
  },
  stepType: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  instructions: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelButton: {
    marginRight: 8,
  },
  completeButton: {
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});