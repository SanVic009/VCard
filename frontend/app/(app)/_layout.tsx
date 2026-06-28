import { Drawer } from 'expo-router/drawer';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from 'expo-router/drawer';
import { MaterialIcons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { useImageContext } from '../../context/ImageContext';

function CustomDrawerContent(props: any) {
  const { logout } = useAuth();
  const { clearSelectedImages } = useImageContext();
  const router = useRouter();

  // Get current active route to highlight the correct DrawerItem
  const activeRouteName = props.state.routes[props.state.index]?.name;

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props}>
        <DrawerItem
          label="Dashboard"
          icon={({ color, size }) => <MaterialIcons name="dashboard" color={color} size={size} />}
          focused={activeRouteName === 'dashboard'}
          onPress={() => router.push('/(app)/dashboard')}
        />
        <DrawerItem
          label="Settings"
          icon={({ color, size }) => <MaterialIcons name="settings" color={color} size={size} />}
          focused={activeRouteName === 'settings'}
          onPress={() => router.push('/(app)/settings')}
        />
        <DrawerItem
          label="About"
          icon={({ color, size }) => <MaterialIcons name="info" color={color} size={size} />}
          focused={activeRouteName === 'about'}
          onPress={() => router.push('/(app)/about')}
        />
      </DrawerContentScrollView>
      <View style={styles.logoutSection}>
        <DrawerItem
          label="Logout"
          icon={({ color, size }) => <MaterialIcons name="logout" color={color} size={size} />}
          onPress={() => {
            clearSelectedImages();
            logout();
          }}
        />
      </View>
    </View>
  );
}

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
    <Drawer drawerContent={(props) => <CustomDrawerContent {...props} />}>
      <Drawer.Screen
        name="dashboard"
        options={{
          drawerLabel: 'Dashboard',
          title: 'VCard',
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

    </Drawer>
  );
}

const styles = StyleSheet.create({
  logoutSection: {
    marginBottom: 20,
    borderTopColor: '#ccc',
    borderTopWidth: 1,
  },
});
