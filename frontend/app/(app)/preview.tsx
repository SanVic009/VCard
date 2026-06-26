import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useImageContext } from '../../context/ImageContext';
import { SelectedImage } from '../../lib/imageProcessor';

export default function PreviewScreen() {
  const router = useRouter();
  const { selectedImages } = useImageContext();

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleUseCard = () => {
    router.push('/(app)/results');
  };

  const handleRetake = () => {
    router.back();
  };

  if (!selectedImages || selectedImages.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff' }}>No image to preview.</Text>
      </View>
    );
  }

  const totalSize = selectedImages.reduce((sum, img) => sum + img.fileSize, 0);

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        {selectedImages.map((img, idx) => (
          <Image 
            key={idx} 
            source={{ uri: img.uri }} 
            style={[styles.image, selectedImages.length > 1 ? styles.imageHalf : null]} 
            resizeMode="contain" 
          />
        ))}
      </View>
      
      <View style={styles.metaContainer}>
        {selectedImages.length === 1 ? (
          <Text style={styles.metaText}>Resolution: {selectedImages[0].width} × {selectedImages[0].height}</Text>
        ) : (
          <Text style={styles.metaText}>Images Selected: {selectedImages.length}</Text>
        )}
        <Text style={styles.metaText}>Total Size: {formatSize(totalSize)}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.useBtn]} onPress={handleUseCard}>
          <Text style={styles.btnText}>Use This Card</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.retakeBtn]} onPress={handleRetake}>
          <Text style={[styles.btnText, styles.retakeBtnText]}>Retake / Choose Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '70%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111',
  },
  imageHalf: {
    flex: 1,
    height: '100%',
  },
  metaContainer: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  metaText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  actions: {
    width: '100%',
    padding: 20,
    gap: 15,
  },
  btn: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  useBtn: {
    backgroundColor: '#007bff',
  },
  retakeBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#555',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retakeBtnText: {
    color: '#bbb',
  }
});
