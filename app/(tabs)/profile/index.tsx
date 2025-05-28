import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Alert,
    ScrollView,
    TouchableOpacity,
    Switch,
    SafeAreaView,
    Animated,
    Dimensions,
    Share,
    Linking,
    ActionSheetIOS,
    Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button'; // CHECK THIS COMPONENT'S INTERNAL IMPLEMENTATION VERY CAREFULLY
import Modal from '../../../components/Modal';
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../modules/auth/hooks/useAuth';
import { ThemeMode } from '../../../store/useThemeStore';
import { usePermissions } from '../../../hooks/usePermissions';

const { width } = Dimensions.get('window');

const ProfileScreen = () => {
    const router = useRouter();
    const { colors, themeMode, setThemeMode, isDarkMode } = useTheme();
    const { user, logout, isLoading: authIsLoading } = useAuth();

    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isStatsModalVisible, setIsStatsModalVisible] = useState(false);
    const [isPrivacyModalVisible, setIsPrivacyModalVisible] = useState(false);
    const [animatedValue] = useState(new Animated.Value(0));
    const [profileImage, setProfileImage] = useState(user?.photoURL || null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    const { status: locStatus, requestPermission: requestLocPerm } = usePermissions('location');
    const { status: bgLocStatus, requestPermission: requestBgLocPerm } = usePermissions('backgroundLocation');
    const [pushEnabled, setPushEnabled] = useState(true);
    const [biometricEnabled, setBiometricEnabled] = useState(false);
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);

    const userStats = {
        totalTrips: 127,
        totalDistance: '2,458 km',
        avgSpeed: '48 km/h',
        fuelSaved: '₹3,240'
    };

    React.useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
        }).start();
    }, [animatedValue]);

    const handleLogout = async () => {
        Alert.alert(
            "Confirm Logout",
            "Are you sure you want to logout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await logout();
                        } catch (error: any) {
                            Alert.alert("Logout Failed", error.message || "Could not log out.");
                        }
                    }
                }
            ]
        );
    };

    const handleShareProfile = async () => {
        try {
            await Share.share({
                message: `Check out my Pasada stats! I've completed ${userStats.totalTrips} trips and traveled ${userStats.totalDistance}. Join me on Pasada!`,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleContactSupport = () => {
        Alert.alert(
            "Contact Support",
            "How would you like to contact us?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Email", onPress: () => Linking.openURL('mailto:support@pasada.com') },
                { text: "Phone", onPress: () => Linking.openURL('tel:+1234567890') }
            ]
        );
    };

    const handleDataExport = () => {
        Alert.alert(
            "Export Data",
            "Your trip data will be prepared and sent to your email within 24 hours.",
            [{ text: "OK" }]
        );
    };

    const handleImagePicker = () => {
        const options = [
            { text: 'Camera', onPress: () => pickImage('camera') },
            { text: 'Photo Library', onPress: () => pickImage('library') },
            { text: 'Remove Photo', onPress: () => removeProfileImage(), style: 'destructive' as const },
            { text: 'Cancel', style: 'cancel' as const }
        ];

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: options.map(opt => opt.text),
                    destructiveButtonIndex: 2,
                    cancelButtonIndex: 3,
                },
                (buttonIndex) => {
                    if (buttonIndex < 3 && options[buttonIndex]) { // Ensure buttonIndex is valid
                        options[buttonIndex].onPress?.();
                    }
                }
            );
        } else {
            Alert.alert(
                "Profile Picture",
                "Choose an option",
                options.map(opt => ({ text: opt.text, onPress: opt.onPress, style: opt.style })) // Pass full option objects
            );
        }
    };

    const pickImage = async (source: 'camera' | 'library') => {
        try {
            setIsUploadingImage(true);
            const permissionResult = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.status !== 'granted') {
                Alert.alert('Permission needed', `We need ${source} permissions to update your profile picture.`);
                setIsUploadingImage(false); // Reset loading state
                return;
            }

            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });

            if (!result.canceled && result.assets && result.assets[0]) {
                const imageUri = result.assets[0].uri;
                const manipulatedImage = await ImageManipulator.manipulateAsync(
                    imageUri,
                    [{ resize: { width: 400, height: 400 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                );
                setProfileImage(manipulatedImage.uri);
                Alert.alert('Success', 'Profile picture updated successfully!');
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to update profile picture. Please try again.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const removeProfileImage = () => {
        Alert.alert('Remove Profile Picture', 'Are you sure you want to remove your profile picture?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive', onPress: () => {
                        setProfileImage(null);
                        Alert.alert('Success', 'Profile picture removed successfully!');
                    }
                }
            ]
        );
    };

    const handleRequestLocation = async () => {
        const newStatus = await requestLocPerm(); Alert.alert("Location Permission", `Status: ${newStatus}`);
    };
    const handleRequestBgLocation = async () => {
        const newStatus = await requestBgLocPerm(); Alert.alert("Background Location", `Status: ${newStatus}`);
    };

    // Dynamic styles based on theme
    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        name: { color: colors.text },
        email: { color: isDarkMode ? colors.text + '90' : colors.text + '70' },
        sectionHeader: { color: colors.text, fontWeight: '600' },
        settingRow: {
            borderBottomColor: isDarkMode ? colors.border + '30' : colors.border + '20',
            backgroundColor: colors.card // Use theme's card color directly
        },
        settingText: { color: colors.text },
        settingValue: { color: isDarkMode ? colors.text + '80' : colors.text + '60' },
        modalText: { color: colors.text }, // Style for text content within modals
        arrow: { color: isDarkMode ? colors.text + '60' : colors.text + '50' },
        safeArea: { backgroundColor: colors.background },
        statCard: {
            backgroundColor: isDarkMode ? colors.card : '#FFFFFF', // Use theme's card color for dark mode
            borderColor: isDarkMode ? (colors.border || '#555555') + '70' : colors.primary + '15',
            shadowColor: '#000000' // Consistent shadow color
        },
        settingSubtitle: { color: isDarkMode ? colors.text + '60' : colors.text + '50' }
    });

    // Helper function to render theme selection options
    const renderThemeOption = (mode: ThemeMode, label: string, icon: string) => (
        <TouchableOpacity
            style={[
                styles.themeOptionButton,
                {
                    backgroundColor: themeMode === mode
                        ? colors.primary
                        : isDarkMode ? colors.card : '#FFFFFF', // Use theme's card color for unselected dark
                    borderColor: themeMode === mode
                        ? colors.primary
                        : isDarkMode ? colors.border + '30' : colors.border + '20',
                    shadowColor: themeMode === mode ? colors.primary : (isDarkMode ? colors.text : '#000000'),
                },
            ]}
            onPress={() => setThemeMode(mode)}
            activeOpacity={0.8}
        >
            <Ionicons name={icon as any} size={20} color={themeMode === mode ? '#FFFFFF' : isDarkMode ? colors.text : colors.text + 'CC'} />
            <Text style={[styles.themeOptionText, { color: themeMode === mode ? '#FFFFFF' : isDarkMode ? colors.text : colors.text + 'CC' }]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    // Helper function to render a setting row
    const renderSettingRow = (icon: string, label: string, value?: string, onPress?: () => void, rightElement?: React.ReactNode, subtitle?: string) => (
        <TouchableOpacity style={[styles.enhancedSettingRow, dynamicStyles.settingRow]} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.settingLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + (isDarkMode ? '25' : '15') }]}>
                    <Ionicons name={icon as any} size={20} color={colors.primary} />
                </View>
                <View style={styles.settingInfo}>
                    <Text style={[styles.settingText, dynamicStyles.settingText]}>{label}</Text>
                    {subtitle && (<Text style={[styles.settingSubtitle, dynamicStyles.settingSubtitle]}>{subtitle}</Text>)}
                </View>
            </View>
            <View style={styles.settingRight}>
                {rightElement || (
                    <>
                        {value && (<Text style={[styles.settingValue, dynamicStyles.settingValue]}>{value}</Text>)}
                        {onPress && (<Ionicons name="chevron-forward" size={18} color={dynamicStyles.arrow.color} />)}
                    </>
                )}
            </View>
        </TouchableOpacity>
    );

    // Helper function to render a statistics card
    const renderStatCard = (title: string, value: string, icon: string, color: string) => (
        <View style={[styles.statCard, dynamicStyles.statCard]}>
            <View style={[
                styles.statIcon, 
                { 
                    backgroundColor: `${color}${isDarkMode ? '25' : '15'}` 
                }
            ]}>
                <Ionicons name={icon as any} size={24} color={color} />
            </View>
            <Text style={[
                styles.statValue, 
                { color: colors.text }
            ]}>
                {String(value)}
            </Text>
            <Text style={[
                styles.statTitle, 
                { 
                    color: isDarkMode 
                        ? `${colors.text}70` 
                        : `${colors.text}60` 
                }
            ]}>
                {String(title)}
            </Text>
        </View>
    );

    // Loading state
    if (authIsLoading && !user) {
        return (<View style={[styles.centered, dynamicStyles.container]}><Text style={dynamicStyles.name}>Loading profile...</Text></View>);
    }

    // Main profile screen JSX
    return (
        <SafeAreaView style={[styles.safeArea, dynamicStyles.safeArea]}>
            <ScrollView style={[styles.scrollContainer, dynamicStyles.container]} showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <Animated.View style={[styles.profileHeader, { opacity: animatedValue, transform: [{ translateY: animatedValue.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
                    <LinearGradient colors={isDarkMode ? [colors.primary + '20', colors.primary + '05'] : [colors.primary + '10', colors.primary + '03']} style={styles.headerGradient}>
                        <TouchableOpacity style={styles.profileAvatarContainer} onPress={handleImagePicker} activeOpacity={0.8}>
                            <Avatar
                                source={profileImage ? { uri: profileImage } : undefined}
                                size={120}
                                style={{ borderColor: colors.primary, borderWidth: 4, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: isDarkMode ? 0.4 : 0.2, shadowRadius: 16 }}
                            />
                            <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
                                {isUploadingImage ? (<Ionicons name="hourglass-outline" size={16} color="white" />) : (<Ionicons name="camera" size={16} color="white" />)}
                            </View>
                        </TouchableOpacity>
                        <Text style={[styles.name, dynamicStyles.name]}>{user?.displayName || 'Pasada User'}</Text>
                        <Text style={[styles.email, dynamicStyles.email]}>{user?.email || 'No email'}</Text>
                        <View style={styles.headerActions}>
                            <Button title="Edit Profile" onPress={() => router.push('/(tabs)/profile/edit')} variant="primary" style={styles.editButton} />
                            <TouchableOpacity style={[styles.shareButton, { borderColor: colors.primary, backgroundColor: isDarkMode ? 'transparent' : '#FFFFFF' }]} onPress={handleShareProfile}>
                                <Ionicons name="share-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* Stats Section */}
                <View style={styles.statsSection}>
                    <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setIsStatsModalVisible(true)}>
                        <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Your Stats</Text>
                        <Ionicons name="analytics-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsContainer}>
                        {renderStatCard('Total Trips', userStats.totalTrips.toString(), 'car-outline', colors.primary)}
                        {renderStatCard('Distance', userStats.totalDistance, 'speedometer-outline', '#FF6B6B')}
                        {renderStatCard('Avg Speed', userStats.avgSpeed, 'flash-outline', '#4ECDC4')}
                        {renderStatCard('Fuel Saved', userStats.fuelSaved, 'leaf-outline', '#45B7D1')}
                    </ScrollView>
                </View>

                {/* Settings Sections */}
                <View style={styles.settingsSection}>
                    <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Appearance</Text>
                    <View style={styles.themeOptionsContainer}>
                        {renderThemeOption('light', 'Light', 'sunny-outline')}
                        {renderThemeOption('dark', 'Dark', 'moon-outline')}
                        {renderThemeOption('system', 'Auto', 'phone-portrait-outline')}
                    </View>

                    <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Privacy & Security</Text>
                    {renderSettingRow('location-outline', 'Location Access', locStatus || 'Check...', handleRequestLocation, undefined, 'Required for trip tracking')}
                    {renderSettingRow('navigate-outline', 'Background Location', bgLocStatus || 'Check...', handleRequestBgLocation, undefined, 'For continuous tracking')}
                    {renderSettingRow('finger-print-outline', 'Biometric Authentication', undefined, undefined,
                        <Switch value={biometricEnabled} onValueChange={setBiometricEnabled} trackColor={{ false: isDarkMode ? "#767577" : "#D3D3D3", true: colors.primary }} thumbColor={isDarkMode ? '#E0E0E0' : '#FFFFFF'} />,
                        'Secure app access'
                    )}
                    {renderSettingRow('shield-checkmark-outline', 'Privacy Settings', undefined, () => setIsPrivacyModalVisible(true))}

                    <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Notifications</Text>
                    {renderSettingRow('notifications-outline', 'Push Notifications', undefined, undefined,
                        <Switch value={pushEnabled} onValueChange={setPushEnabled} trackColor={{ false: isDarkMode ? "#767577" : "#D3D3D3", true: colors.primary }} thumbColor={isDarkMode ? '#E0E0E0' : '#FFFFFF'} />,
                        'Trip alerts and updates'
                    )}

                    <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Data & Storage</Text>
                    {renderSettingRow('cloud-upload-outline', 'Auto Backup', undefined, undefined,
                        <Switch value={autoBackupEnabled} onValueChange={setAutoBackupEnabled} trackColor={{ false: isDarkMode ? "#767577" : "#D3D3D3", true: colors.primary }} thumbColor={isDarkMode ? '#E0E0E0' : '#FFFFFF'} />,
                        'Automatic data backup'
                    )}
                    {renderSettingRow('download-outline', 'Export Data', undefined, handleDataExport)}
                    {renderSettingRow('trash-outline', 'Clear Cache', '1.2 MB', () => { Alert.alert('Cache Cleared', 'App cache has been cleared successfully.'); })}

                    <Text style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>Support</Text>
                    {renderSettingRow('help-circle-outline', 'Help Center', undefined, () => { Linking.openURL('https://pasada.com/help'); })}
                    {renderSettingRow('mail-outline', 'Contact Support', undefined, handleContactSupport)}
                    {renderSettingRow('star-outline', 'Rate App', undefined, () => { Linking.openURL(Platform.OS === 'ios' ? 'itms-apps://itunes.apple.com/app/YOUR_APP_ID' : 'market://details?id=YOUR_PACKAGE_NAME'); })}
                    {renderSettingRow('information-circle-outline', 'About', 'v1.0.0', () => setIsModalVisible(true))}
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsSection}>
                    <Button title={authIsLoading ? "Logging out..." : "Logout"} onPress={handleLogout} variant="danger" disabled={authIsLoading} />
                </View>

                {/* --- MODALS --- */}
                <Modal visible={isStatsModalVisible} onClose={() => setIsStatsModalVisible(false)} title="Detailed Statistics">
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>🚗 Total Trips: {userStats.totalTrips.toString()}</Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>📏 Total Distance: {userStats.totalDistance}</Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>⚡ Average Speed: {userStats.avgSpeed}</Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>⛽ Fuel Saved: {userStats.fuelSaved}</Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>🌱 CO₂ Reduced: {userStats.co2Saved}</Text>
                    <Button title="Close" onPress={() => setIsStatsModalVisible(false)} style={{ marginTop: 20 }} />
                </Modal>

                <Modal visible={isModalVisible} onClose={() => setIsModalVisible(false)} title="About Pasada">
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>Version 1.0.0</Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>Built with React Native & Expo.</Text>
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>Your comprehensive travel tracking solution.</Text>
                    <Button title="Close" onPress={() => setIsModalVisible(false)} style={{ marginTop: 20 }} />
                </Modal>

                <Modal visible={isPrivacyModalVisible} onClose={() => setIsPrivacyModalVisible(false)} title="Privacy Settings">
                    <Text style={[styles.modalText, dynamicStyles.modalText]}>Your privacy is important to us. Here you can control how your data is used and shared.</Text>
                    <Button title="View Privacy Policy" onPress={() => Linking.openURL('https://cartrackpro.com/privacy')} style={{ marginTop: 15 }} />
                    <Button title="Close" onPress={() => setIsPrivacyModalVisible(false)} style={{ marginTop: 10 }} />
                </Modal>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    scrollContainer: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    profileHeader: { marginBottom: 20 },
    headerGradient: { paddingTop: 40, paddingHorizontal: 30, paddingBottom: 30, alignItems: 'center' },
    profileAvatarContainer: { marginBottom: 20, position: 'relative' },
    cameraIcon: { position: 'absolute', bottom: 8, right: 8, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, borderWidth: 3, borderColor: 'white' },
    name: { fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
    email: { fontSize: 16, marginBottom: 20 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    editButton: { paddingHorizontal: 30 },
    shareButton: { padding: 12, borderRadius: 25, borderWidth: 1.5 },
    statsSection: { paddingHorizontal: 20, marginBottom: 25 },
    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    statsContainer: { paddingVertical: 10 },
    statCard: { alignItems: 'center', padding: 16, marginRight: 15, borderRadius: 16, borderWidth: 1, minWidth: 120, elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    statIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    statValue: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
    statTitle: { fontSize: 12, textAlign: 'center' },
    settingsSection: { paddingHorizontal: 20, marginBottom: 20 },
    sectionHeader: { fontSize: 18, fontWeight: '600', marginBottom: 12, marginTop: 25 },
    themeOptionsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingVertical: 5 },
    themeOptionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, marginHorizontal: 4, elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
    themeOptionText: { fontSize: 14, fontWeight: '500', marginLeft: 8 },
    enhancedSettingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, marginVertical: 4, borderRadius: 12, elevation: 1, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    iconContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    settingInfo: { flex: 1 },
    settingText: { fontSize: 16, fontWeight: '500' },
    settingSubtitle: { fontSize: 12, marginTop: 2 },
    settingRight: { flexDirection: 'row', alignItems: 'center' },
    settingValue: { fontSize: 14, marginRight: 8 },
    actionsSection: { paddingHorizontal: 20, paddingBottom: 40, marginTop: 20 },
    modalText: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginBottom: 8 },
});

export default ProfileScreen;