import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard, 
  ScrollView 
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    }

    if (hasError) return;

    try {
      setIsSubmitting(true);
      await login(sanitizedEmail, password);
      trackEvent('user_logged_in', { method: 'email' });
    } catch (error: any) {
      const status = error.response?.status;
      const errorMsg = error.message || "";
      if (status === 429 || errorMsg.includes('429') || errorMsg.toLowerCase().includes('too many')) {
        setPasswordError('Too many login attempts. Please wait and try again.');
      } else {
        setPasswordError('Incorrect email or password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardAvoid}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <Text style={styles.title}>VCard</Text>

            <View style={[
              styles.inputContainer,
              emailError ? styles.inputContainerError : null,
              focusedField === 'email' && styles.inputContainerFocused
            ]}>
              <TextInput
                style={styles.input}
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
            </View>
            {emailError ? <Text style={styles.errorLabel}>{emailError}</Text> : null}

            <View style={[
              styles.inputContainer,
              passwordError ? styles.inputContainerError : null,
              focusedField === 'password' && styles.inputContainerFocused
            ]}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity 
                style={styles.eyeButton} 
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons 
                  name={showPassword ? "visibility-off" : "visibility"} 
                  size={24} 
                  color="#6B7280" 
                />
              </TouchableOpacity>
            </View>
            {passwordError ? <Text style={styles.errorLabel}>{passwordError}</Text> : null}

            {isSubmitting ? (
              <ActivityIndicator size="large" color="#2E1028" style={styles.spinner} />
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
                <Text style={styles.primaryBtnText}>Login</Text>
              </TouchableOpacity>
            )}

            <Link href="/auth/forgot-password" style={styles.forgotPasswordLink}>
              Forgot Password?
            </Link>
            
            <Link href="/auth/signup" style={styles.link}>
              Don't have an account? Sign up
            </Link>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#E3E4DD',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    padding: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 32,
    textAlign: 'center',
    color: '#2E1028',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  inputContainerFocused: {
    borderColor: '#2E1028',
    borderWidth: 1.5,
  },
  inputContainerError: {
    borderColor: '#DC2626',
    marginBottom: 4,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#1A1A1A',
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorLabel: {
    color: '#DC2626',
    fontSize: 12,
    marginBottom: 16,
    marginLeft: 4,
  },
  forgotPasswordLink: {
    textAlign: 'center',
    color: '#2E1028',
    fontWeight: '600',
    fontSize: 15,
    marginTop: 20,
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
    marginTop: 16,
    textAlign: 'center',
    color: '#2E1028',
    fontWeight: '600',
    fontSize: 15,
  },
  spinner: {
    marginTop: 8,
  }
});
