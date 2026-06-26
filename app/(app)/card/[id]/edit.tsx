import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useCard } from '../../../../hooks/useCard';
import { updateCard } from '../../../../lib/cardsApi';
import { MaterialIcons } from '@expo/vector-icons';
import { trackEvent } from '../../../../lib/analytics';
import { mutationState } from '../../../../lib/mutationState';

interface ListFieldProps {
  label: string;
  items: string[];
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  errors?: string[];
  onAdd: () => void;
  onUpdate: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}

function ListField({
  label,
  items,
  placeholder,
  keyboardType = 'default',
  errors,
  onAdd,
  onUpdate,
  onRemove,
}: ListFieldProps) {
  return (
    <View style={styles.listFieldContainer}>
      <View style={styles.listHeaderRow}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity style={styles.btnAdd} onPress={onAdd}>
          <MaterialIcons name="add" size={18} color="#007bff" />
          <Text style={styles.btnAddText}>Add</Text>
        </TouchableOpacity>
      </View>
      
      {items.map((item, index) => (
        <View key={index} style={{ marginBottom: 10 }}>
          <View style={styles.listItemRow}>
            <TextInput
              style={[styles.input, errors?.[index] ? styles.inputError : null]}
              value={item}
              onChangeText={(text) => onUpdate(index, text)}
              placeholder={placeholder}
              keyboardType={keyboardType}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.btnRemove} onPress={() => onRemove(index)}>
              <MaterialIcons name="delete-outline" size={24} color="#dc3545" />
            </TouchableOpacity>
          </View>
          {errors?.[index] ? (
            <Text style={styles.errorLabel}>{errors[index]}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export default function CardEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { card, loading: fetchingCard, error } = useCard(id as string);
  const router = useRouter();

  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [phones, setPhones] = useState<string[]>([]);
  const [websites, setWebsites] = useState<string[]>([]);
  
  const [saving, setSaving] = useState(false);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);

  // Pre-populate fields
  useEffect(() => {
    if (card) {
      setName(card.name || '');
      setTitle(card.title || '');
      setCompany(card.company || '');
      setAddress(card.address || '');
      setEmails(card.emails || []);
      setPhones(card.phones || []);
      setWebsites(card.websites || []);
      setEmailErrors(new Array((card.emails || []).length).fill(''));
    }
  }, [card]);

  // List field helpers
  const handleAddEmail = () => {
    setEmails([...emails, '']);
    setEmailErrors([...emailErrors, '']);
  };
  const handleUpdateEmail = (index: number, val: string) => {
    const next = [...emails];
    next[index] = val;
    setEmails(next);
    if (emailErrors[index]) {
      const nextErrors = [...emailErrors];
      nextErrors[index] = '';
      setEmailErrors(nextErrors);
    }
  };
  const handleRemoveEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
    setEmailErrors(emailErrors.filter((_, i) => i !== index));
  };

  const handleAddPhone = () => setPhones([...phones, '']);
  const handleUpdatePhone = (index: number, val: string) => {
    const next = [...phones];
    next[index] = val;
    setPhones(next);
  };
  const handleRemovePhone = (index: number) => setPhones(phones.filter((_, i) => i !== index));

  const handleAddWebsite = () => setWebsites([...websites, '']);
  const handleUpdateWebsite = (index: number, val: string) => {
    const next = [...websites];
    next[index] = val;
    setWebsites(next);
  };
  const handleRemoveWebsite = (index: number) => setWebsites(websites.filter((_, i) => i !== index));

  const isFormDirty = () => {
    if (!card) return false;
    const currentName = name.trim();
    const currentTitle = title.trim();
    const currentCompany = company.trim();
    const currentAddress = address.trim();

    if (currentName !== (card.name || '')) return true;
    if (currentTitle !== (card.title || '')) return true;
    if (currentCompany !== (card.company || '')) return true;
    if (currentAddress !== (card.address || '')) return true;

    const filteredEmails = emails.map(e => e.trim()).filter(Boolean);
    const originalEmails = card.emails || [];
    if (JSON.stringify(filteredEmails) !== JSON.stringify(originalEmails)) return true;

    const filteredPhones = phones.map(p => p.trim()).filter(Boolean);
    const originalPhones = card.phones || [];
    if (JSON.stringify(filteredPhones) !== JSON.stringify(originalPhones)) return true;

    const filteredWebsites = websites.map(w => w.trim()).filter(Boolean);
    const originalWebsites = card.websites || [];
    if (JSON.stringify(filteredWebsites) !== JSON.stringify(originalWebsites)) return true;

    return false;
  };

  const handleCancel = () => {
    if (isFormDirty()) {
      Alert.alert(
        "Discard Changes",
        "Are you sure you want to discard your edits?",
        [
          { text: "Keep Editing", style: "cancel" },
          { 
            text: "Discard", 
            style: "destructive", 
            onPress: () => router.back() 
          }
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!card) return;

    setEmailErrors([]);
    let hasValidationError = false;

    const trimmedName = name.trim();
    const trimmedTitle = title.trim();
    const trimmedCompany = company.trim();
    const trimmedAddress = address.trim();

    const filteredEmails = emails.map(e => e.trim()).filter(Boolean);
    const originalEmails = card.emails || [];

    // Validate email formats
    const newEmailErrors = emails.map((email) => {
      const trimmed = email.trim();
      if (trimmed) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmed)) {
          hasValidationError = true;
          return 'Invalid email format.';
        }
      }
      return '';
    });
    setEmailErrors(newEmailErrors);

    if (hasValidationError) return;

    const patchPayload: any = {};
    if (trimmedName !== (card.name || '')) patchPayload.name = trimmedName || null;
    if (trimmedTitle !== (card.title || '')) patchPayload.title = trimmedTitle || null;
    if (trimmedCompany !== (card.company || '')) patchPayload.company = trimmedCompany || null;
    if (trimmedAddress !== (card.address || '')) patchPayload.address = trimmedAddress || null;

    if (JSON.stringify(filteredEmails) !== JSON.stringify(originalEmails)) {
      patchPayload.emails = filteredEmails;
    }

    const filteredPhones = phones.map(p => p.trim()).filter(Boolean);
    const originalPhones = card.phones || [];
    if (JSON.stringify(filteredPhones) !== JSON.stringify(originalPhones)) {
      patchPayload.phones = filteredPhones;
    }

    const filteredWebsites = websites.map(w => w.trim()).filter(Boolean);
    const originalWebsites = card.websites || [];
    if (JSON.stringify(filteredWebsites) !== JSON.stringify(originalWebsites)) {
      patchPayload.websites = filteredWebsites;
    }

    if (Object.keys(patchPayload).length === 0) {
      Alert.alert("Notice", "No changes were made.");
      router.back();
      return;
    }

    try {
      setSaving(true);
      await updateCard(card.id, patchPayload);
      mutationState.hasMutated = true;
      trackEvent('card_edited');
      Alert.alert("Success", "Card updated successfully.");
      router.back();
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.detail || err.message || "Failed to update card";
      Alert.alert("Error", message);
    } finally {
      setSaving(false);
    }
  };

  if (fetchingCard) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  if (error || !card) {
    return (
      <View style={styles.center}>
        <Drawer.Screen options={{ title: 'Error' }} />
        <MaterialIcons name="error-outline" size={48} color="#dc3545" style={{ marginBottom: 15 }} />
        <Text style={styles.errorText}>{error || 'Card not found.'}</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.btnBack}>
          <Text style={styles.btnBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Drawer.Screen options={{ title: card.name ? `Edit ${card.name}` : 'Edit Card' }} />
      
      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Name" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Company</Text>
          <TextInput style={styles.input} value={company} onChangeText={setCompany} placeholder="Company" />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput 
            style={[styles.input, styles.multilineInput]} 
            value={address} 
            onChangeText={setAddress} 
            placeholder="Address" 
            multiline 
          />
        </View>

        <ListField
          label="Emails"
          items={emails}
          placeholder="Email address"
          keyboardType="email-address"
          errors={emailErrors}
          onAdd={handleAddEmail}
          onUpdate={handleUpdateEmail}
          onRemove={handleRemoveEmail}
        />

        <ListField
          label="Phones"
          items={phones}
          placeholder="Phone number"
          keyboardType="phone-pad"
          onAdd={handleAddPhone}
          onUpdate={handleUpdatePhone}
          onRemove={handleRemovePhone}
        />

        <ListField
          label="Websites"
          items={websites}
          placeholder="Website URL"
          keyboardType="url"
          onAdd={handleAddWebsite}
          onUpdate={handleUpdateWebsite}
          onRemove={handleRemoveWebsite}
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity 
          style={[styles.btn, styles.cancelBtn]} 
          onPress={handleCancel}
          disabled={saving}
        >
          <Text style={styles.btnText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.btn, styles.saveBtn, saving && styles.btnDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          <View style={styles.saveBtnContent}>
            {saving && <ActivityIndicator size="small" color="#fff" style={styles.inlineSpinner} />}
            <Text style={styles.btnText}>Save</Text>
          </View>
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
  form: {
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
  fieldGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#212529',
    backgroundColor: '#fff',
    flex: 1,
  },
  inputError: {
    borderColor: '#dc3545',
  },
  errorLabel: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  listFieldContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
    paddingTop: 15,
    marginBottom: 10,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  btnAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnAddText: {
    color: '#007bff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  btnRemove: {
    padding: 5,
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
  },
  btnDisabled: {
    backgroundColor: '#a2a8b3',
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inlineSpinner: {
    marginRight: 4,
  }
});
