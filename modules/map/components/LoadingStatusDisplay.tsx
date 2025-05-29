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
      styles.container, 
      { backgroundColor: colors.card, opacity: fadeAnim }
    ]}>
      <View style={[styles.statusContainer, { borderLeftColor: colors.primary }]}>
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
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 15,
    padding: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
  },
  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  emoji: {
    fontSize: 18,
    marginRight: 8,
  },
  indicator: {
    // Small spinner next to emoji
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});