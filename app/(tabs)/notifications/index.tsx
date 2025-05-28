<<<<<<< HEAD
// app/(tabs)/notifications/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, Alert, RefreshControl } from 'react-native';
=======
// Modify: pasada-app/app/(tabs)/notifications/index.tsx
// The title "All Notifications" is now handled by the ScreenHeader in app/(tabs)/notifications/_layout.tsx
// The SafeAreaView and header <Text> are removed.

import React, { useState } from 'react'; // Removed useState as it's not used
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native'; // SafeAreaView removed
>>>>>>> adddc197c0c6c90c14cdc20ae6ce99991417c07e
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../hooks/useTheme';
import { useRouter } from 'expo-router';

const initialNotifications = [
  { id: '1', title: 'Route Update', message: 'Heavy traffic expected on EDSA.', time: '10m ago', read: false, icon: 'alert', details: 'Details...' },
  { id: '2', title: 'Trip Completed', message: 'Your trip to SM North EDSA is complete.', time: '1h ago', read: true, icon: 'checkmark-circle-outline', details: 'Details...' },
  { id: '3', title: 'Maintenance Alert', message: 'Your CAR-001 is due for oil change next week.', time: 'Yesterday', read: false, icon: 'build-outline', details: 'Details...' },
  { id: '4', title: 'Low Fuel', message: 'CAR-007 has low fuel.', time: 'Yesterday', read: true, icon: 'speedometer-outline', details: 'Details...' },
  { id: '5', title: 'New Feature!', message: 'Explore the new eco-friendly routing option.', time: '2 days ago', read: true, icon: 'leaf-outline', details: 'Details...' },
];

type NotificationItemProps = {
  item: typeof initialNotifications[0];
  colors: any;
  isDarkMode: boolean;
  onPress: () => void;
  onToggleRead: () => void;
  onDelete: () => void;
};

const NotificationItem = ({ item, colors, isDarkMode, onPress, onToggleRead, onDelete }: NotificationItemProps) => (
  <TouchableOpacity
    style={[
      styles.cardContainer,
      {
        backgroundColor: colors.card,
        borderColor: colors.border,
        shadowColor: '#000',
        borderLeftWidth: 5,
        borderLeftColor: item.read ? (isDarkMode ? '#444' : '#bbb') : colors.primary,
      },
    ]}
    activeOpacity={0.8}
    onPress={onPress}
  >
    <View style={styles.notificationContent}>
      <View
        style={[
          styles.iconContainer,
          {
            backgroundColor: item.read ? (isDarkMode ? '#444' : '#bbb') : colors.primary,
          },
        ]}
      >
        <Ionicons name={item.icon as any} size={24} color="#FFF" />
      </View>

      <View style={styles.textContainer}>
        <Text
          style={[
            styles.itemTitle,
            {
              color: item.read
                ? (isDarkMode ? '#bbb' : '#444')
                : colors.primary,
              fontWeight: item.read ? '400' : '700',
            },
          ]}
        >
          {item.title}
        </Text>
        <Text
          style={[
            styles.itemMessage,
            {
              color: item.read
                ? (isDarkMode ? '#bbb' : '#444')
                : colors.text,
              opacity: item.read ? 0.8 : 1,
              fontWeight: item.read ? '400' : '600',
            },
          ]}
          numberOfLines={1}
        >
          {item.message}
        </Text>
      </View>

      <TouchableOpacity onPress={onToggleRead} style={styles.actionButton}>
        <Ionicons
          name={item.read ? 'mail-open-outline' : 'mail-unread-outline'}
          size={20}
          color={item.read ? (isDarkMode ? '#bbb' : '#444') : colors.primary}
        />
      </TouchableOpacity>
      {/* Add delete button */}
      <TouchableOpacity onPress={onDelete} style={styles.actionButton}>
        <Ionicons name="trash-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
);

export default function NotificationsListScreen() {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [refreshing, setRefreshing] = useState(false);

  const handleNotificationPress = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id && !n.read ? { ...n, read: true } : n))
    );
    setTimeout(() => {
      router.push(`/(tabs)/notifications/${id}`);
    }, 0);
  };

  const handleToggleRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: !n.read } : n))
    );
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Notification',
      'Are you sure you want to delete this notification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setNotifications(prev => prev.filter(n => n.id !== id));
          },
        },
      ]
    );
  };

  // New: Mark all as read
  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // New: Clear all notifications
  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => setNotifications([]),
        },
      ]
    );
  };

  // New: Pull-to-refresh simulation
  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setNotifications(initialNotifications);
      setRefreshing(false);
    }, 1000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerButton}>
            <Ionicons name="checkmark-done-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={styles.headerButton}>
            <Ionicons name="trash-bin-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NotificationItem
            item={item}
            colors={colors}
            isDarkMode={isDarkMode}
            onPress={() => handleNotificationPress(item.id)}
            onToggleRead={() => handleToggleRead(item.id)}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={60} color={colors.text} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyText, { color: colors.text, opacity: 0.7 }]}>No notifications yet.</Text>
          </View>
        }
        contentContainerStyle={notifications.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? 24 : 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerButton: {
    marginLeft: 12,
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  list: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 5,
  },
  notificationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    padding: 10,
    borderRadius: 25,
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 16,
    marginBottom: 3,
  },
  itemMessage: {
    fontSize: 14,
  },
  actionButton: {
    paddingHorizontal: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 150,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});