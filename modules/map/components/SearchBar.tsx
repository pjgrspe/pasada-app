// pasada-app/modules/map/components/SearchBar.tsx
import React from 'react';
import Input from '../../../components/Input';
import { ViewStyle, NativeSyntheticEvent, TextInputSubmitEditingEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onSearchSubmit?: () => void; // Renamed for clarity
  style?: ViewStyle;
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  iconColor?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder,
  value,
  onChangeText,
  onSearchSubmit,
  style,
  iconName = "search-outline",
  iconColor = "#FF8C00"
}) => {
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
      iconColor={iconColor}
      containerStyle={style}
      returnKeyType="search" // Improves keyboard usability
    />
  );
};

export default SearchBar;