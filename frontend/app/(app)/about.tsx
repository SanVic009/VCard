import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <MaterialIcons name="contact-phone" size={48} color="#007bff" />
        </View>
        <Text style={styles.appName}>VCard</Text>
        <Text style={styles.appVersion}>Version 1.0.0 (Production)</Text>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>About the App</Text>
        <Text style={styles.cardText}>
          VCard is a premium business card reader app powered by local edge AI processing and Supabase cloud synchronization. It instantly scans physical cards, extracts key contact details using state-of-the-art Gemma models, and organizes your contacts seamlessly.
        </Text>
      </View>

      <View style={styles.features}>
        <Text style={styles.featuresTitle}>Key Features</Text>
        <View style={styles.featureItem}>
          <MaterialIcons name="camera" size={20} color="#007bff" />
          <Text style={styles.featureText}>Instant Camera OCR & Extraction</Text>
        </View>
        <View style={styles.featureItem}>
          <MaterialIcons name="cloud-sync" size={20} color="#007bff" />
          <Text style={styles.featureText}>Cloud Synchronization with Supabase</Text>
        </View>
        <View style={styles.featureItem}>
          <MaterialIcons name="edit" size={20} color="#007bff" />
          <Text style={styles.featureText}>Editable Fields and Direct Correction</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 20,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  logoIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 15,
  },
  appName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: '#6c757d',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    width: '100%',
    marginBottom: 25,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 20,
  },
  features: {
    width: '100%',
    paddingHorizontal: 5,
  },
  featuresTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#6c757d',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#212529',
    fontWeight: '500',
  },
});
