import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { logout, user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Profile</Text>
        <View style={styles.card}>
          <View style={styles.item}>
            <MaterialIcons name="email" size={22} color="#666" />
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
            <MaterialIcons name="notifications-none" size={22} color="#666" />
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>Push Notifications</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </View>
          
          <View style={styles.item}>
            <MaterialIcons name="color-lens" size={22} color="#666" />
            <View style={styles.itemBody}>
              <Text style={styles.itemTitle}>Theme Mode (System Default)</Text>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#ccc" />
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <MaterialIcons name="logout" size={20} color="#dc3545" />
        <Text style={styles.logoutButtonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 5,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '500',
  },
  itemLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  itemValue: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '500',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f8d7da',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  logoutButtonText: {
    color: '#dc3545',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
