// app/auth/index.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link, Redirect } from 'expo-router';
// import Button from '../../components/Button'; // Your global button

const AuthIndexScreen = () => {
    // Usually, you'd redirect to login from here or the _layout.
    // If a user somehow lands here, maybe redirect them.
    // Or, provide options to Login or Sign Up.
    // For now, let's redirect to login as a default.
    return <Redirect href="/auth/login" />;

    // Alternative: Show options
    /*
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome!</Text>
            <Text style={styles.subtitle}>Track and Navigate Your Cars</Text>
            <Link href="/auth/login" asChild>
                <Button title="Login" />
            </Link>
            <Link href="/auth/signup" asChild>
                <Button title="Sign Up" />
            </Link>
        </View>
    );
    */
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 18,
        color: 'gray',
        marginBottom: 40,
    },
});

export default AuthIndexScreen;