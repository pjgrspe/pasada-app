// components/Input.tsx
import React, { useState } from 'react';
import { TextInput, StyleSheet, View, TextInputProps, ViewStyle, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Optional: for icon support

interface InputProps extends TextInputProps {
  containerStyle?: ViewStyle;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
}

const Input: React.FC<InputProps> = ({ containerStyle, iconName, iconColor = '#888', style, ...props }) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[
      styles.inputContainer,
      containerStyle,
      isFocused && styles.inputContainerFocused // Apply focused style
    ]}>
      {iconName && <Ionicons name={iconName} size={20} color={iconColor} style={styles.icon} />}
      <TextInput
        style={[styles.inputField, style]}
        placeholderTextColor="#888"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3A3A3C', // Dark input background
    borderRadius: 10,
    paddingHorizontal: 15,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#4A4A4C', // Subtle border
  },
  inputContainerFocused: {
    borderColor: '#007AFF', // Example focus color (iOS blue)
    // You can add other focus styles like shadow for Android if needed
    ...Platform.select({
      ios: {
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
      },
      android: {
        elevation: 2, // Add a slight elevation for Android
      },
    }),
  },
  icon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 12,
  },
});

export default Input;