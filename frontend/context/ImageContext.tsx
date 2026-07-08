import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { SelectedImage } from '../lib/imageProcessor';

interface ImageContextType {
  selectedImages: SelectedImage[];
  setSelectedImages: (images: SelectedImage[]) => void;
  clearSelectedImages: () => Promise<void>;
}

const ImageContext = createContext<ImageContextType | undefined>(undefined);

export function ImageProvider({ children }: { children: ReactNode }) {
  const [selectedImages, setSelectedImagesState] = useState<SelectedImage[]>([]);

  // Startup scan and clean orphaned card_*.jpg files
  useEffect(() => {
    const cleanOrphanedCache = async () => {
      try {
        const cacheDir = FileSystem.cacheDirectory;
        if (!cacheDir) return;
        
        const files = await FileSystem.readDirectoryAsync(cacheDir);
        for (const file of files) {
          if (file.startsWith('card_') && file.endsWith('.jpg')) {
            const fileUri = cacheDir + file;
            try {
              await FileSystem.deleteAsync(fileUri, { idempotent: true });
            } catch (err) {
              console.warn("Failed to delete orphaned cache file:", file, err);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to scan cache directory:", error);
      }
    };
    
    cleanOrphanedCache();
  }, []);

  const setSelectedImages = (newImages: SelectedImage[]) => {
    const newUris = new Set(newImages.map(img => img.uri));
    selectedImages.forEach(async (image) => {
      if (image?.uri && !newUris.has(image.uri)) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(image.uri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(image.uri, { idempotent: true });
          }
        } catch (error) {
          console.warn("Failed to clean up overridden image file:", error);
        }
      }
    });
    setSelectedImagesState(newImages);
  };

  const clearSelectedImages = async () => {
    for (const image of selectedImages) {
      if (image?.uri) {
        try {
          const fileInfo = await FileSystem.getInfoAsync(image.uri);
          if (fileInfo.exists) {
            await FileSystem.deleteAsync(image.uri, { idempotent: true });
          }
        } catch (error) {
          console.warn("Failed to clean up image file:", error);
        }
      }
    }
    setSelectedImagesState([]);
  };

  return (
    <ImageContext.Provider value={{ selectedImages, setSelectedImages, clearSelectedImages }}>
      {children}
    </ImageContext.Provider>
  );
}

export function useImageContext() {
  const context = useContext(ImageContext);
  if (context === undefined) {
    throw new Error('useImageContext must be used within an ImageProvider');
  }
  return context;
}
