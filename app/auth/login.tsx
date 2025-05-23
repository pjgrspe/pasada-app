// app/auth/login.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import Input from '@/components/Input';
import Button from '@/components/Button';

// Placeholder: Import your actual LoginForm component
// import LoginForm from '../../modules/auth/components/LoginForm';

// Placeholder Component
const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = () => {
        console.log('Logging in with:', email, password);
        // Add your actual login logic here (using useAuth hook, etc.)
        // On success, the _layout.tsx should handle redirection.
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>Welcome back!</Text>

            {/* --- USE YOUR COMPONENTS --- */}
            <View style={styles.formContainer}>
                <Input
                    placeholder="your@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    iconName="mail-outline" // Example icon
                />
                <Input
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    iconName="lock-closed-outline" // Example icon
                />
                <Button
                    title="Login"
                    onPress={handleLogin}
                    style={styles.loginButton}
                />
            </View>
            {/* --------------------------- */}

            <Link href="/auth/signup" style={styles.link}>
                <Text>Don't have an account? Sign Up</Text>
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
        backgroundColor: '#1C1C1E', // Darker background for auth
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#FFFFFF',
    },
    subtitle: {
        fontSize: 16,
        color: 'gray',
        marginBottom: 40,
    },
    formContainer: {
        width: '100%',
        marginBottom: 20,
    },
    loginButton: {
      marginTop: 15,
    },
    link: {
        marginTop: 15,
        color: '#FF8C00', // Orange link
        textAlign: 'center',
    },
});

export default LoginScreen;