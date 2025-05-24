// components/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'danger';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  style,
  textStyle,
  disabled = false,
}) => {
  const getButtonStyles = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryButton;
      case 'dark':
        return styles.darkButton;
       case 'danger':
        return styles.dangerButton;
      case 'primary':
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyles = () => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'dark':
         return styles.darkText;
       case 'danger':
         return styles.dangerText;
      case 'primary':
      default:
        return styles.primaryText;
    }
  };

  const buttonStyle = getButtonStyles();
  const TxtStyle = getTextStyles();

  return (
    <TouchableOpacity
      style={[
        styles.baseButton,
        buttonStyle,
        style,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.baseText, TxtStyle, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
    minWidth: 120,
  },
  baseText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#FF8C00', // Orange
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF8C00',
  },
  secondaryText: {
    color: '#FF8C00',
  },
  darkButton: {
     backgroundColor: '#2C2C2E', // Dark Grey
  },
  darkText: {
      color: '#FFFFFF',
  },
   dangerButton: {
      backgroundColor: '#DC3545', // Red
   },
   dangerText: {
      color: '#FFFFFF',
   },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;