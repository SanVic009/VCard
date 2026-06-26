import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useImageContext } from '../../context/ImageContext';
import * as FileSystem from 'expo-file-system/legacy';
import { extractBusinessCard, ExtractionData } from '../../lib/extractionApi';
import { MaterialIcons } from '@expo/vector-icons';

export default function ResultsScreen() {
  const router = useRouter();
  const { selectedImage, clearSelectedImage } = useImageContext();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ExtractionData | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const processImage = async () => {
    if (!selectedImage) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const base64 = await FileSystem.readAsStringAsync(selectedImage.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const response = await extractBusinessCard(base64, selectedImage.mimeType);
      
      if (response.success && response.data) {
        setData(response.data);
      } else {
        setError(response.error || "Failed to extract data.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedImage) {
      processImage();
    }
  }, [selectedImage]);

  const handleRetake = () => {
    clearSelectedImage();
    router.replace('/(app)/dashboard');
  };

  const handleSave = () => {
    Alert.alert("Notice", "Save functionality coming in Module 6.");
  };

  if (!selectedImage) {
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
          <TouchableOpacity style={[styles.btnSecondary, styles.flexBtn]} onPress={handleRetake}>
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
      <Text style={styles.title}>Extraction Results</Text>
      
      <View style={styles.card}>
        <Field label="Name" value={data.name} />
        <Field label="Title" value={data.title} />
        <Field label="Company" value={data.company} />
        <Field label="Address" value={data.address} />
        <FieldList label="Emails" values={data.emails} />
        <FieldList label="Phones" values={data.phones} />
        <FieldList label="Websites" values={data.websites} />
      </View>

      <TouchableOpacity style={styles.rawHeader} onPress={() => setShowRaw(!showRaw)}>
        <Text style={styles.rawTitle}>Raw AI Output</Text>
        <MaterialIcons name={showRaw ? "expand-less" : "expand-more"} size={24} color="#555" />
      </TouchableOpacity>
      
      {showRaw && (
        <View style={styles.rawBox}>
          <Text style={styles.rawText}>{data.raw_extraction}</Text>
        </View>
      )}

      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.btnSecondary, styles.flexBtn]} onPress={handleRetake}>
          <Text style={styles.btnTextSecondary}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnPrimary, styles.flexBtn]} onPress={handleSave}>
          <Text style={styles.btnText}>Save Card</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Field({ label, value }: { label: string, value: string | null }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || "—"}</Text>
    </View>
  );
}

function FieldList({ label, values }: { label: string, values: string[] }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValuesContainer}>
        {values.length === 0 ? (
          <Text style={styles.fieldValue}>None</Text>
        ) : (
          values.map((v, i) => (
            <Text key={i} style={styles.fieldValue}>{v}</Text>
          ))
        )}
      </View>
    </View>
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
  fieldRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fieldLabel: {
    flex: 1,
    fontWeight: '600',
    color: '#555',
  },
  fieldValuesContainer: {
    flex: 2,
  },
  fieldValue: {
    color: '#111',
    marginBottom: 2,
  },
  rawHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  rawTitle: {
    fontWeight: 'bold',
    color: '#495057',
  },
  rawBox: {
    backgroundColor: '#212529',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  rawText: {
    color: '#f8f9fa',
    fontFamily: 'monospace',
    fontSize: 12,
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
