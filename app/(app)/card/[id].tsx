import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useCard } from '../../../hooks/useCard';
import { deleteCard } from '../../../lib/cardsApi';
import { MaterialIcons } from '@expo/vector-icons';
import { CardDetailSkeleton } from '../../../components/Skeleton';
import { trackEvent } from '../../../lib/analytics';
import { mutationState } from '../../../lib/mutationState';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { card, loading, error, refresh } = useCard(id as string);
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

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
      <Drawer.Screen options={{ title: card.name || 'Card Details' }} />
      
      <View style={styles.cardInfo}>
        <View style={styles.infoGroup}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{card.name || '—'}</Text>
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.label}>Title</Text>
          <Text style={styles.value}>{card.title || '—'}</Text>
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.label}>Company</Text>
          <Text style={styles.value}>{card.company || '—'}</Text>
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{card.address || '—'}</Text>
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.label}>Emails</Text>
          {card.emails && card.emails.length > 0 ? (
            card.emails.map((email, idx) => <Text key={idx} style={styles.value}>{email}</Text>)
          ) : <Text style={styles.value}>None</Text>}
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.label}>Phones</Text>
          {card.phones && card.phones.length > 0 ? (
            card.phones.map((phone, idx) => <Text key={idx} style={styles.value}>{phone}</Text>)
          ) : <Text style={styles.value}>None</Text>}
        </View>

        <View style={styles.infoGroup}>
          <Text style={styles.label}>Websites</Text>
          {card.websites && card.websites.length > 0 ? (
            card.websites.map((web, idx) => <Text key={idx} style={styles.value}>{web}</Text>)
          ) : <Text style={styles.value}>None</Text>}
        </View>

        <View style={styles.metaSection}>
          <Text style={styles.metaText}>Created: {formatDate(card.created_at)}</Text>
          <Text style={styles.metaText}>Updated: {formatDate(card.updated_at)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.btn, styles.editBtn]} 
          onPress={() => router.push(`/(app)/card/${card.id}/edit`)}
          disabled={isDeleting}
        >
          <Text style={styles.btnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.btn, styles.delBtn]} 
          onPress={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.btnText}>Delete</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  cardInfo: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  infoGroup: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    paddingBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#868e96',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#212529',
    fontWeight: '500',
  },
  metaSection: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
    paddingTop: 15,
  },
  metaText: {
    fontSize: 12,
    color: '#adb5bd',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: '500',
    marginBottom: 20,
  },
  btnBack: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnBackText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  actions: {
    flexDirection: 'row',
    gap: 15,
  },
  btn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtn: {
    backgroundColor: '#007bff',
  },
  delBtn: {
    backgroundColor: '#dc3545',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
