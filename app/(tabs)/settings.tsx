// app/(tabs)/settings.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../hooks/useTheme'; // Import useTheme
import { ThemeMode } from '../../store/useThemeStore';
import Button from '../../components/Button'; // Import Button
import Modal from '../../components/Modal'; // Import Modal
import { usePermissions } from '../../hooks/usePermissions'; // Import usePermissions
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen = () => {
    // --- Theme ---
    const { colors, themeMode, setThemeMode, isDarkMode } = useTheme();
    // --- Modal ---
    const [isModalVisible, setIsModalVisible] = useState(false);
    // --- Permissions ---
    const { status: locStatus, requestPermission: requestLocPerm } = usePermissions('location');
    const { status: bgLocStatus, requestPermission: requestBgLocPerm } = usePermissions('backgroundLocation');
    // --- Notifications (Example State) ---
    const [pushEnabled, setPushEnabled] = useState(true);

    // --- Dynamic Styles ---
    const dynamicStyles = StyleSheet.create({
        safeArea: { backgroundColor: colors.background },
        container: { backgroundColor: colors.background },
        header: { color: colors.text },
        sectionHeader: { color: colors.text, opacity: 0.9 },
        settingRow: { borderBottomColor: colors.border },
        settingText: { color: colors.text },
        settingValue: { color: colors.text, opacity: 0.6 },
        modalText: { color: colors.text }, // Use theme color for modal text
        arrow: { color: colors.text, opacity: 0.6 },
    });
    // ----------------------

    // --- Handlers ---
    const handleRequestLocation = async () => {
        const newStatus = await requestLocPerm();
        Alert.alert("Location Permission", `Status: ${newStatus}`);
    };

    const handleRequestBgLocation = async () => {
        const newStatus = await requestBgLocPerm();
        Alert.alert("Background Location", `Status: ${newStatus}`);
    };

    // --- Render Helper ---
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

    const renderPermissionRow = (
        label: string,
        currentStatus: string | null,
        onRequest: () => void
    ) => (
        <TouchableOpacity
            style={[styles.settingRow, dynamicStyles.settingRow]}
            onPress={onRequest}
        >
            <Text style={[styles.settingText, dynamicStyles.settingText]}>{label}</Text>
            <View style={styles.valueContainer}>
                <Text style={[styles.settingValue, dynamicStyles.settingValue]}>
                    {currentStatus || 'Check...'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={dynamicStyles.arrow.color} />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]}>
            <View style={[styles.container, dynamicStyles.container]}>
                <Text style={[styles.header, dynamicStyles.header]}>App Settings</Text>

                {/* --- Theme Section --- */}
                <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Appearance</Text>
                <View style={styles.optionsContainer}>
                    {renderOption('light', 'Light')}
                    {renderOption('dark', 'Dark')}
                    {renderOption('system', 'System')}
                </View>

                {/* --- Permissions Section --- */}
                <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Permissions</Text>
                {renderPermissionRow('Location Access', locStatus, handleRequestLocation)}
                {renderPermissionRow('Background Location', bgLocStatus, handleRequestBgLocation)}

                {/* --- Notifications Section --- */}
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

                {/* --- About Section --- */}
                <Button
                    title="About This App"
                    onPress={() => setIsModalVisible(true)}
                    variant="primary"
                    style={{ marginTop: 40 }}
                />

                <Modal
                    visible={isModalVisible}
                    onClose={() => setIsModalVisible(false)}
                    title="About CarTrack Pro"
                >
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>
                        Version 1.0.0
                    </Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>
                        Built with React Native & Expo.
                    </Text>
                    <Button
                        title="Close"
                        onPress={() => setIsModalVisible(false)}
                        style={{ marginTop: 20 }}
                     />
                </Modal>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1, padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    sectionHeader: { fontSize: 18, fontWeight: '600', marginBottom: 15, marginTop: 25 },
    optionsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 },
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
});

export default SettingsScreen;