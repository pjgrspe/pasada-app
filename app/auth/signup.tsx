// app/auth/signup.tsx
import React from 'react';
import { Text, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Link } from 'expo-router';
import { SignupForm } from '../../modules/auth/components/SignupForm'; // Import from module
import { useTheme } from '../../hooks/useTheme';

const SignupScreen = () => {
    const { colors } = useTheme();

    const dynamicStyles = StyleSheet.create({
        container: { backgroundColor: '#1C1C1E' },
        title: { color: '#FFFFFF' },
        subtitle: { color: 'gray' },
        link: { color: colors.primary },
    });

    return (
         <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <ScrollView
                contentContainerStyle={[styles.container, dynamicStyles.container]}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={[styles.title, dynamicStyles.title]}>Create Account</Text>
                <Text style={[styles.subtitle, dynamicStyles.subtitle]}>Join us and start tracking!</Text>
                <SignupForm />
                <Link href="/auth/login" style={[styles.linkBase, dynamicStyles.link]}>
                    Already have an account? Login
                </Link>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 16, marginBottom: 30 },
    linkBase: { marginTop: 25, textAlign: 'center', fontSize: 16 },
});

export default SignupScreen;