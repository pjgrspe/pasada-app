// app/(tabs)/profile/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

// --- IMPORT YOUR COMPONENTS ---
import Avatar from '../../../components/Avatar';
import Button from '../../../components/Button';
// ------------------------------

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
    // const { logout } = useAuth();

    const handleLogout = () => {
        console.log("Logging out...");
        // logout();
        // The _layout should handle redirection automatically.
    }

    if (!user) {
        return <View style={styles.centered}><Text>No user data.</Text></View>;
    }

    return (
        <View style={styles.container}>
            {/* --- USE YOUR AVATAR COMPONENT --- */}
            <Avatar source={{ uri: user.avatarUrl }} size={120} />
            {/* --------------------------------- */}

            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.email}>{user.email}</Text>

            {/* --- USE YOUR BUTTON COMPONENT --- */}
            <View style={styles.buttonsContainer}>
                 <Button
                    title="Edit Profile"
                    onPress={() => router.push('/(tabs)/profile/edit')}
                    variant="secondary"
                 />
                 <Button
                    title="Settings"
                    onPress={() => router.push('/(tabs)/settings')} // Navigate to settings tab/screen
                    variant="dark"
                 />
                 <Button
                    title="Logout"
                    onPress={handleLogout}
                    variant="danger"
                 />
            </View>
            {/* ------------------------------- */}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 40,
        paddingHorizontal: 30,
        backgroundColor: '#fff',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 20, // Add space after avatar
    },
    email: {
        fontSize: 16,
        color: 'gray',
        marginBottom: 40,
    },
    buttonsContainer: {
        width: '100%',
        alignItems: 'stretch', // Make buttons take full width
    },
});

export default ProfileScreen;