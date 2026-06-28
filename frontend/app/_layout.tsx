import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { ImageProvider } from '../context/ImageContext';
import { ToastProvider } from '../context/ToastContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, LogBox } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';
import axios from 'axios';

LogBox.ignoreLogs(['InteractionManager has been deprecated']);

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export default function RootLayout() {
  useEffect(() => {
    const pingServer = async () => {
      try {
        await axios.get(`${API_URL}/`);
      } catch (err) {
        // Silently ignore ping errors
      }
    };

    // Initial ping
    pingServer();

    // Set up 4-minute interval ping
    const intervalId = setInterval(pingServer, 4 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);
  return (
    <GestureHandlerRootView style={styles.container}>
      <AuthProvider>
        <ImageProvider>
          <ToastProvider>
            <Slot />
            <OfflineBanner />
          </ToastProvider>
        </ImageProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
