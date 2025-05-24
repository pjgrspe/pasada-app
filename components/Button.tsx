// components/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme'; // Added

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
  const { colors } = useTheme(); // Added

  const getButtonStyles = () => {
    switch (variant) {
      case 'secondary':
        return { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 };
      case 'dark':
        return { backgroundColor: colors.secondary }; // Example: using theme's secondary for "dark" variant
      case 'danger':
        return { backgroundColor: colors.error };
      case 'primary':
      default:
        return { backgroundColor: colors.primary };
    }
  };

  const getTextStyles = () => {
    switch (variant) {
      case 'secondary':
        return { color: colors.primary };
      case 'dark':
         return { color: colors.headerText }; // Text color suitable for secondary bg
       case 'danger':
         return { color: '#FFFFFF' }; // White text is common on danger color
      case 'primary':
      default:
        // Assuming primary button text color should contrast with colors.primary
        // This might be white or a very dark color depending on your primary color's brightness
        // For FF8C00 (Orange), white is good.
        return { color: '#FFFFFF' };
    }
  };

  const buttonVariantStyle = getButtonStyles();
  const textVariantStyle = getTextStyles();

  return (
    <TouchableOpacity
      style={[
        styles.baseButton,
        buttonVariantStyle,
        style,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={[styles.baseText, textVariantStyle, textStyle]}>{title}</Text>
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
  disabled: {
    opacity: 0.5,
  },
});

export default Button;