// modules/auth/components/SignupForm.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import Input from '../../../components/Input';
import Button from '../../../components/Button';
import { useAuth } from '../hooks/useAuth';
import { signupSchema } from '../validation/authSchema';
import { ZodError } from 'zod';

export const SignupForm = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { signup, isLoading } = useAuth();

    const handleSignup = async () => {
        setErrors({});
        try {
            const data = { name, email, password, confirmPassword };
            signupSchema.parse(data);
            await signup(data);
            // Navigation handled by _layout
        } catch (error: any) {
             if (error instanceof ZodError) {
                const newErrors: Record<string, string> = {};
                error.errors.forEach(err => {
                    newErrors[err.path[0]] = err.message;
                });
                setErrors(newErrors);
            } else {
                Alert.alert("Signup Failed", error.message || "An unexpected error occurred.");
            }
        }
    };

    return (
        <View style={styles.formContainer}>
             <Input
                placeholder="Full Name"
                value={name}
                onChangeText={setName}
                iconName="person-outline"
                containerStyle={styles.input} style={{ color: '#FFF' }}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}

            <Input
                placeholder="your@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                iconName="mail-outline"
                containerStyle={styles.input} style={{ color: '#FFF' }}
            />
             {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                iconName="lock-closed-outline"
                containerStyle={styles.input} style={{ color: '#FFF' }}
            />
             {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

            <Input
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                iconName="lock-closed-outline"
                containerStyle={styles.input} style={{ color: '#FFF' }}
            />
             {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}

            <Button
                title={isLoading ? "Creating Account..." : "Sign Up"}
                onPress={handleSignup}
                style={styles.button}
                disabled={isLoading}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    formContainer: { width: '100%' },
    input: { backgroundColor: '#3A3A3C', borderColor: '#4A4A4C', color: '#FFF', marginVertical: 6 },
    button: { marginTop: 15 },
    errorText: { color: '#FF6B6B', fontSize: 12, marginLeft: 10, marginTop: -3, marginBottom: 5 },
});