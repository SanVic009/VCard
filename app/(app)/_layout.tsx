import { Drawer } from 'expo-router/drawer';
import { useAuth } from '../../context/AuthContext';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function AppLayout() {
  const { token, loading } = useAuth();

  // You can keep the splash screen open, or render a loading screen like we do here.
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Only require authentication within the (app) group's layout as users
  // need to be able to access the (auth) group and sign in again.
  if (!token) {
    // On web, static rendering will stop here as the user is not authenticated
    // in the headless Node process that the pages are rendered in.
    return <Redirect href="/auth/login" />;
  }

  return (
    <Drawer>
      <Drawer.Screen
        name="dashboard"
        options={{
          drawerLabel: 'Dashboard',
          title: 'Dashboard',
        }}
      />
      <Drawer.Screen
        name="history"
        options={{
          drawerLabel: 'History',
          title: 'History',
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          drawerLabel: 'Settings',
          title: 'Settings',
        }}
      />
      <Drawer.Screen
        name="about"
        options={{
          drawerLabel: 'About',
          title: 'About',
        }}
      />
      
      {/* Hidden screens from Drawer */}
      <Drawer.Screen
        name="upload"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Upload',
        }}
      />
      <Drawer.Screen
        name="results"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Results',
        }}
      />
    </Drawer>
  );
}
