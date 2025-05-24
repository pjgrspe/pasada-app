// app/auth/login.tsx
import React from 'react';
import { Text, StyleSheet, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { Link } from 'expo-router';
import { LoginForm } from '../../modules/auth/components/LoginForm'; // Import from module
import { useTheme } from '../../hooks/useTheme';

const LoginScreen = () => {
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
                keyboardShouldPersistTaps="handled" // Important for forms
            >
                <Text style={[styles.title, dynamicStyles.title]}>Login</Text>
                <Text style={[styles.subtitle, dynamicStyles.subtitle]}>Welcome back!</Text>
                <LoginForm />
                <Link href="/auth/signup" replace style={[styles.linkBase, dynamicStyles.link]}>
                    Don't have an account? Sign Up
                </Link>

                {/* <Pressable onPress={() => router.replace('/auth/signup')} style={[styles.linkBase]}>
                    <Text>Don't have an account? Sign Up</Text>
                </Pressable> */}

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    title: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
    subtitle: { fontSize: 16, marginBottom: 40 },
    linkBase: { marginTop: 25, textAlign: 'center', fontSize: 16 },
});

export default LoginScreen;