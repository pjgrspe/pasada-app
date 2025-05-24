// pasada-app/modules/map/components/NavigationControls.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Button from '../../../components/Button'; // Assuming global button

interface NavigationControlsProps {
  onStart?: () => void;
  onStop?: () => void;
  onCenter?: () => void;
}

const NavigationControls: React.FC<NavigationControlsProps> = ({ onStart, onStop, onCenter }) => {
  return (
    <View style={styles.container}>
      {onStart && <Button title="Start" onPress={onStart} style={styles.button} />}
      {onStop && <Button title="Stop" onPress={onStop} variant="danger" style={styles.button} />}
      {onCenter && <Button title="Center" onPress={onCenter} variant="secondary" style={styles.button} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  button: {
    marginHorizontal: 5,
  }
});

export default NavigationControls;