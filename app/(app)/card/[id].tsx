import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Button } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useCard } from '../../../hooks/useCard';
import { deleteCard } from '../../../lib/cardsApi';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { card, loading, error } = useCard(id as string);
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !card) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: 'Error' }} />
        <Text style={styles.errorText}>{error || 'Card not found.'}</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

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
              await deleteCard(card.id);
              Alert.alert("Success", "Card deleted");
              router.replace('/(app)/dashboard');
            } catch (err: any) {
              const message = err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Failed to delete card";
              Alert.alert("Error", message);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Drawer.Screen options={{ title: card.name || 'Unknown' }} />
      <View style={styles.cardInfo}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{card.name || 'N/A'}</Text>

        <Text style={styles.label}>Title</Text>
        <Text style={styles.value}>{card.title || 'N/A'}</Text>

        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>{card.company || 'N/A'}</Text>

        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>{card.address || 'N/A'}</Text>

        <Text style={styles.label}>Emails</Text>
        {card.emails && card.emails.length > 0 ? (
          card.emails.map((email, idx) => <Text key={idx} style={styles.value}>{email}</Text>)
        ) : <Text style={styles.value}>N/A</Text>}

        <Text style={styles.label}>Phones</Text>
        {card.phones && card.phones.length > 0 ? (
          card.phones.map((phone, idx) => <Text key={idx} style={styles.value}>{phone}</Text>)
        ) : <Text style={styles.value}>N/A</Text>}

        <Text style={styles.label}>Websites</Text>
        {card.websites && card.websites.length > 0 ? (
          card.websites.map((web, idx) => <Text key={idx} style={styles.value}>{web}</Text>)
        ) : <Text style={styles.value}>N/A</Text>}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.editBtn]} onPress={() => router.push(`/(app)/card/${card.id}/edit`)}>
          <Text style={styles.btnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.delBtn]} onPress={handleDelete}>
          <Text style={styles.btnText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardInfo: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginTop: 10,
    marginBottom: 2,
  },
  value: {
    fontSize: 18,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: 'red',
    marginBottom: 15,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btn: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
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
