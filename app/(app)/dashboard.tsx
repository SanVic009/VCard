import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { createCard, CardResponse } from '../../lib/cardsApi';
import { useCards } from '../../hooks/useCards';

export default function DashboardScreen() {
  const router = useRouter();
  const { cards, loading, error, refresh } = useCards();
  const [refreshing, setRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // Silently refresh the list every time the dashboard comes into focus
      refresh(true);
    }, [refresh])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleCreateTestCard = async () => {
    try {
      setIsCreating(true);
      await createCard({
        name: "John Doe",
        title: "Engineer",
        company: "Google",
        emails: ["john@google.com"],
        phones: ["+1234567890"],
        websites: ["google.com"]
      });
      Alert.alert("Success", "Card created");
      await refresh();
    } catch (error: any) {
      const message = error.response?.data?.error?.message || error.response?.data?.detail || error.message || "Failed to create card";
      Alert.alert("Error", message);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading && !refreshing && !isCreating) {
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
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={styles.retryButton}>
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

      <TouchableOpacity 
        style={styles.fab} 
        onPress={handleCreateTestCard}
        disabled={isCreating}
      >
        {isCreating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <MaterialIcons name="add" size={24} color="#fff" />
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContainer: {
    padding: 15,
    paddingBottom: 80, // Space for FAB
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
  },
});
