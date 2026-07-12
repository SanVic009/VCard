import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';

import { useImageContext } from '../../context/ImageContext';

export default function SettingsScreen() {
  const { logout, user } = useAuth();
  const { clearSelectedImages } = useImageContext();

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Profile</Text>
        <View style={styles.card}>
          <View style={styles.item}>
            <MaterialIcons name="email" size={22} color="#2E1028" />
            <View style={styles.itemBody}>
              <Text style={styles.itemLabel}>Email Address</Text>
              <Text style={styles.itemValue}>{user?.email || 'Not logged in'}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        <View style={styles.card}>
          <View style={[styles.item, styles.borderBottom]}>
            <MaterialIcons name="notifications-none" size={22} color="#2E1028" />
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>Push Notifications</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
          </View>
          
          <View style={styles.item}>
            <MaterialIcons name="color-lens" size={22} color="#2E1028" />
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>Theme Mode (System Default)</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#D1D5DB" />
          </View>
        </View>
      </View>

      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={async () => {
          await clearSelectedImages();
          logout();
        }}
      >
        <MaterialIcons name="logout" size={20} color="#FFFFFF" />
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3E4DD',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E1028',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  itemLabel: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  itemValue: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    borderRadius: 8,
    padding: 16,
    gap: 8,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
