// app/profile/edit.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTheme } from '../../../hooks/useTheme'; // Import theme
import Input from '../../../components/Input'; // Import Input
import Button from '../../../components/Button'; // Import Button
import Avatar from '../../../components/Avatar'; // Import Avatar

// Placeholder: Import your ProfileForm component and hook
// import ProfileForm from '../../modules/profile/components/ProfileForm';
// import { useProfile } from '../../modules/profile/hooks/useProfile';

// Placeholder data/hook - replace with your actual data source
const useProfileData = () => ({
    profile: {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=5',
    },
    updateProfile: async (data: any) => {
        console.log("Saving profile:", data);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        Alert.alert("Success", "Profile updated!");
        return true;
    },
    isLoading: false,
});

// Placeholder Component
// const ProfileForm = () => (
//     <View style={styles.formContainer}>
//         <Text style={styles.label}>Full Name (Placeholder)</Text>
//         {/* <Input placeholder="Your Name" /> */}
//         <Text style={styles.label}>Email (Placeholder)</Text>
//         {/* <Input placeholder="your@email.com" /> */}
//         {/* Add AvatarUpload here */}
//         {/* <Button title="Save Changes" onPress={() => console.log('Save attempt')} /> */}
//         <Text style={styles.placeholderButton}>[Save Changes Button]</Text>
//     </View>
// );

const EditProfileScreen = () => {
    const { colors } = useTheme();
    const { profile, updateProfile, isLoading } = useProfileData();

    const [name, setName] = useState(profile.name);
    const [email, setEmail] = useState(profile.email);

    const handleSaveChanges = () => {
        updateProfile({ name, email });
    };

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: colors.background },
        title: { color: colors.text },
        label: { color: colors.text, opacity: 0.8 },
        input: { // Custom input styles for this screen if needed
            backgroundColor: colors.inputBackground,
            color: colors.inputText,
            borderColor: colors.border,
        }
    });

    return (
        <ScrollView contentContainerStyle={[styles.container, dynamicStyles.container]}>
            <Text style={[styles.title, dynamicStyles.title]}>Edit Your Profile</Text>

            <View style={styles.avatarContainer}>
                 <Avatar source={{ uri: profile.avatarUrl }} size={100} style={{ borderColor: colors.primary }} />
                 {/* You would add a button here to change the avatar */}
                 <Text style={[styles.changeAvatarText, { color: colors.primary }]}>Change Photo</Text>
            </View>


            <View style={styles.formContainer}>
                <Text style={[styles.label, dynamicStyles.label]}>Full Name</Text>
                <Input
                    placeholder="Your Name"
                    value={name}
                    onChangeText={setName}
                    containerStyle={{ backgroundColor: colors.card }} // Use card color
                    style={dynamicStyles.input} // Apply themed text color
                />

                <Text style={[styles.label, dynamicStyles.label]}>Email Address</Text>
                <Input
                    placeholder="your@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    containerStyle={{ backgroundColor: colors.card }}
                    style={dynamicStyles.input}
                    editable={false} // Often email isn't editable
                />

                <Button
                    title={isLoading ? "Saving..." : "Save Changes"}
                    onPress={handleSaveChanges}
                    style={{ marginTop: 30 }}
                    disabled={isLoading}
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
        marginBottom: 8, // Increased space
        marginLeft: 5, // Small indent
    },
});

export default EditProfileScreen;