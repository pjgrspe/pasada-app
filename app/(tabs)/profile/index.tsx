// app/(tabs)/profile/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

// --- IMPORT YOUR COMPONENTS ---
import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
// ------------------------------
import { useTheme } from '../../../hooks/useTheme'; // Import useTheme

// Placeholder
const useUserStore = () => ({
    user: {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=5', // Example avatar
    },
});

const ProfileScreen = () => {
    const { user } = useUserStore();
    const router = useRouter();
    const { colors } = useTheme(); // Use theme
    // const { logout } = useAuth();

    const handleLogout = () => {
        console.log("Logging out...");
        // logout();
        // The _layout should handle redirection automatically.
    }

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        name: { color: colors.text },
        email: { color: colors.text, opacity: 0.6 },
    });


    if (!user) {
        return <View style={[styles.centered, dynamicStyles.container]}><Text style={dynamicStyles.name}>No user data.</Text></View>;
    }

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <Avatar source={{ uri: user.avatarUrl }} size={120} style={{ borderColor: colors.primary }} />
            <Text style={[styles.name, dynamicStyles.name]}>{user.name}</Text>
            <Text style={[styles.email, dynamicStyles.email]}>{user.email}</Text>
            <View style={styles.buttonsContainer}>
                 <Button
                    title="Edit Profile"
                    onPress={() => router.push('/(tabs)/profile/edit')}
                    variant="secondary"
                 />
                 <Button
                    title="Settings"
                    onPress={() => router.push('/(tabs)/settings')}
                    variant="dark"
                 />
                 <Button
                    title="Logout"
                    onPress={handleLogout}
                    variant="danger"
                 />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 30 },
    centered: { justifyContent: 'center' },
    name: { fontSize: 24, fontWeight: 'bold', marginTop: 20 },
    email: { fontSize: 16, marginBottom: 40 },
    buttonsContainer: { width: '100%', alignItems: 'stretch' },
});

export default ProfileScreen;