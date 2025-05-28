// components/Input.tsx
import React from 'react';
import { TextInput, StyleSheet, View, TextInputProps, ViewStyle, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme'; // Added

interface InputProps extends TextInputProps {
  containerStyle?: ViewStyle;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string; // Can be overridden by prop
}

const Input: React.FC<InputProps> = ({ containerStyle, iconName, iconColor, style, ...props }) => {
  const { colors } = useTheme(); // Added

  return (
    <View style={[
      styles.inputContainerBase,
      {
        backgroundColor: colors.inputBackground, // Themed
        borderColor: colors.border,             // Themed
      },
      containerStyle,
    ]}>
      {iconName && <Ionicons name={iconName} size={20} color={iconColor || colors.text} style={styles.icon} />}
      <TextInput
        style={[styles.inputFieldBase, { color: colors.inputText }, style]} // Themed
        placeholderTextColor={colors.text + '80'} // Themed placeholder (e.g., text color with some transparency)
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainerBase: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginVertical: 8,
    borderWidth: 1,
  },
  icon: {
    marginRight: 10,
  },
  inputFieldBase: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
});

export default Input;