import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { getCompanyDetail, CompanyDetail, enrichCard } from '../../../lib/enrichmentApi';

export default function CompanyDetailScreen() {
  const { id, cardId } = useLocalSearchParams<{ id: string; cardId?: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchCompany = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCompanyDetail(id as string);
      setCompany(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch company details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCompany();
    }
  }, [id]);

  const handleRetry = async () => {
    const targetCardId = cardId || company?.card_id;
    if (!targetCardId) {
      Alert.alert("Retry Not Available", "We couldn't resolve the original business card for this company.");
      return;
    }
    try {
      setRetrying(true);
      setError(null);
      await enrichCard(targetCardId);
      
      // Temporarily mark status as pending in UI while it runs
      if (company) {
        setCompany({
          ...company,
          enrichment_status: 'pending',
          enrichment_error: null,
        });
      }

      // Poll company status until it is no longer pending using exponential backoff
      let currentDelay = 1000;      // Start with 1 second
      const maxPollDelay = 8000;    // Max backoff delay is 8 seconds
      let totalElapsed = 0;
      const maxPollDuration = 45000; // Timeout after 45 seconds
      
      let timeoutId: any = null;
      
      const poll = async () => {
        try {
          const updatedCompany = await getCompanyDetail(id as string);
          setCompany(updatedCompany);
          
          if (updatedCompany.enrichment_status !== 'pending') {
            return; // Stop polling since it completed or failed
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
        }
        
        totalElapsed += currentDelay;
        if (totalElapsed < maxPollDuration) {
          const nextDelay = currentDelay;
          currentDelay = Math.min(currentDelay * 2, maxPollDelay);
          timeoutId = setTimeout(poll, nextDelay);
        }
      };
      
      timeoutId = setTimeout(poll, currentDelay);

    } catch (err: any) {
      setError(err.message || 'Failed to trigger retry.');
    } finally {
      setRetrying(false);
    }
  };

  const handleOpenWebsite = async (url: string) => {
    try {
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = `https://${targetUrl}`;
      }
      await Linking.openURL(targetUrl);
    } catch {
      // Fail silently or show generic warning
    }
  };

  // State: Loading
  if (loading) {
    return (
      <View style={styles.container}>
        <Drawer.Screen options={{ title: 'Enriching...' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00E676" />
          <Text style={styles.loadingText}>Gathering company info...</Text>
        </View>
      </View>
    );
  }

  // State: Error or Enrichment status is Failed
  if (error || !company || company.enrichment_status === 'failed') {
    const targetCardId = cardId || company?.card_id;
    return (
      <View style={styles.container}>
        <Drawer.Screen options={{ title: 'No Information' }} />
        <View style={styles.center}>
          <MaterialIcons name="error-outline" size={54} color="#CF6679" style={{ marginBottom: 16 }} />
          <Text style={styles.errorText}>No company information found.</Text>
          {company?.enrichment_error ? (
            <Text style={styles.errorDetailsText}>{company.enrichment_error}</Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.btnBack} onPress={() => router.back()}>
              <Text style={styles.btnBackText}>Go Back</Text>
            </TouchableOpacity>

            {targetCardId ? (
              <TouchableOpacity 
                style={[styles.btnRetry, retrying && styles.btnDisabled]} 
                onPress={handleRetry}
                disabled={retrying}
              >
                {retrying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.btnRetryText}>Retry</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  // State: Pending
  if (company.enrichment_status === 'pending') {
    return (
      <View style={styles.container}>
        <Drawer.Screen options={{ title: 'Enriching...' }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00E676" />
          <Text style={styles.loadingText}>Gathering company info...</Text>
          <Text style={styles.subLoadingText}>Gemini is researching the web in real-time.</Text>
        </View>
      </View>
    );
  }

  // State: Completed
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Drawer.Screen options={{ title: company.name || 'Company Details' }} />
      
      {/* Header Profile Section */}
      <View style={styles.headerCard}>
        <View style={styles.logoPlaceholder}>
          <FontAwesome name="building" size={32} color="#00E676" />
        </View>
        <Text style={styles.companyName}>{company.name || '—'}</Text>
        
        {company.website ? (
          <TouchableOpacity 
            style={styles.websiteBtn} 
            onPress={() => company.website && handleOpenWebsite(company.website)}
          >
            <FontAwesome name="globe" size={14} color="#00E676" style={{ marginRight: 6 }} />
            <Text style={styles.websiteText}>{company.website}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.disabledWebsiteText}>No website listed</Text>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationContainer}>
          <FontAwesome name="map-marker" size={16} color="#B3B3B3" style={{ marginRight: 8 }} />
          <Text style={styles.locationText}>{company.location || '—'}</Text>
        </View>
      </View>

      {/* Products Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Products</Text>
        {company.products && company.products.length > 0 ? (
          company.products.map((prod, idx) => (
            <View key={idx} style={styles.listItem}>
              <View style={styles.bulletContainer}>
                <View style={styles.bullet} />
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{prod.name}</Text>
                {prod.description ? (
                  <Text style={styles.itemDesc}>{prod.description}</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>—</Text>
        )}
      </View>

      {/* Services Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Services</Text>
        {company.services && company.services.length > 0 ? (
          company.services.map((serv, idx) => (
            <View key={idx} style={styles.listItem}>
              <View style={styles.bulletContainer}>
                <View style={styles.bulletBlue} />
              </View>
              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{serv.name}</Text>
                {serv.description ? (
                  <Text style={styles.itemDesc}>{serv.description}</Text>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>—</Text>
        )}
      </View>

      {/* Technologies Section */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Technologies</Text>
        {company.technologies && company.technologies.length > 0 ? (
          <View style={styles.techContainer}>
            {company.technologies.map((tech, idx) => (
              <View key={idx} style={styles.techTag}>
                <Text style={styles.techText}>{tech}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>—</Text>
        )}
      </View>

      <TouchableOpacity style={styles.btnBackMain} onPress={() => router.back()}>
        <FontAwesome name="arrow-left" size={14} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.btnBackMainText}>Go Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214', // Premium dark theme
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
  },
  subLoadingText: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  errorText: {
    color: '#CF6679',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  btnBack: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  btnBackText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  headerCard: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  companyName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  websiteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  websiteText: {
    color: '#00E676',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledWebsiteText: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionCard: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#B3B3B3',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: '#E1E1E1',
    fontSize: 15,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  bulletContainer: {
    paddingTop: 6,
    marginRight: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E676',
  },
  bulletBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00B0FF',
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    color: '#E1E1E1',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  itemDesc: {
    color: '#8E8E93',
    fontSize: 13,
    lineHeight: 18,
  },
  techContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  techTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  techText: {
    color: '#E1E1E1',
    fontSize: 13,
    fontWeight: '500',
  },
  emptyText: {
    color: '#636366',
    fontSize: 15,
    fontWeight: '500',
  },
  btnBackMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
  },
  btnBackMainText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
  },
  btnRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E676',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  btnRetryText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  errorDetailsText: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
    lineHeight: 18,
  },
});
