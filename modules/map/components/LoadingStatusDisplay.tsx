import React from 'react';
import { View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { Text } from '@/components/Themed';
import { useTheme } from '@/hooks/useTheme';

interface LoadingStatusDisplayProps {
  isLoading: boolean;
  status: string | null;
  defaultMessage?: string;
}

export default function LoadingStatusDisplay({
  isLoading,
  status,
  defaultMessage = 'Planning your route...'
}: LoadingStatusDisplayProps) {
  const { colors } = useTheme();
  const [fadeAnim] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    if (isLoading || status) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, status, fadeAnim]);

  if (!isLoading && !status) {
    return null;
  }

  // Extract emoji from status message for visual separation
  const statusText = status || defaultMessage;
  const emojiMatch = statusText.match(/^(\p{Emoji}+)\s*/u);
  const emoji = emojiMatch ? emojiMatch[1] : '⏳';
  const message = statusText.replace(/^(\p{Emoji}+)\s*/u, '');

  return (
    <Animated.View style={[
      styles.statusContainer, 
      { 
        backgroundColor: colors.card,
        borderLeftColor: colors.primary,
        opacity: fadeAnim 
      }
    ]}>
      <View style={styles.iconContainer}>
        <Text style={styles.emoji}>{emoji}</Text>
        <ActivityIndicator 
          size="small" 
          color={colors.primary} 
          style={styles.indicator} 
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.statusText, { color: colors.text }]}>
          {message || 'Processing...'}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    position: 'absolute', // Make it an overlay
    top: 15, // Position from top of map container
    left: 15, // Position from left of map container
    right: 15, // Position from right of map container
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    elevation: 15, // Very high elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 2000, // Highest z-index
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  emoji: {
    fontSize: 16,
    marginRight: 6,
  },
  indicator: {
    // Small spinner next to emoji
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});