import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { SelectedImage } from '../lib/imageProcessor';

interface ImageContextType {
  selectedImages: SelectedImage[];
  setSelectedImages: (images: SelectedImage[]) => void;
  clearSelectedImages: () => Promise<void>;
}

const ImageContext = createContext<ImageContextType | undefined>(undefined);

export function ImageProvider({ children }: { children: ReactNode }) {
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);

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
    setSelectedImages([]);
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
