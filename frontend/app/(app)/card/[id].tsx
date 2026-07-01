import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useCard } from '../../../hooks/useCard';
import { deleteCard } from '../../../lib/cardsApi';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { CardDetailSkeleton } from '../../../components/Skeleton';
import { trackEvent } from '../../../lib/analytics';
import { mutationState } from '../../../lib/mutationState';
import * as Linking from 'expo-linking';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { card, loading, error, refresh } = useCard(id as string);
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const isFirstMount = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!card || card.company_id) return;

    let currentDelay = 2000;      // Start with 2 seconds
    const maxDelay = 10000;       // Max backoff delay is 10 seconds
    const maxDuration = 45000;    // Timeout after 45 seconds
    let elapsed = 0;
    let timeoutId: any = null;

    const poll = async () => {
      try {
        await refresh();
      } catch (err: any) {
        console.error("Failed to poll card update:", err);
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          return; // Stop polling immediately
        }
      }

      elapsed += currentDelay;
      if (elapsed < maxDuration) {
        const nextDelay = currentDelay;
        currentDelay = Math.min(currentDelay * 2, maxDelay);
        timeoutId = setTimeout(poll, nextDelay);
      }
    };

    timeoutId = setTimeout(poll, currentDelay);
    return () => clearTimeout(timeoutId);
  }, [card?.id, card?.company_id, refresh]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleCall = async (phone: string) => {
    try {
      const cleaned = phone.replace(/[^\d+]/g, '');
      const url = `tel:${cleaned}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Error", "Could not open call. Please try manually.");
      }
    } catch {
      Alert.alert("Error", "Could not open call. Please try manually.");
    }
  };

  const handleSMS = async (phone: string) => {
    try {
      const cleaned = phone.replace(/[^\d+]/g, '');
      const url = `sms:${cleaned}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open SMS. Please try manually.");
    }
  };

  const handleWhatsApp = async (phone: string) => {
    try {
      const digitsOnly = phone.replace(/\D/g, '');
      const url = `whatsapp://send?phone=${digitsOnly}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("WhatsApp is not installed.");
      }
    } catch {
      Alert.alert("Error", "Could not open WhatsApp. Please try manually.");
    }
  };

  const handleEmail = async (email: string) => {
    try {
      const url = `mailto:${email}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open email. Please try manually.");
    }
  };

  const handleWebsite = async (url: string) => {
    try {
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }
      await Linking.openURL(targetUrl);
    } catch {
      Alert.alert("Error", "Could not open website. Please try manually.");
    }
  };

  const handleAddress = async (address: string) => {
    try {
      const companyPart = card?.company && card.company !== '—' ? `${card.company}, ` : '';
      const query = `${companyPart}${address}`;
      const url = `geo:0,0?q=${encodeURIComponent(query)}`;
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open maps. Please try manually.");
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Card",
      "Are you sure you want to delete this card?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteCard(id as string);
              mutationState.hasMutated = true;
              trackEvent('card_deleted');
              Alert.alert("Success", "Card deleted successfully.");
              router.replace('/(app)/dashboard');
            } catch (err: any) {
              const message = err.message || "Failed to delete card";
              Alert.alert("Error", message);
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Drawer.Screen options={{ title: 'Loading...' }} />
        <View style={styles.content}>
          <CardDetailSkeleton />
        </View>
      </View>
    );
  }

  if (error || !card) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: 'Error' }} />
        <MaterialIcons name="error-outline" size={48} color="#dc3545" style={{ marginBottom: 15 }} />
        <Text style={styles.errorText}>Card not found.</Text>
        <TouchableOpacity style={styles.btnBack} onPress={() => router.back()}>
          <Text style={styles.btnBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Drawer.Screen 
        options={{ 
          title: card.name || 'Card Details',
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <TouchableOpacity 
                onPress={() => router.push(`/(app)/card/${card.id}/edit`)} 
                style={styles.headerRightBtn}
                disabled={isDeleting}
                accessibilityLabel="Edit card"
              >
                <MaterialIcons name="edit" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleDelete} 
                style={styles.headerRightBtn}
                disabled={isDeleting}
                accessibilityLabel="Delete card"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#DC2626" />
                ) : (
                  <MaterialIcons name="delete" size={24} color="#DC2626" />
                )}
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      
      {/* Top Section Contact Card */}
      <View style={styles.topCard}>
        <Text style={styles.topName}>{card.name || '—'}</Text>
        <Text style={styles.topTitle}>{card.title || '—'}</Text>
        {card.company ? (
          <TouchableOpacity 
            onPress={() => card.company_id && router.push(`/(app)/company/${card.company_id}?cardId=${card.id}` as any)}
            disabled={!card.company_id}
            activeOpacity={card.company_id ? 0.7 : 1}
          >
            <Text style={[styles.topCompany, card.company_id ? styles.topCompanyLink : null]}>
              {card.company}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.topCompany}>—</Text>
        )}

        {card.company_id ? (
          <TouchableOpacity 
            style={styles.fullWidthCompanyBtn} 
            onPress={() => router.push(`/(app)/company/${card.company_id}?cardId=${card.id}` as any)}
          >
            <FontAwesome name="building" size={16} color="#2E1028" style={{ marginRight: 8 }} />
            <Text style={styles.fullWidthCompanyBtnText}>View Company Details</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Address Section */}
      {card.address && card.address !== '—' ? (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Address</Text>
          <View style={styles.itemCard}>
            <Text style={styles.itemValue}>{card.address}</Text>
            <TouchableOpacity 
              style={styles.circleActionButton} 
              onPress={() => card.address && handleAddress(card.address)}
              accessibilityLabel="Open in Maps"
            >
              <FontAwesome name="map-marker" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Emails Section */}
      {card.emails && card.emails.length > 0 ? (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Emails</Text>
          {card.emails.map((email, idx) => (
            <View key={idx} style={styles.itemCard}>
              <Text style={styles.itemValue}>{email}</Text>
              <TouchableOpacity 
                style={styles.circleActionButton} 
                onPress={() => handleEmail(email)}
                accessibilityLabel="Send email"
              >
                <FontAwesome name="envelope" size={16} color="#E0A800" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {/* Phones Section */}
      {card.phones && card.phones.length > 0 ? (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Phones</Text>
          {card.phones.map((phone, idx) => (
            <View key={idx} style={styles.itemCard}>
              <Text style={styles.itemValue}>{phone}</Text>
              <View style={styles.inlineActionButtons}>
                <TouchableOpacity 
                  style={styles.circleActionButton} 
                  onPress={() => handleCall(phone)}
                  accessibilityLabel="Call phone number"
                >
                  <FontAwesome name="phone" size={18} color="#2E1028" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.circleActionButton} 
                  onPress={() => handleSMS(phone)}
                  accessibilityLabel="Send SMS"
                >
                  <FontAwesome name="comment" size={18} color="#6FAC39" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.circleActionButton} 
                  onPress={() => handleWhatsApp(phone)}
                  accessibilityLabel="Chat on WhatsApp"
                >
                  <FontAwesome name="whatsapp" size={20} color="#25D366" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Websites Section */}
      {card.websites && card.websites.length > 0 ? (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Websites</Text>
          {card.websites.map((web, idx) => (
            <View key={idx} style={styles.itemCard}>
              <Text style={styles.itemValue}>{web}</Text>
              <TouchableOpacity 
                style={styles.circleActionButton} 
                onPress={() => handleWebsite(web)}
                accessibilityLabel="Open website"
              >
                <FontAwesome name="globe" size={18} color="#17a2b8" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.metaSection}>
        <Text style={styles.metaText}>Created: {formatDate(card.created_at)}</Text>
        <Text style={styles.metaText}>Updated: {formatDate(card.updated_at)}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3E4DD',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E3E4DD',
  },
  topCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  topName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  topTitle: {
    fontSize: 15,
    color: '#6B6B6B',
    marginBottom: 6,
  },
  topCompany: {
    fontSize: 16,
    color: '#6B6B6B',
    fontWeight: '600',
    marginBottom: 12,
  },
  topCompanyLink: {
    color: '#2E1028',
  },
  fullWidthCompanyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F0',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    marginTop: 8,
  },
  fullWidthCompanyBtnText: {
    color: '#2E1028',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E1028',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  itemValue: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: 'normal',
    flex: 1,
    marginRight: 10,
  },
  inlineActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleActionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#F5F5F0',
  },
  metaSection: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#D1D5DB',
    paddingTop: 15,
  },
  metaText: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '500',
    marginBottom: 20,
  },
  btnBack: {
    backgroundColor: '#2E1028',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnBackText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    gap: 15,
  },
  headerRightBtn: {
    padding: 5,
  }
});
