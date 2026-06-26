import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useCard } from '../../../../hooks/useCard';
import { updateCard } from '../../../../lib/cardsApi';

export default function CardEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { card, loading: fetchingCard, error } = useCard(id as string);
  const router = useRouter();

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card) {
      setName(card.name || '');
      setTitle(card.title || '');
      setCompany(card.company || '');
      setAddress(card.address || '');
    }
  }, [card]);

  if (fetchingCard) {
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
        <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateCard(card.id, {
        name: name || null,
        title: title || null,
        company: company || null,
        address: address || null,
      });
      Alert.alert("Success", "Card updated successfully");
      router.back();
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Failed to update card";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Drawer.Screen options={{ title: card.name ? `Edit ${card.name}` : 'Edit Card' }} />
      <View style={styles.form}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />

        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" />

        <Text style={styles.label}>Company</Text>
        <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholder="Company" />

        <Text style={styles.label}>Address</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          value={address} 
          onChangeText={setAddress} 
          placeholder="Address" 
          multiline 
        />

        <Text style={styles.note}>
          Note: Emails, phones, and websites cannot be manually edited at this time.
        </Text>

        {saving ? (
          <ActivityIndicator size="large" />
        ) : (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={() => router.back()}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSave}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
          </View>
        )}
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
  form: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 8,
    marginBottom: 40,
  },
  label: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  note: {
    fontSize: 12,
    color: '#888',
    marginBottom: 20,
    fontStyle: 'italic',
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
  saveBtn: {
    backgroundColor: '#28a745',
  },
  cancelBtn: {
    backgroundColor: '#6c757d',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
