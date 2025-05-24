// components/Avatar.tsx
import React from 'react';
import { Image, StyleSheet, View, ImageSourcePropType, StyleProp, ImageStyle } from 'react-native';

interface AvatarProps {
  source?: ImageSourcePropType;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

const Avatar: React.FC<AvatarProps> = ({ source, size = 80, style }) => {
  const avatarStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  return (
    <View style={[styles.container, avatarStyle, style]}>
      <Image
        source={source || require('../assets/default-avatar.png')} // Provide a default image
        style={[styles.image, avatarStyle]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#E0E0E0', // Placeholder background
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FF8C00', // Orange border
  },
  image: {
    resizeMode: 'cover',
  },
});

export default Avatar;

// Note: You need to have a 'default-avatar.png' in your assets folder
// or remove the require() fallback.