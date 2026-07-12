import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <MaterialIcons name="contact-phone" size={48} color="#2E1028" />
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
          <MaterialIcons name="camera" size={20} color="#2E1028" />
          <Text style={styles.featureText}>Instant Camera OCR & Extraction</Text>
        </View>
        <View style={styles.featureItem}>
          <MaterialIcons name="cloud-sync" size={20} color="#2E1028" />
          <Text style={styles.featureText}>Cloud Synchronization with Supabase</Text>
        </View>
        <View style={styles.featureItem}>
          <MaterialIcons name="edit" size={20} color="#2E1028" />
          <Text style={styles.featureText}>Editable Fields and Direct Correction</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3E4DD',
    paddingHorizontal: 16,
    paddingTop: 20,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 15,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E1028',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
    width: '100%',
    marginBottom: 25,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  features: {
    width: '100%',
    paddingHorizontal: 5,
  },
  featuresTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E1028',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
});
