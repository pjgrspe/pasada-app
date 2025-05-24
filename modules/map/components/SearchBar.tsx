// pasada-app/modules/map/components/SearchBar.tsx
import React from 'react';
import Input from '../../../components/Input';
import { ViewStyle, NativeSyntheticEvent, TextInputSubmitEditingEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme'; // Keep the import

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSearchSubmit?: () => void;
  style?: ViewStyle;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string; // Keep this optional if you want to allow overriding
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder,
  value,
  onChangeText,
  onSearchSubmit,
  style,
  iconName = "search-outline",
  iconColor: propIconColor, // Rename prop to avoid conflict before getting theme
}) => {
  // --- Call useTheme() *inside* the functional component ---
  const { colors } = useTheme();

  // --- Use the prop's value or default to the theme's accent color ---
  const iconColor = propIconColor || colors.accent;

  const handleSubmit = (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => {
    if (onSearchSubmit) {
      onSearchSubmit();
    }
  };

  return (
    <Input
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={handleSubmit}
      iconName={iconName}
      iconColor={iconColor} // Use the determined icon color
      containerStyle={style}
      returnKeyType="search"
    />
  );
};

export default SearchBar;