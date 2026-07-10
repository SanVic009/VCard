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
import { Link, useRouter } from 'expo-router';
import { forgotPassword } from '../../lib/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleSendLink = async () => {
    setEmailError('');
    setSuccessMessage('');
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

    if (hasError) return;

    try {
      setIsSubmitting(true);
      await forgotPassword(sanitizedEmail);
      setSuccessMessage('Check your email for a reset link.');
    } catch (error: any) {
      const msg = error.message || "An error occurred";
      setEmailError(msg);
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
            <Text style={styles.title}>Forgot Password</Text>
            
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

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
            {emailError && emailError.includes('Please sign up') ? (
              <TouchableOpacity 
                style={styles.signUpBtn}
                onPress={() => router.push('/auth/signup')}
              >
                <Text style={styles.signUpBtnText}>Sign Up for an Account</Text>
              </TouchableOpacity>
            ) : null}
            {successMessage ? <Text style={styles.successLabel}>{successMessage}</Text> : null}

            {isSubmitting ? (
              <ActivityIndicator size="large" color="#2E1028" style={styles.spinner} />
            ) : (
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSendLink}>
                <Text style={styles.primaryBtnText}>Send Reset Link</Text>
              </TouchableOpacity>
            )}

            <Link href="/auth/login" style={styles.link}>
              Back to Login
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
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#2E1028',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 12,
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
  successLabel: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
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
  },
  signUpBtn: {
    borderWidth: 1.5,
    borderColor: '#2E1028',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  signUpBtnText: {
    color: '#2E1028',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
