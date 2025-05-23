// app/(tabs)/settings.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, SafeAreaView } from 'react-native';

// --- IMPORT YOUR COMPONENTS ---
import Modal from '../../components/Modal';
import Button from '../../components/Button';
// ------------------------------


const SettingsScreen = () => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isModalVisible, setIsModalVisible] = useState(false); // State for modal

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.header}>App Settings</Text>

                <View style={styles.settingRow}>
                    <Text style={styles.settingText}>Dark Mode</Text>
                    <Switch value={isDarkMode} onValueChange={() => setIsDarkMode(prev => !prev)} />
                </View>

                {/* --- USE YOUR BUTTON & MODAL --- */}
                <Button
                    title="Show Info Modal"
                    onPress={() => setIsModalVisible(true)}
                    variant="secondary"
                    style={{ marginTop: 30 }}
                />

                <Modal
                    visible={isModalVisible}
                    onClose={() => setIsModalVisible(false)}
                    title="About This App"
                >
                    <Text style={styles.modalText}>
                        This is the Awesome Car Tracking App, built with React Native and Expo.
                    </Text>
                    <Button
                        title="Got it!"
                        onPress={() => setIsModalVisible(false)}
                        style={{ marginTop: 20 }}
                     />
                </Modal>
                {/* --------------------------- */}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    settingText: { fontSize: 16 },
    modalText: { fontSize: 16, lineHeight: 24, textAlign: 'center' } // Style for text inside modal
});

export default SettingsScreen;