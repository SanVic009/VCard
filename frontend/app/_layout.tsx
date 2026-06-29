import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { ImageProvider } from '../context/ImageContext';
import { ToastProvider } from '../context/ToastContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, LogBox } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';
import axios from 'axios';
import { API_URL } from '../lib/api';
import { useFonts } from 'expo-font';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';

LogBox.ignoreLogs(['InteractionManager has been deprecated']);

// Keep the splash screen visible while we load fonts
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

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

    // Set up 30-second interval ping (half minute) to prevent Render server sleep
    const intervalId = setInterval(pingServer, 30 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  if (!loaded && !error) {
    return null;
  }

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
