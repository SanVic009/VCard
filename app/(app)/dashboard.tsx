import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CardResponse } from '../../lib/cardsApi';
import { useCards } from '../../hooks/useCards';
import * as ImagePicker from 'expo-image-picker';
import { requestCameraPermission, requestGalleryPermission } from '../../lib/permissions';
import { processImage } from '../../lib/imageProcessor';
import { useImageContext } from '../../context/ImageContext';

export default function DashboardScreen() {
  const router = useRouter();
  const { cards, loading, error, refresh } = useCards();
  const { setSelectedImage } = useImageContext();
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh(true);
      setIsFabOpen(false); // Close FAB when returning
    }, [refresh])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleImageResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    try {
      setIsProcessing(true);
      const asset = result.assets[0];
      const processedImage = await processImage(asset.uri);
      
      setSelectedImage(processedImage);
      router.push('/(app)/preview');
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to process image.");
    } finally {
      setIsProcessing(false);
      setIsFabOpen(false);
    }
  };

  const openCamera = async () => {
    setIsFabOpen(false);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    
    await handleImageResult(result);
  };

  const openGallery = async () => {
    setIsFabOpen(false);
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      selectionLimit: 1,
    });
    
    await handleImageResult(result);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: CardResponse }) => (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => router.push(`/(app)/card/${item.id}`)}
    >
      <Text style={styles.cardName}>{item.name || 'Unknown Name'}</Text>
      <Text style={styles.cardCompany}>{item.company || 'Unknown Company'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Overlay to close FAB when tapping outside */}
      {isFabOpen && (
        <Pressable style={styles.overlay} onPress={() => setIsFabOpen(false)} />
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => refresh()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {cards.length === 0 && !error && !loading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No cards yet.</Text>
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Speed Dial Actions */}
      {isFabOpen && !isProcessing && (
        <View style={styles.speedDialContainer}>
          <View style={styles.actionRow}>
            <Text style={styles.actionLabel}>Gallery</Text>
            <TouchableOpacity style={[styles.fabSmall, styles.galleryFab]} onPress={openGallery}>
              <MaterialIcons name="photo-library" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.actionRow}>
            <Text style={styles.actionLabel}>Camera</Text>
            <TouchableOpacity style={[styles.fabSmall, styles.cameraFab]} onPress={openCamera}>
              <MaterialIcons name="camera-alt" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main FAB */}
      <TouchableOpacity 
        style={[styles.fab, isFabOpen && styles.fabOpen]} 
        onPress={() => setIsFabOpen(!isFabOpen)}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <MaterialIcons name={isFabOpen ? "close" : "add"} size={28} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 80,
  },
  cardItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
  errorContainer: {
    padding: 15,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  speedDialContainer: {
    position: 'absolute',
    right: 25,
    bottom: 90,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionLabel: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginRight: 15,
    fontWeight: 'bold',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
  },
  fabSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cameraFab: {
    backgroundColor: '#007bff',
  },
  galleryFab: {
    backgroundColor: '#6c757d',
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: '#28a745',
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    zIndex: 2,
  },
  fabOpen: {
    backgroundColor: '#dc3545',
  }
});
