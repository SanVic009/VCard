import { Slot } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { ImageProvider } from '../context/ImageContext';
import { ToastProvider } from '../context/ToastContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, LogBox } from 'react-native';
import OfflineBanner from '../components/OfflineBanner';

LogBox.ignoreLogs(['InteractionManager has been deprecated']);

export default function RootLayout() {
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
