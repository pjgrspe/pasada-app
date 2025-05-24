// app/(tabs)/profile/index.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, TouchableOpacity, Switch, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
import Modal from '../../../components/Modal'; // Import Modal
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../modules/auth/hooks/useAuth';
import { ThemeMode } from '../../../store/useThemeStore';
import { usePermissions } from '../../../hooks/usePermissions';

const ProfileScreen = () => {
    const router = useRouter();
    const { colors, themeMode, setThemeMode, isDarkMode } = useTheme();
    const { user, logout, isLoading: authIsLoading } = useAuth();

    // --- State from Settings ---
    const [isModalVisible, setIsModalVisible] = useState(false);
    const { status: locStatus, requestPermission: requestLocPerm } = usePermissions('location');
    const { status: bgLocStatus, requestPermission: requestBgLocPerm } = usePermissions('backgroundLocation');
    const [pushEnabled, setPushEnabled] = useState(true);
    // ---------------------------

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error: any) {
            Alert.alert("Logout Failed", error.message || "Could not log out.");
        }
    };

    // --- Handlers from Settings ---
    const handleRequestLocation = async () => {
        const newStatus = await requestLocPerm();
        Alert.alert("Location Permission", `Status: ${newStatus}`);
    };
    const handleRequestBgLocation = async () => {
        const newStatus = await requestBgLocPerm();
        Alert.alert("Background Location", `Status: ${newStatus}`);
    };
    // ----------------------------

    // --- Dynamic Styles ---
    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        name: { color: colors.text },
        email: { color: colors.text, opacity: 0.6 },
        sectionHeader: { color: colors.text, opacity: 0.9 },
        settingRow: { borderBottomColor: colors.border },
        settingText: { color: colors.text },
        settingValue: { color: colors.text, opacity: 0.6 },
        modalText: { color: colors.text },
        arrow: { color: colors.text, opacity: 0.6 },
        safeArea: { backgroundColor: colors.background },
    });
    // ----------------------

    // --- Render Helpers from Settings ---
    const renderOption = (mode: ThemeMode, label: string) => (
        <TouchableOpacity
            style={[
                styles.optionButton,
                {
                    backgroundColor: themeMode === mode ? colors.primary : colors.card,
                    borderColor: colors.primary,
                },
            ]}
            onPress={() => setThemeMode(mode)}
        >
            <Text
                style={[
                    styles.optionText,
                    { color: themeMode === mode ? (isDarkMode ? colors.text : '#FFFFFF') : colors.text },
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
                    {currentStatus || 'Check...'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={dynamicStyles.arrow.color} />
            </View>
        </TouchableOpacity>
    );
    // ------------------------------------

    if (authIsLoading && !user) {
        return <View style={[styles.centered, dynamicStyles.container]}><Text style={dynamicStyles.name}>Loading profile...</Text></View>;
    }

    return (
        <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]}>
            <ScrollView style={[styles.scrollContainer, dynamicStyles.container]}>
                <View style={styles.profileHeader}>
                    <Avatar
                        source={user?.photoURL ? { uri: user.photoURL } : undefined}
                        size={100}
                        style={{ borderColor: colors.primary }}
                    />
                    <Text style={[styles.name, dynamicStyles.name]}>{user?.displayName || 'Pasada User'}</Text>
                    <Text style={[styles.email, dynamicStyles.email]}>{user?.email || 'No email'}</Text>
                    <Button
                        title="Edit Profile"
                        onPress={() => router.push('/(tabs)/profile/edit')}
                        variant="primary"
                        style={{ marginTop: 15, width: '60%' }}
                    />
                </View>

                {/* --- Settings Sections --- */}
                <View style={styles.settingsSection}>
                    <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Appearance</Text>
                    <View style={styles.optionsContainer}>
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
                            Enable Push Notifications
                        </Text>
                        <Switch
                            value={pushEnabled}
                            onValueChange={() => setPushEnabled(p => !p)}
                            trackColor={{ false: "#767577", true: colors.primary }}
                            thumbColor={isDarkMode ? colors.card : "#f4f3f4"}
                        />
                    </View>
                 </View>

                {/* --- Other Actions --- */}
                <View style={styles.actionsSection}>
                    <Button
                        title="About This App"
                        onPress={() => setIsModalVisible(true)}
                        variant="dark"
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
                    title="About CarTrack Pro"
                >
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>Version 1.0.0</Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>Built with React Native & Expo.</Text>
                    <Button title="Close" onPress={() => setIsModalVisible(false)} style={{ marginTop: 20 }} />
                </Modal>

            </ScrollView>
        </SafeAreaView>
    );
};

// --- Combine and Refine Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scrollContainer: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    profileHeader: { alignItems: 'center', paddingTop: 30, paddingHorizontal: 30, marginBottom: 20 },
    name: { fontSize: 22, fontWeight: 'bold', marginTop: 15 },
    email: { fontSize: 16, marginBottom: 5 },
    settingsSection: { paddingHorizontal: 20, marginBottom: 20 },
    sectionHeader: { fontSize: 18, fontWeight: '600', marginBottom: 15, marginTop: 25 },
    optionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15, paddingVertical: 10, backgroundColor: 'transparent' },
    optionButton: { paddingVertical: 10, paddingHorizontal: 25, borderRadius: 20, borderWidth: 1.5, alignItems: 'center' },
    optionText: { fontSize: 16, fontWeight: '500' },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
    },
    settingText: { fontSize: 16 },
    valueContainer: { flexDirection: 'row', alignItems: 'center' },
    settingValue: { fontSize: 14, marginRight: 5 },
    modalText: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 5 },
    actionsSection: { paddingHorizontal: 20, paddingBottom: 40, marginTop: 20 },
});

export default ProfileScreen;