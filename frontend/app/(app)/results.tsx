import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useImageContext } from '../../context/ImageContext';
import * as FileSystem from 'expo-file-system/legacy';
import { extractBusinessCard, ExtractionData } from '../../lib/extractionApi';
import { createCard } from '../../lib/cardsApi';
import { MaterialIcons } from '@expo/vector-icons';
import { trackEvent } from '../../lib/analytics';
import { mutationState } from '../../lib/mutationState';
import { enrichCard } from '../../lib/enrichmentApi';
import { useToast } from '../../context/ToastContext';


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

export default function ResultsScreen() {
  const router = useRouter();
  const { pollEnrichmentStatus } = useToast();
  const { selectedImages, clearSelectedImages } = useImageContext();

  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractionData | null>(null);


  // Editable form fields state
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [phones, setPhones] = useState<string[]>([]);
  const [websites, setWebsites] = useState<string[]>([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);

  // Emails helpers
  const handleAddEmail = () => {
    setEmails([...emails, '']);
    setEmailErrors([...emailErrors, '']);
  };
  const handleUpdateEmail = (index: number, val: string) => {
    const next = [...emails];
    next[index] = val;
    setEmails(next);
    // Clear validation error when updating
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

  // Phones helpers
  const handleAddPhone = () => setPhones([...phones, '']);
  const handleUpdatePhone = (index: number, val: string) => {
    const next = [...phones];
    next[index] = val;
    setPhones(next);
  };
  const handleRemovePhone = (index: number) => setPhones(phones.filter((_, i) => i !== index));

  // Websites helpers
  const handleAddWebsite = () => setWebsites([...websites, '']);
  const handleUpdateWebsite = (index: number, val: string) => {
    const next = [...websites];
    next[index] = val;
    setWebsites(next);
  };
  const handleRemoveWebsite = (index: number) => setWebsites(websites.filter((_, i) => i !== index));

  const countFields = (extracted: any) => {
    let count = 0;
    if (extracted.name) count++;
    if (extracted.title) count++;
    if (extracted.company) count++;
    if (extracted.address) count++;
    if (extracted.emails && extracted.emails.length > 0) count += extracted.emails.length;
    if (extracted.phones && extracted.phones.length > 0) count += extracted.phones.length;
    if (extracted.websites && extracted.websites.length > 0) count += extracted.websites.length;
    return count;
  };

  const processImage = async () => {
    if (!selectedImages || selectedImages.length === 0) return;
    
    try {
      setLoading(true);
      setError(null);
      trackEvent('card_scan_started');
      
      const imagesPayload = await Promise.all(
        selectedImages.map(async (img) => {
          const base64 = await FileSystem.readAsStringAsync(img.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return {
            image_base64: base64,
            mime_type: img.mimeType,
          };
        })
      );

      const response = await extractBusinessCard(imagesPayload);
      
      if (response.success && response.data) {
        const extracted = response.data;
        setData(extracted);
        setName(extracted.name || '');
        setTitle(extracted.title || '');
        setCompany(extracted.company || '');
        setAddress(extracted.address || '');
        setEmails(extracted.emails || []);
        setPhones(extracted.phones || []);
        setWebsites(extracted.websites || []);
        setEmailErrors(new Array((extracted.emails || []).length).fill(''));
        trackEvent('card_scan_completed', { success: true, field_count: countFields(extracted) });
      } else {
        const msg = response.error || "Failed to extract data.";
        setError(msg);
        trackEvent('card_scan_completed', { success: false, field_count: 0 });
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      trackEvent('card_scan_completed', { success: false, field_count: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedImages && selectedImages.length > 0) {
      processImage();
    }
  }, [selectedImages]);

  const handleDiscard = () => {
    Alert.alert(
      "Discard Card",
      "Discard this card?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Discard", 
          style: "destructive",
          onPress: () => {
            clearSelectedImages();
            router.replace('/(app)/dashboard');
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    setEmailErrors([]);
    let hasValidationError = false;

    const trimmedName = name.trim();
    const trimmedCompany = company.trim();
    const filteredEmails = emails.map(e => e.trim()).filter(Boolean);
    const filteredPhones = phones.map(p => p.trim()).filter(Boolean);
    const filteredWebsites = websites.map(w => w.trim()).filter(Boolean);

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

    // Validation: At least one of name, company, emails, or phones must be non-empty
    if (!trimmedName && !trimmedCompany && filteredEmails.length === 0 && filteredPhones.length === 0) {
      Alert.alert("Validation Error", "Please fill in at least one field before saving.");
      return;
    }

    if (hasValidationError) return;

    try {
      setIsSaving(true);
      const cardPayload = {
        name: trimmedName || null,
        title: title.trim() || null,
        company: trimmedCompany || null,
        address: address.trim() || null,
        emails: filteredEmails,
        phones: filteredPhones,
        websites: filteredWebsites,
        image_url: selectedImages.map(img => img.uri).join(','),
        raw_extraction: data?.raw_extraction || null,
      };

      const hadEdits = (
        trimmedName !== (data?.name || '') ||
        title.trim() !== (data?.title || '') ||
        trimmedCompany !== (data?.company || '') ||
        address.trim() !== (data?.address || '') ||
        JSON.stringify(filteredEmails) !== JSON.stringify(data?.emails || []) ||
        JSON.stringify(filteredPhones) !== JSON.stringify(data?.phones || []) ||
        JSON.stringify(filteredWebsites) !== JSON.stringify(data?.websites || [])
      );

      const savedCard = await createCard(cardPayload);
      mutationState.hasMutated = true;
      trackEvent('card_saved', { had_edits: hadEdits });
      
      // Trigger background enrichment and start status polling
      try {
        await enrichCard(savedCard.id);
        pollEnrichmentStatus(savedCard.id);
      } catch (enrichErr) {
        console.error('Failed to trigger company enrichment:', enrichErr);
      }
      
      clearSelectedImages();
      router.replace('/(app)/dashboard');

    } catch (err: any) {
      Alert.alert("Save Failed", err.message || "An error occurred while saving the card.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedImages || selectedImages.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No image selected.</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/(app)/dashboard')}>
          <Text style={styles.btnText}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Reading business card...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <MaterialIcons name="error-outline" size={48} color="#dc3545" />
        <Text style={styles.errorText}>{error}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.btnSecondary, styles.flexBtn]} onPress={handleDiscard}>
            <Text style={styles.btnTextSecondary}>Go Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimary, styles.flexBtn]} onPress={processImage}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Review & Edit Card</Text>
      
      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Name"
          />
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
          />
        </View>
        
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Company</Text>
          <TextInput
            style={styles.input}
            value={company}
            onChangeText={setCompany}
            placeholder="Company"
          />
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



      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.btnSecondary, styles.flexBtn]} 
          onPress={handleDiscard}
          disabled={isSaving}
        >
          <Text style={styles.btnTextSecondary}>Discard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.btnPrimary, styles.flexBtn, isSaving && styles.btnDisabled]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          <View style={styles.saveBtnContent}>
            {isSaving && <ActivityIndicator size="small" color="#fff" style={styles.inlineSpinner} />}
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
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
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inlineSpinner: {
    marginRight: 4,
  },
  btnDisabled: {
    backgroundColor: '#a2a8b3',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  flexBtn: {
    flex: 1,
  },
  btnPrimary: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#007bff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnTextSecondary: {
    color: '#007bff',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
