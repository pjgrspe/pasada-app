// components/Loader.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, ViewStyle } from 'react-native';

interface LoaderProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  style?: ViewStyle;
  fullscreen?: boolean;
}

const Loader: React.FC<LoaderProps> = ({
  size = 'large',
  color = '#FF8C00', // Orange
  text,
  style,
  fullscreen = false,
}) => {
  return (
    <View style={[fullscreen ? styles.fullscreenContainer : styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.8)' // Optional semi-transparent bg
  },
  text: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
});

export default Loader;