// components/Modal.tsx
import React from 'react';
import { Modal as RNModal, View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

const Modal: React.FC<ModalProps> = ({ visible, onClose, children, title }) => {
  const { colors, isDarkMode } = useTheme();

  // Wrap string children in <Text>
  const renderChildren = () =>
    React.Children.map(children, child =>
      typeof child === 'string'
        ? <Text style={{ color: colors.text }}>{child}</Text>
        : child
    );

  return (
    <RNModal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)' }]}
        activeOpacity={1}
        onPressOut={onClose}
      >
        <TouchableOpacity
          style={[styles.modalContentBase, { backgroundColor: colors.card }]}
          activeOpacity={1}
          onPress={e => e.stopPropagation()}
        >
          <View style={[styles.headerBase, { borderBottomColor: colors.border }]}>
            <Text style={[styles.titleBase, { color: colors.text }]}>{title || 'Modal Title'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.text} style={{ opacity: 0.7 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            {renderChildren()}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentBase: {
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
  headerBase: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 15,
  },
  titleBase: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  body: {
    // Styles for the content area
  }
});

export default Modal;