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
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      setIsSubmitting(true);
      await login(email, password);
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDevLogin = async () => {
    try {
      setIsSubmitting(true);
      await login("test@example.com", "password123");
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
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
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
  link: {
    marginTop: 20,
    textAlign: 'center',
    color: 'blue',
  },
});
