import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useImageContext } from '../../context/ImageContext';
import { processImage } from '../../lib/imageProcessor';
import { requestCameraPermission } from '../../lib/permissions';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

export default function CardCaptureScreen() {
  const router = useRouter();
  const { selectedImages, setSelectedImages, clearSelectedImages } = useImageContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const firstImage = selectedImages[0];

  const handleCaptureBack = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    // Enable native editing on capture for the back side too
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    try {
      setIsProcessing(true);
      const processed = await processImage(result.assets[0].uri);
      if (firstImage) {
        setSelectedImages([firstImage, processed]);
      } else {
        setSelectedImages([processed]);
      }
      router.push('/(app)/confirm' as any);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to process image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDone = () => {
    router.push('/(app)/confirm' as any);
  };

  const handleRetake = () => {
    Alert.alert(
      "Discard Photo",
      "Are you sure you want to discard this photo and retake?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await clearSelectedImages();
            router.replace('/(app)/dashboard');
          }
        }
      ]
    );
  };

  if (!firstImage) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No image captured.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/(app)/dashboard')}>
          <Text style={styles.btnPrimaryText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Drawer.Screen options={{ title: 'VCard' }} />
      
      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2E1028" />
          <Text style={styles.loadingText}>Processing second image...</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Got the front?</Text>
          <Text style={styles.subtitle}>You can add the back side of the card, or finish now.</Text>
        </View>

        <View style={styles.previewContainer}>
          <Image
            source={{ uri: firstImage.uri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Front Side</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleCaptureBack} disabled={isProcessing}>
            <MaterialIcons name="camera-alt" size={22} color="#fff" style={styles.btnIcon} />
            <Text style={styles.btnPrimaryText}>Add Second Side</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSecondary} onPress={handleDone} disabled={isProcessing}>
            <MaterialIcons name="check" size={22} color="#2E1028" style={styles.btnIcon} />
            <Text style={styles.btnSecondaryText}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnDanger} onPress={handleRetake} disabled={isProcessing}>
            <MaterialIcons name="delete" size={20} color="#DC2626" style={styles.btnIcon} />
            <Text style={styles.btnDangerText}>Retake / Discard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3E4DD',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E3E4DD',
    padding: 20,
  },
  headerTextContainer: {
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2E1028',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 1.58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
    position: 'relative',
    marginVertical: 20,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(46, 16, 40, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: '#2E1028',
    height: 52,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#2E1028',
    height: 52,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  btnSecondaryText: {
    color: '#2E1028',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnDanger: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  btnDangerText: {
    color: '#DC2626',
    fontWeight: 'bold',
    fontSize: 15,
  },
  btnIcon: {
    marginRight: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    marginBottom: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#2E1028',
  },
});
