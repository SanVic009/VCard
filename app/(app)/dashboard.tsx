import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Pressable, TextInput } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { CardResponse } from '../../lib/cardsApi';
import { useCards } from '../../hooks/useCards';
import * as ImagePicker from 'expo-image-picker';
import { requestCameraPermission, requestGalleryPermission } from '../../lib/permissions';
import { processImage } from '../../lib/imageProcessor';
import { useImageContext } from '../../context/ImageContext';
import { CardListSkeleton } from '../../components/Skeleton';
import { trackEvent } from '../../lib/analytics';
import { mutationState } from '../../lib/mutationState';

interface CardItemProps {
  item: CardResponse;
  onPress: (id: string) => void;
  formatDate: (dateStr: string) => string;
}

const CardItem = React.memo(({ item, onPress, formatDate }: CardItemProps) => {
  return (
    <TouchableOpacity
      style={styles.cardItem}
      onPress={() => onPress(item.id)}
    >
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name || 'Unknown Name'}</Text>
        <Text style={styles.cardCompany}>{item.company || 'Unknown Company'}</Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
        <MaterialIcons name="chevron-right" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );
});

export default function DashboardScreen() {
  const router = useRouter();
  const { cards, loading, error, refresh } = useCards();
  const { setSelectedImage } = useImageContext();
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Fetch when debounced query changes & track search event
  useEffect(() => {
    const runSearch = async () => {
      const results = await refresh(false, debouncedQuery);
      if (debouncedQuery.trim().length > 0) {
        trackEvent('search_performed', {
          query_length: debouncedQuery.trim().length,
          result_count: results ? results.length : 0,
        });
      }
    };
    runSearch();
  }, [debouncedQuery, refresh]);

  useFocusEffect(
    useCallback(() => {
      if (mutationState.hasMutated) {
        refresh(true, searchQuery);
        mutationState.hasMutated = false;
      }
      setIsFabOpen(false); // Close FAB when returning
    }, [refresh, searchQuery])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh(true, searchQuery);
    setRefreshing(false);
  }, [refresh, searchQuery]);

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

  const handleScanFirstCard = () => {
    Alert.alert(
      "Scan Card",
      "Choose an option to scan your card:",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Choose from Gallery", onPress: openGallery },
        { text: "Take Photo", onPress: openCamera },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handlePressCard = useCallback((id: string) => {
    router.push(`/(app)/card/${id}`);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: CardResponse }) => (
    <CardItem
      item={item}
      onPress={handlePressCard}
      formatDate={formatDate}
    />
  ), [handlePressCard, formatDate]);

  const renderEmptyState = () => {
    if (searchQuery.trim().length > 0) {
      return (
        <View style={styles.centerEmpty}>
          <MaterialIcons name="search-off" size={64} color="#ccc" style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>No Results</Text>
          <Text style={styles.emptySubtitle}>No cards match '{searchQuery}'.</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.centerEmpty}>
        <MaterialIcons name="contact-mail" size={64} color="#007bff" style={{ marginBottom: 15 }} />
        <Text style={styles.emptyTitle}>No cards yet.</Text>
        <Text style={styles.emptySubtitle}>Scan your first business card to get started!</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={handleScanFirstCard}>
          <Text style={styles.emptyButtonText}>Scan your first card</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Overlay to close FAB when tapping outside */}
      {isFabOpen && (
        <Pressable style={styles.overlay} onPress={() => setIsFabOpen(false)} />
      )}

      {/* Search Bar */}
      <View style={styles.searchBarContainer}>
        <MaterialIcons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search cards by name or company..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <MaterialIcons name="close" size={20} color="#888" />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => refresh()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <CardListSkeleton />
      ) : cards.length === 0 && !error ? (
        renderEmptyState()
      ) : (
        <FlashList
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
  centerEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 60,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    margin: 15,
    marginBottom: 5,
    paddingHorizontal: 10,
    height: 48,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 90,
  },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 13,
    color: '#6c757d',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardDate: {
    fontSize: 12,
    color: '#adb5bd',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#007bff',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
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
