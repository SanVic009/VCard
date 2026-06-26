import { Slot } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { ImageProvider } from '../context/ImageContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <AuthProvider>
        <ImageProvider>
          <Slot />
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
