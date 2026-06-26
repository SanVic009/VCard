import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'expo-router';
import api from '../../lib/api';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { login, signup } = useAuth();
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

  const handleDevLogin = async () => {
    setEmailError('');
    setPasswordError('');
    try {
      setIsSubmitting(true);
      try {
        await login("test@example.com", "password123");
        trackEvent('user_logged_in', { method: 'email' });
      } catch (loginError: any) {
        // If login fails (e.g. user does not exist in the new Supabase instance), attempt signup
        await signup("test@example.com", "password123");
        trackEvent('user_signed_up', { method: 'email' });
        trackEvent('user_logged_in', { method: 'email' });
      }
    } catch (error: any) {
      Alert.alert('Dev Login Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pingServer = async () => {
    try {
      setIsPinging(true);
      const response = await api.get('/');
      Alert.alert('Ping Successful!', `Server says: ${response.data.status} (Auth mode: ${response.data.auth_mode})`);
    } catch (error: any) {
      Alert.alert('Ping Failed', `Could not reach server: ${error.message}`);
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>
      
      <View style={styles.pingContainer}>
        {isPinging ? (
          <ActivityIndicator size="small" />
        ) : (
          <Button title="Ping Server" onPress={pingServer} color="#17a2b8" />
        )}
      </View>

      <TextInput
        style={[styles.input, emailError ? styles.inputError : null]}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      {emailError ? <Text style={styles.errorLabel}>{emailError}</Text> : null}

      <TextInput
        style={[styles.input, passwordError ? styles.inputError : null]}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {passwordError ? <Text style={styles.errorLabel}>{passwordError}</Text> : null}

      {isSubmitting ? (
        <ActivityIndicator size="large" />
      ) : (
        <>
          <Button title="Login" onPress={handleLogin} />
          <View style={styles.spacer} />
          <Button title="Dev Login" onPress={handleDevLogin} color="#6c757d" />
        </>
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
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  pingContainer: {
    marginBottom: 20,
  },
  spacer: {
    height: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
  },
  inputError: {
    borderColor: '#dc3545',
    marginBottom: 5,
  },
  errorLabel: {
    color: '#dc3545',
    fontSize: 12,
    marginBottom: 15,
    marginLeft: 5,
  },
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: 'blue',
  },
});
