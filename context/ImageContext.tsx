import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { SelectedImage } from '../lib/imageProcessor';

interface ImageContextType {
  selectedImage: SelectedImage | null;
  setSelectedImage: (image: SelectedImage) => void;
  clearSelectedImage: () => Promise<void>;
}

const ImageContext = createContext<ImageContextType | undefined>(undefined);

export function ImageProvider({ children }: { children: ReactNode }) {
  const [selectedImage, setLocalSelectedImage] = useState<SelectedImage | null>(null);

  const setSelectedImage = (image: SelectedImage) => {
    setLocalSelectedImage(image);
  };

  const clearSelectedImage = async () => {
    if (selectedImage?.uri) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(selectedImage.uri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(selectedImage.uri, { idempotent: true });
        }
      } catch (error) {
        console.warn("Failed to clean up image file:", error);
      }
    }
    setLocalSelectedImage(null);
  };

  return (
    <ImageContext.Provider value={{ selectedImage, setSelectedImage, clearSelectedImage }}>
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
