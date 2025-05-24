// app/(tabs)/profile/edit.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router'; // Import useRouter
import { useTheme } from '../../../hooks/useTheme';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import Avatar from '../../../components/Avatar';
import { useAuth } from '../../../modules/auth/hooks/useAuth'; // Import useAuth
import authService from '../../../modules/auth/services/authService'; // Import authService directly for update

const EditProfileScreen = () => {
    const { colors } = useTheme();
    const { user, _setUser } = useAuth(); // Get user and _setUser from useAuth
    const router = useRouter(); // Initialize router

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    // Add a loading state for the profile update operation
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.displayName || '');
            setEmail(user.email || '');
        }
    }, [user]); // Re-run effect if user object changes

    const handleSaveChanges = async () => {
        if (!user) {
            Alert.alert("Error", "No user found. Please re-login.");
            return;
        }
        if (!name.trim()) {
            Alert.alert("Validation Error", "Name cannot be empty.");
            return;
        }

        setIsUpdatingProfile(true);
        try {
            await authService.updateUserProfileData({ displayName: name });
            // Refresh user data in the store
            const updatedFirebaseUser = authService.getCurrentUser();
            if (updatedFirebaseUser) {
                _setUser(updatedFirebaseUser); // This will trigger re-renders where user is used
            }
            Alert.alert("Success", "Profile updated!");
            router.back(); // Navigate back after successful update
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to update profile.");
            console.error("Failed to update profile:", error);
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        title: { color: colors.text },
        label: { color: colors.text, opacity: 0.8 },
        input: {
            backgroundColor: colors.inputBackground,
            color: colors.inputText,
            borderColor: colors.border,
        }
    });

    if (!user) {
        // This can be a loading indicator or null if _layout handles initial loading
        return <View style={[styles.container, dynamicStyles.container, styles.centered]}><Text style={dynamicStyles.label}>Loading profile...</Text></View>;
    }

    return (
        <ScrollView contentContainerStyle={[styles.container, dynamicStyles.container]}>
            <Text style={[styles.title, dynamicStyles.title]}>Edit Your Profile</Text>

            <View style={styles.avatarContainer}>
                 <Avatar 
                    source={user.photoURL ? { uri: user.photoURL } : undefined} 
                    size={100} 
                    style={{ borderColor: colors.primary }} 
                 />
                 {/* Placeholder for avatar change functionality */}
                 <TouchableOpacity onPress={() => Alert.alert("Feature Coming Soon", "Avatar change functionality is not yet implemented.")}>
                    <Text style={[styles.changeAvatarText, { color: colors.primary }]}>Change Photo</Text>
                 </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
                <Text style={[styles.label, dynamicStyles.label]}>Full Name</Text>
                <Input
                    placeholder="Your Name"
                    value={name}
                    onChangeText={setName}
                    containerStyle={{ backgroundColor: colors.card }}
                    style={dynamicStyles.input}
                />

                <Text style={[styles.label, dynamicStyles.label]}>Email Address</Text>
                <Input
                    placeholder="your@email.com"
                    value={email}
                    // Typically email is not editable or requires a special process
                    editable={false} 
                    containerStyle={{ backgroundColor: colors.card, opacity: 0.7 }} // Indicate non-editable
                    style={dynamicStyles.input}
                />

                <Button
                    title={isUpdatingProfile ? "Saving..." : "Save Changes"}
                    onPress={handleSaveChanges}
                    style={{ marginTop: 30 }}
                    disabled={isUpdatingProfile}
                />
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
    },
    centered: { // Added for loading state
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 30,
        textAlign: 'center',
    },
     avatarContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    changeAvatarText: {
        marginTop: 10,
        fontSize: 16,
        fontWeight: '500',
    },
     formContainer: {
        width: '100%',
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 8,
        marginLeft: 5,
    },
});

export default EditProfileScreen;