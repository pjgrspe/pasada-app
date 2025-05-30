import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ScrollView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useTripStore } from '@/modules/trips/store/useFirestoreTripStore';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import Button from '@/components/Button';

interface TripActionsModalProps {
  visible: boolean;
  onClose: () => void;
  trip: {
    id: string;
    startLocation: string;
    endLocation: string;
    status: string;
    rating?: number;
    notes?: string;
    tags?: string[];
  };
}

export const TripActionsModal: React.FC<TripActionsModalProps> = ({
  visible,
  onClose,
  trip
}) => {
  const { colors } = useTheme();
  const { addTripRating, updateTripTags, deleteTrip } = useTripStore();
  
  const [rating, setRating] = useState(trip.rating || 0);
  const [notes, setNotes] = useState(trip.notes || '');
  const [tags, setTags] = useState(trip.tags?.join(', ') || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveRating = async () => {
    if (rating < 1 || rating > 5) {
      Alert.alert('Invalid Rating', 'Please select a rating between 1 and 5 stars.');
      return;
    }

    setIsLoading(true);
    try {
      const success = await addTripRating(trip.id, rating, notes);
      if (success) {
        Alert.alert('Success', 'Trip rating saved successfully!');
        onClose();
      } else {
        Alert.alert('Error', 'Failed to save trip rating.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTags = async () => {
    setIsLoading(true);
    try {
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
      
      const success = await updateTripTags(trip.id, tagArray);
      if (success) {
        Alert.alert('Success', 'Trip tags updated successfully!');
        onClose();
      } else {
        Alert.alert('Error', 'Failed to update trip tags.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTrip = () => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const success = await deleteTrip(trip.id);
              if (success) {
                Alert.alert('Success', 'Trip deleted successfully!');
                onClose();
              } else {
                Alert.alert('Error', 'Failed to delete trip.');
              }
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={30}
              color={star <= rating ? '#FFD700' : colors.text}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} onClose={onClose} title="Trip Actions">
      <ScrollView style={styles.container}>
        <Text style={[styles.tripTitle, { color: colors.text }]}>
          {trip.startLocation} → {trip.endLocation}
        </Text>

        {/* Rating Section */}
        {trip.status === 'completed' && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Rate Your Trip
            </Text>
            {renderStars()}
            
            <Input
              placeholder="Add notes about your trip (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              style={styles.notesInput}
            />
            
            <Button
              title="Save Rating"
              onPress={handleSaveRating}
              disabled={isLoading || rating === 0}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Tags Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Trip Tags
          </Text>
          <Text style={[styles.sectionDescription, { color: colors.text, opacity: 0.7 }]}>
            Add tags to categorize your trips (e.g., work, leisure, shopping)
          </Text>
          
          <Input
            placeholder="Enter tags separated by commas"
            value={tags}
            onChangeText={setTags}
            style={styles.tagsInput}
          />
          
          <Button
            title="Save Tags"
            onPress={handleSaveTags}
            disabled={isLoading}
            style={styles.actionButton}
          />
        </View>

        {/* Delete Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.error }]}>
            Danger Zone
          </Text>
            <Button
            title="Delete Trip"
            onPress={handleDeleteTrip}
            disabled={isLoading}
            variant="danger"
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tripTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 15,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 15,
  },
  starButton: {
    padding: 5,
  },
  notesInput: {
    marginBottom: 15,
  },
  tagsInput: {
    marginBottom: 15,
  },
  actionButton: {
    marginBottom: 10,
  },
});
