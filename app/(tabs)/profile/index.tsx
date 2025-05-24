// Modify: pasada-app/app/(tabs)/profile/index.tsx
// Remove the <Text style={[styles.header, dynamicStyles.header]}>App Settings</Text>
// The title "Profile & Settings" is now handled by the ScreenHeader in app/(tabs)/profile/_layout.tsx

import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity, Switch, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal';
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../modules/auth/hooks/useAuth';
import { ThemeMode } from '../../../store/useThemeStore';
import { usePermissions } from '../../../hooks/usePermissions';

const ProfileScreen = () => {
    const router = useRouter();
    const { colors, themeMode, setThemeMode, isDarkMode } = useTheme();
    const { user, logout, isLoading: authIsLoading } = useAuth();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const { status: locStatus, requestPermission: requestLocPerm } = usePermissions('location');
    const { status: bgLocStatus, requestPermission: requestBgLocPerm } = usePermissions('backgroundLocation');
    const [pushEnabled, setPushEnabled] = useState(true);

    const handleLogout = async () => {
        Alert.alert(
            "Confirm Logout",
            "Are you sure you want to log out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await logout();
                            // Navigation is handled by the root _layout.tsx based on auth state
                        } catch (error: any) {
                            Alert.alert("Logout Failed", error.message || "Could not log out at this time.");
                        }
                    }
                }
            ]
        );
    };

    const handleRequestLocation = async () => {
        const newStatus = await requestLocPerm();
        // Alert.alert("Location Permission", `Status: ${newStatus}`); // Optional: give feedback
    };
    const handleRequestBgLocation = async () => {
        const newStatus = await requestBgLocPerm();
        // Alert.alert("Background Location", `Status: ${newStatus}`); // Optional: give feedback
    };

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        name: { color: colors.text },
        email: { color: colors.text, opacity: 0.7 }, // Slightly more opacity
        sectionHeader: { color: colors.text, opacity: 0.9 },
        settingRow: { borderBottomColor: colors.border },
        settingText: { color: colors.text },
        settingValue: { color: colors.text, opacity: 0.7 },
        modalText: { color: colors.text },
        arrow: { color: colors.text, opacity: 0.7 },
        safeArea: { backgroundColor: colors.background }, // Ensures safe area matches screen bg
        profileHeader: { backgroundColor: colors.card, shadowColor: colors.text } // Card-like header
    });

    const renderOption = (mode: ThemeMode, label: string) => (
        <TouchableOpacity
            style={[
                styles.optionButton,
                {
                    backgroundColor: themeMode === mode ? colors.primary : colors.card,
                    borderColor: themeMode === mode ? colors.primary : colors.border, // More subtle border for inactive
                },
            ]}
            onPress={() => setThemeMode(mode)}
        >
            <Text
                style={[
                    styles.optionText,
                    { color: themeMode === mode ? (isDarkMode ? colors.card : '#FFFFFF') : colors.text },
                ]}
            >
                {label}
            </Text>
        </TouchableOpacity>
    );

    const renderPermissionRow = (label: string, currentStatus: string | null, onRequest: () => void) => (
        <TouchableOpacity style={[styles.settingRow, dynamicStyles.settingRow]} onPress={onRequest}>
            <Text style={[styles.settingText, dynamicStyles.settingText]}>{label}</Text>
            <View style={styles.valueContainer}>
                <Text style={[styles.settingValue, dynamicStyles.settingValue]}>
                    {currentStatus ? currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1) : 'Tap to check'}
                </Text>
                <Ionicons name="chevron-forward" size={22} color={dynamicStyles.arrow.color} />
            </View>
        </TouchableOpacity>
    );

    if (authIsLoading && !user) {
        return <View style={[styles.centered, dynamicStyles.container]}><Text style={dynamicStyles.name}>Loading profile...</Text></View>;
    }

    return (
        // SafeAreaView removed from here as ScreenHeader in _layout handles it.
        // If ScreenHeader is not used in _layout for this stack, then SafeAreaView might be needed here.
        <ScrollView style={[styles.scrollContainer, dynamicStyles.container]}>
            <View style={[styles.profileHeader, dynamicStyles.profileHeader]}>
                <Avatar
                    source={user?.photoURL ? { uri: user.photoURL } : undefined}
                    size={110} // Slightly larger
                    style={{ borderColor: colors.primary, borderWidth: 3 }}
                />
                <Text style={[styles.name, dynamicStyles.name]}>{user?.displayName || 'Pasada User'}</Text>
                <Text style={[styles.email, dynamicStyles.email]}>{user?.email || 'No email'}</Text>
                <Button
                    title="Edit Profile"
                    onPress={() => router.push('/(tabs)/profile/edit')}
                    variant="primary"
                    style={{ marginTop: 20, paddingHorizontal: 30, paddingVertical: 12 }}
                />
            </View>

            <View style={styles.settingsSection}>
                {/* Header text "App Settings" is removed, handled by ScreenHeader */}
                <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Appearance</Text>
                <View style={[styles.optionsContainer, {backgroundColor: colors.background, borderColor: colors.background}]}>
                    {renderOption('light', 'Light')}
                    {renderOption('dark', 'Dark')}
                    {renderOption('system', 'System')}
                </View>

                <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Permissions</Text>
                {renderPermissionRow('Location Access', locStatus, handleRequestLocation)}
                {renderPermissionRow('Background Location', bgLocStatus, handleRequestBgLocation)}

                <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Notifications</Text>
                <View style={[styles.settingRow, dynamicStyles.settingRow]}>
                    <Text style={[styles.settingText, dynamicStyles.settingText]}>
                        Push Notifications
                    </Text>
                    <Switch
                        value={pushEnabled}
                        onValueChange={() => setPushEnabled(p => !p)}
                        trackColor={{ false: "#767577", true: colors.primary }}
                        thumbColor={isDarkMode ? colors.card : "#f4f3f4"}
                        ios_backgroundColor="#3e3e3e"
                    />
                </View>
                </View>

            <View style={styles.actionsSection}>
                <Button
                    title="About This App"
                    onPress={() => setIsModalVisible(true)}
                    variant="secondary" // Changed for less emphasis
                    style={{marginBottom: 15}}
                />
                <Button
                    title={authIsLoading ? "Logging out..." : "Logout"}
                    onPress={handleLogout}
                    variant="danger"
                    disabled={authIsLoading}
                />
            </View>

            <Modal
                visible={isModalVisible}
                onClose={() => setIsModalVisible(false)}
                title="About Pasada App" // More specific title
            >
                <Text style={[styles.modalText, dynamicStyles.modalText]}>Version 1.0.0</Text>
                <Text style={[styles.modalText, dynamicStyles.modalText]}>Your reliable partner for tracking and navigation.</Text>
                <Text style={[styles.modalText, {fontSize: 12, marginTop: 15, opacity: 0.7}, dynamicStyles.modalText]}>© 2024 Pasada App</Text>
                <Button title="Close" onPress={() => setIsModalVisible(false)} style={{ marginTop: 25 }} variant="primary" />
            </Modal>
        </ScrollView>
    );
};


const styles = StyleSheet.create({
    // safeArea removed
    scrollContainer: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    profileHeader: {
        alignItems: 'center',
        paddingTop: 20, // Reduced top padding as header is separate
        paddingBottom: 25,
        paddingHorizontal: 20, // Added horizontal padding
        marginBottom: 20,
        borderRadius: 16, // Added border radius for card effect
        marginHorizontal: 10, // Added margin
        marginTop: 10, // Added margin
        elevation: 3,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    name: { fontSize: 24, fontWeight: 'bold', marginTop: 18, textAlign: 'center' },
    email: { fontSize: 16, marginBottom: 5, textAlign: 'center' },
    settingsSection: { paddingHorizontal: 20, marginBottom: 20, marginTop: 10 },
    sectionHeader: { fontSize: 19, fontWeight: '600', marginBottom: 10, marginTop: 20 },
    optionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 15,
        paddingVertical: 15, // Added padding
        borderRadius: 12, // Rounded corners
        borderWidth: 1, // Subtle border
    },
    optionButton: {
        paddingVertical: 12,
        paddingHorizontal: 20, // Adjusted padding
        borderRadius: 10, // Rounded buttons
        borderWidth: 1.5,
        alignItems: 'center',
        flex: 1, // Make buttons take equal space
        marginHorizontal: 5, // Add spacing between buttons
    },
    optionText: { fontSize: 15, fontWeight: '600' }, // Adjusted weight
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16, // Slightly more padding
        borderBottomWidth: 1,
    },
    settingText: { fontSize: 17 }, // Increased size
    valueContainer: { flexDirection: 'row', alignItems: 'center' },
    settingValue: { fontSize: 15, marginRight: 6 }, // Increased size
    modalText: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 8 },
    actionsSection: { paddingHorizontal: 20, paddingBottom: 40, marginTop: 10 }, // Reduced marginTop
});

export default ProfileScreen;