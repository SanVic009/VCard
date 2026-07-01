import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { login } = useAuth();
  const { trackEvent } = require('../../lib/analytics');

  const handleLogin = async () => {
    setEmailError('');
    setPasswordError('');
    let hasError = false;

    const sanitizedEmail = email.trim().toLowerCase();
    if (!sanitizedEmail) {
      setEmailError('Email address is required.');
      hasError = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(sanitizedEmail)) {
        setEmailError('Please enter a valid email address.');
        hasError = true;
      }
    }

    if (!password) {
      setPasswordError('Password is required.');
      hasError = true;
    } else if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsSubmitting(true);
      await login(sanitizedEmail, password);
      trackEvent('user_logged_in', { method: 'email' });
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VCard</Text>

      <TextInput
        style={[
          styles.input, 
          emailError ? styles.inputError : null,
          focusedField === 'email' && styles.inputFocused
        ]}
        placeholder="Email"
        placeholderTextColor="#6B7280"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onFocus={() => setFocusedField('email')}
        onBlur={() => setFocusedField(null)}
      />
      {emailError ? <Text style={styles.errorLabel}>{emailError}</Text> : null}

      <TextInput
        style={[
          styles.input, 
          passwordError ? styles.inputError : null,
          focusedField === 'password' && styles.inputFocused
        ]}
        placeholder="Password"
        placeholderTextColor="#6B7280"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocusedField('password')}
        onBlur={() => setFocusedField(null)}
      />
      {passwordError ? <Text style={styles.errorLabel}>{passwordError}</Text> : null}

      {isSubmitting ? (
        <ActivityIndicator size="large" color="#2E1028" style={styles.spinner} />
      ) : (
        <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
          <Text style={styles.primaryBtnText}>Login</Text>
        </TouchableOpacity>
      )}
      
      <Link href="/auth/signup" style={styles.link}>
        Don't have an account? Sign up
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#E3E4DD',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#2E1028',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    color: '#1A1A1A',
    fontSize: 16,
  },
  inputFocused: {
    borderColor: '#2E1028',
    borderWidth: 1.5,
  },
  inputError: {
    borderColor: '#DC2626',
    marginBottom: 4,
  },
  errorLabel: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 16,
    marginLeft: 4,
  },
  primaryBtn: {
    backgroundColor: '#2E1028',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    marginTop: 24,
    textAlign: 'center',
    color: '#2E1028',
    fontWeight: '600',
    fontSize: 15,
  },
  spinner: {
    marginTop: 8,
  }
});
