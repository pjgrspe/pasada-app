import { Stack } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export default function FavoritesLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.header,
        },
        headerTintColor: colors.headerText,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Favorites',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
