// components/Modal.tsx
import React from 'react';
import { Modal as RNModal, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

const Modal: React.FC<ModalProps> = ({ visible, onClose, children, title }) => {
  return (
    <RNModal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPressOut={onClose} // Close when clicking outside
      >
        <TouchableOpacity
          style={styles.modalContent}
          activeOpacity={1} // Prevent closing when clicking inside
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
              <Text style={styles.title}>{title || 'Modal Title'}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                 <Ionicons name="close" size={28} color="#555" />
              </TouchableOpacity>
          </View>
          <View style={styles.body}>
            {children}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      paddingBottom: 10,
      marginBottom: 15,
  },
  title: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#333',
  },
  closeButton: {
      padding: 5,
  },
  body: {
      // Styles for the content area
  }
});

export default Modal;