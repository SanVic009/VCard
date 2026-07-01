import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Pressable, TextInput, Modal, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { CardResponse, deleteCard } from '../../lib/cardsApi';
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
  onLongPress?: (id: string) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  formatDate: (dateStr: string) => string;
}

const CardItem = React.memo(({ item, onPress, onLongPress, isSelectMode, isSelected, formatDate }: CardItemProps) => {
  return (
    <TouchableOpacity
      style={[styles.cardItem, isSelected && styles.cardItemSelected]}
      onPress={() => onPress(item.id)}
      onLongPress={() => onLongPress && onLongPress(item.id)}
      activeOpacity={0.7}
    >
      {isSelectMode && (
        <View style={styles.checkboxContainer}>
          <MaterialIcons
            name={isSelected ? "check-box" : "check-box-outline-blank"}
            size={24}
            color={isSelected ? "#2E1028" : "#6B6B6B"}
          />
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name || 'Unknown Name'}</Text>
        <Text style={styles.cardCompany}>{item.company || 'Unknown Company'}</Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
        {!isSelectMode && <MaterialIcons name="chevron-right" size={20} color="#6B7280" />}
      </View>
    </TouchableOpacity>
  );
});

export default function DashboardScreen() {
  const router = useRouter();
  const { cards, loading, error, refresh } = useCards();
  const { setSelectedImages } = useImageContext();
  const [refreshing, setRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // Multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Sort and Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [sortBy, setSortBy] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'company_asc' | 'company_desc'>('created_desc');
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasWebsite, setFilterHasWebsite] = useState(false);

  const filterActive = filterHasPhone || filterHasEmail || filterHasWebsite;

  const resetFilters = () => {
    setSortBy('created_desc');
    setFilterHasPhone(false);
    setFilterHasEmail(false);
    setFilterHasWebsite(false);
  };

  const processedCards = React.useMemo(() => {
    let result = [...cards];

    // Apply Client-Side Filters
    if (filterHasPhone) {
      result = result.filter(c => c.phones && c.phones.length > 0);
    }
    if (filterHasEmail) {
      result = result.filter(c => c.emails && c.emails.length > 0);
    }
    if (filterHasWebsite) {
      result = result.filter(c => c.websites && c.websites.length > 0);
    }

    // Apply Client-Side Sorting
    result.sort((a, b) => {
      if (sortBy === 'created_desc') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'created_asc') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortBy === 'name_asc') {
        const valA = (a.name || '').trim();
        const valB = (b.name || '').trim();
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;
        return valA.localeCompare(valB);
      }
      if (sortBy === 'name_desc') {
        const valA = (a.name || '').trim();
        const valB = (b.name || '').trim();
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;
        return valB.localeCompare(valA);
      }
      if (sortBy === 'company_asc') {
        const valA = (a.company || '').trim();
        const valB = (b.company || '').trim();
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;
        return valA.localeCompare(valB);
      }
      if (sortBy === 'company_desc') {
        const valA = (a.company || '').trim();
        const valB = (b.company || '').trim();
        if (!valA && valB) return 1;
        if (valA && !valB) return -1;
        if (!valA && !valB) return 0;
        return valB.localeCompare(valA);
      }
      return 0;
    });

    return result;
  }, [cards, sortBy, filterHasPhone, filterHasEmail, filterHasWebsite]);

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
      const assetsToProcess = result.assets.slice(0, 2);
      const processedImages = await Promise.all(
        assetsToProcess.map(asset => processImage(asset.uri))
      );
      
      setSelectedImages(processedImages);
      router.push('/(app)/review');
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

    const result1 = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    
    if (result1.canceled || !result1.assets || result1.assets.length === 0) {
      return;
    }

    await handleImageResult(result1);
  };

  const openGallery = async () => {
    setIsFabOpen(false);
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 2,
      allowsEditing: false,
      quality: 1,
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
    if (isSelectMode) {
      setSelectedCardIds(prev => 
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
      );
    } else {
      router.push(`/(app)/card/${id}`);
    }
  }, [isSelectMode, router]);

  const handleLongPressCard = useCallback((id: string) => {
    if (!isSelectMode) {
      setIsSelectMode(true);
      setSelectedCardIds([id]);
    }
  }, [isSelectMode]);

  const handleCancelSelectMode = () => {
    setIsSelectMode(false);
    setSelectedCardIds([]);
  };

  const handleSelectAll = () => {
    if (selectedCardIds.length === processedCards.length) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(processedCards.map(c => c.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedCardIds.length === 0) return;
    
    Alert.alert(
      "Delete Cards",
      `Are you sure you want to delete the ${selectedCardIds.length} selected card(s)? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessing(true);
              // Delete all in parallel
              await Promise.all(selectedCardIds.map(id => deleteCard(id)));
              // Refresh cards list
              await refresh(true);
              // Reset select mode
              setIsSelectMode(false);
              setSelectedCardIds([]);
              Alert.alert("Success", "Selected card(s) have been deleted.");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete selected card(s).");
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = useCallback(({ item }: { item: CardResponse }) => (
    <CardItem
      item={item}
      onPress={handlePressCard}
      onLongPress={handleLongPressCard}
      isSelectMode={isSelectMode}
      isSelected={selectedCardIds.includes(item.id)}
      formatDate={formatDate}
    />
  ), [handlePressCard, handleLongPressCard, isSelectMode, selectedCardIds, formatDate]);

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
    if (filterActive) {
      return (
        <View style={styles.centerEmpty}>
          <MaterialIcons name="filter-list-off" size={64} color="#ccc" style={{ marginBottom: 10 }} />
          <Text style={styles.emptyTitle}>No Matching Cards</Text>
          <Text style={styles.emptySubtitle}>Try loosening your filter settings.</Text>
          <TouchableOpacity style={styles.clearFilterButton} onPress={resetFilters}>
            <Text style={styles.clearFilterButtonText}>Reset Filters</Text>
          </TouchableOpacity>
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

      {/* Search and Sort/Filter Row or Selection Action Bar */}
      {isSelectMode ? (
        <View style={styles.selectActionBar}>
          <View style={styles.selectActionLeft}>
            <TouchableOpacity onPress={handleCancelSelectMode} style={styles.selectActionBtn}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.selectCountText}>{selectedCardIds.length} selected</Text>
          </View>
          <View style={styles.selectActionRight}>
            <TouchableOpacity onPress={handleSelectAll} style={styles.selectAllBtn}>
              <Text style={styles.selectAllBtnText}>
                {selectedCardIds.length === processedCards.length ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleDeleteSelected} 
              style={[styles.deleteBtn, selectedCardIds.length === 0 && styles.deleteBtnDisabled]}
              disabled={selectedCardIds.length === 0}
            >
              <MaterialIcons name="delete" size={24} color={selectedCardIds.length === 0 ? "#adb5bd" : "#dc3545"} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.searchRow}>
          <View style={styles.searchBarContainer}>
            <MaterialIcons name="search" size={20} color="#2E1028" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search name or company..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <MaterialIcons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterButton, (filterActive || sortBy !== 'created_desc') && styles.filterButtonActive]} 
            onPress={() => setShowFilterModal(true)}
            accessibilityLabel="Sort and filter cards"
          >
            <MaterialIcons 
              name="tune" 
              size={22} 
              color="#2E1028" 
            />
          </TouchableOpacity>
        </View>
      )}

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
      ) : processedCards.length === 0 && !error ? (
        renderEmptyState()
      ) : (
        <FlashList
          data={processedCards}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* Speed Dial Actions */}
      {!isSelectMode && isFabOpen && !isProcessing && (
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
      {!isSelectMode && (
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
      )}

      {/* Sort & Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort & Filter</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Sort Section */}
              <Text style={styles.sectionTitle}>Sort By</Text>
              
              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setSortBy('created_desc')}
              >
                <Text style={[styles.optionText, sortBy === 'created_desc' && styles.optionTextActive]}>
                  Created Date (Newest first)
                </Text>
                {sortBy === 'created_desc' && <MaterialIcons name="check" size={20} color="#2E1028" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setSortBy('created_asc')}
              >
                <Text style={[styles.optionText, sortBy === 'created_asc' && styles.optionTextActive]}>
                  Created Date (Oldest first)
                </Text>
                {sortBy === 'created_asc' && <MaterialIcons name="check" size={20} color="#2E1028" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setSortBy('name_asc')}
              >
                <Text style={[styles.optionText, sortBy === 'name_asc' && styles.optionTextActive]}>
                  Name (A - Z)
                </Text>
                {sortBy === 'name_asc' && <MaterialIcons name="check" size={20} color="#2E1028" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setSortBy('name_desc')}
              >
                <Text style={[styles.optionText, sortBy === 'name_desc' && styles.optionTextActive]}>
                  Name (Z - A)
                </Text>
                {sortBy === 'name_desc' && <MaterialIcons name="check" size={20} color="#2E1028" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setSortBy('company_asc')}
              >
                <Text style={[styles.optionText, sortBy === 'company_asc' && styles.optionTextActive]}>
                  Company (A - Z)
                </Text>
                {sortBy === 'company_asc' && <MaterialIcons name="check" size={20} color="#2E1028" />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setSortBy('company_desc')}
              >
                <Text style={[styles.optionText, sortBy === 'company_desc' && styles.optionTextActive]}>
                  Company (Z - A)
                </Text>
                {sortBy === 'company_desc' && <MaterialIcons name="check" size={20} color="#2E1028" />}
              </TouchableOpacity>

              {/* Filter Section */}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Filter By Fields</Text>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setFilterHasPhone(!filterHasPhone)}
              >
                <Text style={[styles.optionText, filterHasPhone && styles.optionTextActive]}>
                  Has Phone Number
                </Text>
                <MaterialIcons 
                  name={filterHasPhone ? "check-box" : "check-box-outline-blank"} 
                  size={20} 
                  color={filterHasPhone ? "#2E1028" : "#6B6B6B"} 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setFilterHasEmail(!filterHasEmail)}
              >
                <Text style={[styles.optionText, filterHasEmail && styles.optionTextActive]}>
                  Has Email
                </Text>
                <MaterialIcons 
                  name={filterHasEmail ? "check-box" : "check-box-outline-blank"} 
                  size={20} 
                  color={filterHasEmail ? "#2E1028" : "#6B6B6B"} 
                />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.optionRow} 
                onPress={() => setFilterHasWebsite(!filterHasWebsite)}
              >
                <Text style={[styles.optionText, filterHasWebsite && styles.optionTextActive]}>
                  Has Website
                </Text>
                <MaterialIcons 
                  name={filterHasWebsite ? "check-box" : "check-box-outline-blank"} 
                  size={20} 
                  color={filterHasWebsite ? "#2E1028" : "#6B6B6B"} 
                />
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
                <Text style={styles.resetBtnText}>Reset All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilterModal(false)}>
                <Text style={styles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3E4DD',
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 5,
    gap: 10,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#2E1028',
    borderWidth: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: '#1A1A1A',
  },
  clearButton: {
    padding: 5,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 35,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
    paddingBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  modalScroll: {
    marginVertical: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  optionText: {
    fontSize: 15,
    color: '#6B7280',
  },
  optionTextActive: {
    color: '#2E1028',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#6B6B6B',
  },
  applyBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#2E1028',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  clearFilterButton: {
    marginTop: 15,
    backgroundColor: '#2E1028',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  clearFilterButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  cardInfo: {
    flex: 1,
    marginRight: 10,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardDate: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#2E1028',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 1,
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
    color: '#DC2626',
    marginBottom: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2E1028',
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
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  fabSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
  },
  cameraFab: {
    backgroundColor: '#2E1028',
  },
  galleryFab: {
    backgroundColor: '#6B6B6B',
  },
  fab: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    right: 20,
    bottom: 20,
    backgroundColor: '#2E1028',
    borderRadius: 30,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    zIndex: 2,
  },
  fabOpen: {
    backgroundColor: '#DC2626',
  },
  selectActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  selectActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectActionBtn: {
    padding: 4,
  },
  selectCountText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  selectAllBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f1f3f5',
  },
  selectAllBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E1028',
  },
  deleteBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnDisabled: {
    opacity: 0.5,
  },
  cardItemSelected: {
    backgroundColor: '#F5F5F0',
    borderColor: '#2E1028',
    borderWidth: 1,
  },
  checkboxContainer: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
