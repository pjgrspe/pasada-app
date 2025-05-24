// app/(tabs)/profile/index.tsx
import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
import { useTheme } from '../../../hooks/useTheme';
import { useAuth } from '../../../modules/auth/hooks/useAuth'; // Import useAuth

const ProfileScreen = () => {
    const router = useRouter();
    const { colors } = useTheme();
    const { user, logout, isLoading: authIsLoading } = useAuth(); // Get user, logout, and isLoading from useAuth

    const handleLogout = async () => {
        console.log("Attempting to log out...");
        try {
            await logout();
            console.log("Logout successful, navigation should occur.");
        } catch (error: any) {
            Alert.alert("Logout Failed", error.message || "Could not log out.");
            console.error("Logout failed in ProfileScreen:", error);
        }
    }

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        name: { color: colors.text },
        email: { color: colors.text, opacity: 0.6 },
    });

    // Display loading or "No user data" if the user object isn't available yet
    if (authIsLoading && !user) { // Show loading if auth is in progress and no user yet
        return <View style={[styles.centered, dynamicStyles.container]}><Text style={dynamicStyles.name}>Loading profile...</Text></View>;
    }

    if (!user) {
        return <View style={[styles.centered, dynamicStyles.container]}><Text style={dynamicStyles.name}>No user data available. Please log in.</Text></View>;
    }

    // Use user.displayName for the name and user.photoURL for avatar if available
    // The Avatar component will use its default if user.photoURL is null or undefined
    return (
        <View style={[styles.container, dynamicStyles.container]}>
            <Avatar 
                source={user.photoURL ? { uri: user.photoURL } : undefined} 
                size={120} 
                style={{ borderColor: colors.primary }} 
            />
            <Text style={[styles.name, dynamicStyles.name]}>{user.displayName || 'Pasada User'}</Text>
            <Text style={[styles.email, dynamicStyles.email]}>{user.email || 'No email'}</Text>
            <View style={styles.buttonsContainer}>
                 <Button
                    title="Edit Profile"
                    onPress={() => router.push('/(tabs)/profile/edit')}
                    variant="primary"
                 />
                 <Button
                    title="Notifications"
                    onPress={() => router.push('/(tabs)/settings')}
                    variant="dark"
                 />
                 <Button
                    title={authIsLoading ? "Logging out..." : "Logout"}
                    onPress={handleLogout}
                    variant="danger"
                    disabled={authIsLoading}
                 />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 30 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' }, // Ensure centered is defined
    name: { fontSize: 24, fontWeight: 'bold', marginTop: 20 },
    email: { fontSize: 16, marginBottom: 40 },
    buttonsContainer: { width: '100%', alignItems: 'stretch' },
});

export default ProfileScreen;