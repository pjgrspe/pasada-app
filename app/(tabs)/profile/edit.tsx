// app/profile/edit.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

// Placeholder: Import your ProfileForm component and hook
// import ProfileForm from '../../modules/profile/components/ProfileForm';
// import { useProfile } from '../../modules/profile/hooks/useProfile';

// Placeholder Component
const ProfileForm = () => (
    <View style={styles.formContainer}>
        <Text style={styles.label}>Full Name (Placeholder)</Text>
        {/* <Input placeholder="Your Name" /> */}
        <Text style={styles.label}>Email (Placeholder)</Text>
        {/* <Input placeholder="your@email.com" /> */}
        {/* Add AvatarUpload here */}
        {/* <Button title="Save Changes" onPress={() => console.log('Save attempt')} /> */}
        <Text style={styles.placeholderButton}>[Save Changes Button]</Text>
    </View>
);

const EditProfileScreen = () => {
    // const { profile, updateProfile, isLoading } = useProfile();

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Edit Your Profile</Text>

            <ProfileForm />
             {/* Pass initialData={profile} and onSubmit={updateProfile} to the real form */}

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 30,
        textAlign: 'center',
    },
     formContainer: {
        width: '100%',
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        color: '#333',
    },
     placeholderButton: {
        backgroundColor: '#f4511e',
        color: 'white',
        padding: 15,
        borderRadius: 5,
        textAlign: 'center',
        marginTop: 10,
        fontSize: 16,
        fontWeight: 'bold',
    }
});

export default EditProfileScreen;