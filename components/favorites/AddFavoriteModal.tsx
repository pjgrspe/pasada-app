import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AddFavoriteModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, tags: string[]) => Promise<void>;
  startLocation?: { name: string; latitude: number; longitude: number; placeId?: string };
  endLocation?: { name: string; latitude: number; longitude: number; placeId?: string };
}

export const AddFavoriteModal: React.FC<AddFavoriteModalProps> = ({
  visible,
  onClose,
  onSave,
  startLocation,
  endLocation
}) => {
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for this favorite');
      return;
    }

    if (!startLocation || !endLocation) {
      Alert.alert('Error', 'Start and end locations are required');
      return;
    }

    setIsLoading(true);
    try {
      const tagArray = tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      await onSave(name, tagArray);
      
      // Reset form
      setName('');
      setTags('');
      onClose();
    } catch (error) {
      console.error('Error saving favorite:', error);
      Alert.alert('Error', 'Failed to save favorite. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setTags('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Add to Favorites</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Route Preview */}
            <View style={styles.routePreview}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color="#4CAF50" />
                <Text style={styles.locationText} numberOfLines={2}>
                  {startLocation?.name || 'Start location'}
                </Text>
              </View>
              <View style={styles.arrow}>
                <Ionicons name="arrow-down" size={16} color="#666" />
              </View>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color="#F44336" />
                <Text style={styles.locationText} numberOfLines={2}>
                  {endLocation?.name || 'End location'}
                </Text>
              </View>
            </View>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Favorite Name</Text>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Home to Work"
                placeholderTextColor="#999"
                maxLength={50}
              />
            </View>

            {/* Tags Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tags (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={tags}
                onChangeText={setTags}
                placeholder="e.g., work, commute, daily"
                placeholderTextColor="#999"
                multiline={false}
              />
              <Text style={styles.helpText}>Separate tags with commas</Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity 
                style={[styles.button, styles.cancelButton]} 
                onPress={handleClose}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.button, styles.saveButton, isLoading && styles.disabledButton]} 
                onPress={handleSave}
                disabled={isLoading}
              >
                <Text style={styles.saveButtonText}>
                  {isLoading ? 'Saving...' : 'Save Favorite'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  routePreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  arrow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
