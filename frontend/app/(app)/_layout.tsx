import { Stack } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function AppLayout() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#2E1028',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      {/* Hide Stack header for Drawer since it renders its own headers */}
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      
      {/* Dynamic/Modal stack screens */}
      <Stack.Screen name="card-capture" options={{ title: 'Capture Card' }} />
      <Stack.Screen name="confirm" options={{ title: 'Confirm Details' }} />
      
      {/* Detail stack screens */}
      <Stack.Screen name="card/[id]" options={{ title: 'Card Details' }} />
      <Stack.Screen name="company/[id]" options={{ title: 'Company Details' }} />
    </Stack>
  );
}
