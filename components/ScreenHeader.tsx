// Create a new file: pasada-app/components/ScreenHeader.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, SafeAreaView, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';

interface ScreenHeaderProps {
  title: string;
  showBackButton?: boolean;
  showLogo?: boolean;
  logoSource?: ImageSourcePropType; // Allow passing the logo source
  rightIconName?: React.ComponentProps<typeof Ionicons>['name'];
  onRightIconPress?: () => void;
}

const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  showBackButton = false,
  showLogo = false,
  logoSource, // Default to null if not provided
  rightIconName,
  onRightIconPress,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const dynamicStyles = StyleSheet.create({
    safeArea: {
      backgroundColor: colors.header,
    },
    headerContainer: {
      backgroundColor: colors.header,
      paddingTop: Platform.OS === 'android' ? 15 : 0, // Status bar padding for Android
      borderBottomWidth: 1, // Optional: Add a bottom border
      borderBottomColor: colors.border, // Optional: Border color
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 15,
      paddingVertical: 12,
      minHeight: 50,
    },
    title: {
      color: colors.headerText,
      fontSize: 20,
      fontWeight: 'bold',
      textAlign: 'center', // Ensure text is centered within its space
      flex: 1, // Allow title to take up space and center itself
    },
    leftAction: {
      minWidth: 40, // Ensure space for alignment, even if empty
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    rightAction: {
      minWidth: 40, // Ensure space for alignment, even if empty
      alignItems: 'flex-end',
    },
    backButton: {
      padding: 5,
    },
    rightButton: {
      padding: 5,
    },
    logo: {
        width: 35, // Adjust logo size as needed
        height: 35,
        resizeMode: 'contain',
    }
  });

  return (
    <SafeAreaView style={dynamicStyles.safeArea}>
      <View style={dynamicStyles.headerContainer}>
        <View style={dynamicStyles.headerContent}>
          <View style={dynamicStyles.leftAction}>
            {showBackButton && (
              <TouchableOpacity onPress={() => router.back()} style={dynamicStyles.backButton}>
                <Ionicons name="arrow-back" size={26} color={colors.headerText} />
              </TouchableOpacity>
            )}
            {!showBackButton && showLogo && logoSource && (
                <Image source={logoSource} style={dynamicStyles.logo} />
            )}
          </View>

          <Text style={dynamicStyles.title} numberOfLines={1}>{title}</Text>

          <View style={dynamicStyles.rightAction}>
            {rightIconName && onRightIconPress && (
              <TouchableOpacity onPress={onRightIconPress} style={dynamicStyles.rightButton}>
                <Ionicons name={rightIconName} size={26} color={colors.headerText} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ScreenHeader;