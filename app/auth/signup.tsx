// app/auth/signup.tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Link } from 'expo-router';

// Placeholder: Import your actual SignupForm component
// import SignupForm from '../../modules/auth/components/SignupForm';

// Placeholder Component
const SignupForm = () => (
    <View style={styles.formContainer}>
        <Text style={styles.label}>Full Name (Placeholder)</Text>
        {/* <Input placeholder="Your Name" /> */}
        <Text style={styles.label}>Email (Placeholder)</Text>
        {/* <Input placeholder="your@email.com" /> */}
        <Text style={styles.label}>Password (Placeholder)</Text>
        {/* <Input placeholder="********" secureTextEntry /> */}
        <Text style={styles.label}>Confirm Password (Placeholder)</Text>
        {/* <Input placeholder="********" secureTextEntry /> */}
        {/* <Button title="Sign Up" onPress={() => console.log('Signup attempt')} /> */}
        <Text style={styles.placeholderButton}>[Sign Up Button]</Text>
    </View>
);

const SignupScreen = () => {
    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us and start tracking!</Text>

            <SignupForm />

            <Link href="/auth/login" style={styles.link}>
                <Text>Already have an account? Login</Text>
            </Link>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'gray',
        marginBottom: 30,
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
    link: {
        marginTop: 15,
        color: '#f4511e',
        textAlign: 'center',
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

export default SignupScreen;