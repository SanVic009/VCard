import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, PanResponder, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useImageContext } from '../../context/ImageContext';
import { cropImage, SelectedImage } from '../../lib/imageProcessor';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const maxCropWidth = screenWidth - 24;
const maxCropHeight = screenHeight * 0.48;

export default function PreviewScreen() {
  const router = useRouter();
  const { selectedImages, setSelectedImages } = useImageContext();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isCropping, setIsCropping] = useState(false);

  // Array of crop boxes: [{x, y, w, h}]
  const [cropBoxes, setCropBoxes] = useState<Array<{ x: number, y: number, w: number, h: number }>>([]);

  // Calculate container size for the active image
  const getContainerSize = (index: number) => {
    if (!selectedImages || !selectedImages[index]) {
      return { width: 0, height: 0, scale: 1 };
    }
    const img = selectedImages[index];
    const AR = img.width / img.height;
    let cWidth = maxCropWidth;
    let cHeight = maxCropWidth / AR;
    if (cHeight > maxCropHeight) {
      cHeight = maxCropHeight;
      cWidth = maxCropHeight * AR;
    }
    return {
      width: cWidth,
      height: cHeight,
      scale: img.width / cWidth
    };
  };

  const { width: containerWidth, height: containerHeight } = getContainerSize(currentImageIndex);

  // Initialize crop boxes when selectedImages changes
  useEffect(() => {
    if (selectedImages && selectedImages.length > 0) {
      const initialBoxes = selectedImages.map((img) => {
        const AR = img.width / img.height;
        let cWidth = maxCropWidth;
        let cHeight = maxCropWidth / AR;
        if (cHeight > maxCropHeight) {
          cHeight = maxCropHeight;
          cWidth = maxCropHeight * AR;
        }
        return {
          x: cWidth * 0.05,
          y: cHeight * 0.05,
          w: cWidth * 0.9,
          h: cHeight * 0.9
        };
      });
      setCropBoxes(initialBoxes);
      setCurrentImageIndex(0);
    }
  }, [selectedImages]);

  // Draggable logic refs
  const activeCorner = useRef<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialCropBox = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const currentIndexRef = useRef(0);
  const cropBoxesRef = useRef(cropBoxes);
  const containerSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    currentIndexRef.current = currentImageIndex;
  }, [currentImageIndex]);

  useEffect(() => {
    cropBoxesRef.current = cropBoxes;
  }, [cropBoxes]);

  useEffect(() => {
    containerSizeRef.current = { width: containerWidth, height: containerHeight };
  }, [containerWidth, containerHeight]);

  const activeBox = cropBoxes[currentImageIndex] || { x: 0, y: 0, w: 0, h: 0 };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        // Current box bounds from fresh refs
        const boxes = cropBoxesRef.current;
        const index = currentIndexRef.current;
        const box = boxes[index] || { x: 0, y: 0, w: 0, h: 0 };

        const distTL = Math.hypot(locationX - box.x, locationY - box.y);
        const distTR = Math.hypot(locationX - (box.x + box.w), locationY - box.y);
        const distBL = Math.hypot(locationX - box.x, locationY - (box.y + box.h));
        const distBR = Math.hypot(locationX - (box.x + box.w), locationY - (box.y + box.h));

        const threshold = 45; // Touch threshold
        if (distTL < threshold) activeCorner.current = 'TL';
        else if (distTR < threshold) activeCorner.current = 'TR';
        else if (distBL < threshold) activeCorner.current = 'BL';
        else if (distBR < threshold) activeCorner.current = 'BR';
        else if (
          locationX > box.x &&
          locationX < box.x + box.w &&
          locationY > box.y &&
          locationY < box.y + box.h
        ) {
          activeCorner.current = 'DRAG';
          dragStart.current = { x: locationX - box.x, y: locationY - box.y };
        } else {
          activeCorner.current = null;
          return false;
        }
        return true;
      },
      onPanResponderGrant: () => {
        // Capture initial state on gesture start from fresh refs
        const boxes = cropBoxesRef.current;
        const index = currentIndexRef.current;
        initialCropBox.current = { ...(boxes[index] || { x: 0, y: 0, w: 0, h: 0 }) };
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!activeCorner.current) return;

        const { dx, dy } = gestureState;
        const init = initialCropBox.current;
        const minSize = 50;
        const size = containerSizeRef.current;
        const index = currentIndexRef.current;

        let newX = init.x;
        let newY = init.y;
        let newW = init.w;
        let newH = init.h;

        if (activeCorner.current === 'TL') {
          newX = Math.max(0, Math.min(init.x + dx, init.x + init.w - minSize));
          newY = Math.max(0, Math.min(init.y + dy, init.y + init.h - minSize));
          newW = init.w - (newX - init.x);
          newH = init.h - (newY - init.y);
        } else if (activeCorner.current === 'TR') {
          newY = Math.max(0, Math.min(init.y + dy, init.y + init.h - minSize));
          newW = Math.max(minSize, Math.min(init.w + dx, size.width - init.x));
          newH = init.h - (newY - init.y);
        } else if (activeCorner.current === 'BL') {
          newX = Math.max(0, Math.min(init.x + dx, init.x + init.w - minSize));
          newW = init.w - (newX - init.x);
          newH = Math.max(minSize, Math.min(init.h + dy, size.height - init.y));
        } else if (activeCorner.current === 'BR') {
          newW = Math.max(minSize, Math.min(init.w + dx, size.width - init.x));
          newH = Math.max(minSize, Math.min(init.h + dy, size.height - init.y));
        } else if (activeCorner.current === 'DRAG') {
          newX = Math.max(0, Math.min(init.x + dx, size.width - init.w));
          newY = Math.max(0, Math.min(init.y + dy, size.height - init.h));
        }

        setCropBoxes((prev) => {
          const copy = [...prev];
          copy[index] = { x: newX, y: newY, w: newW, h: newH };
          return copy;
        });
      },
      onPanResponderRelease: () => {
        activeCorner.current = null;
      }
    })
  ).current;

  const handleUseCard = async () => {
    if (!selectedImages || selectedImages.length === 0 || cropBoxes.length === 0) return;

    try {
      setIsCropping(true);
      const croppedImages = await Promise.all(
        selectedImages.map(async (img, idx) => {
          const box = cropBoxes[idx];
          const { scale } = getContainerSize(idx);
          
          const originX = Math.max(0, Math.min(Math.round(box.x * scale), img.width - 1));
          const originY = Math.max(0, Math.min(Math.round(box.y * scale), img.height - 1));
          const width = Math.max(1, Math.min(Math.round(box.w * scale), img.width - originX));
          const height = Math.max(1, Math.min(Math.round(box.h * scale), img.height - originY));

          return await cropImage(img.uri, { originX, originY, width, height });
        })
      );

      setSelectedImages(croppedImages);
      router.push('/(app)/results');
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsCropping(false);
    }
  };

  const handleRetake = () => {
    router.back();
  };

  if (!selectedImages || selectedImages.length === 0 || cropBoxes.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={{ color: '#fff' }}>No image to preview.</Text>
      </View>
    );
  }

  const activeImage = selectedImages[currentImageIndex];

  return (
    <View style={styles.container}>
      {isCropping && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Cropping card images...</Text>
        </View>
      )}

      <Text style={styles.instructionText}>
        Adjust the grid corners to fit the card borders
      </Text>

      {selectedImages.length > 1 && (
        <View style={styles.tabContainer}>
          {selectedImages.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.tab, currentImageIndex === idx ? styles.activeTab : null]}
              onPress={() => setCurrentImageIndex(idx)}
            >
              <Text style={[styles.tabText, currentImageIndex === idx ? styles.activeTabText : null]}>
                {idx === 0 ? "Front Image" : "Back Image"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.centerContainer}>
        <View 
          style={[styles.cropContainer, { width: containerWidth, height: containerHeight }]}
          {...panResponder.panHandlers}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Image 
              source={{ uri: activeImage.uri }} 
              style={styles.image} 
              resizeMode="stretch" 
            />

            {/* Semi-transparent outer mask overlays */}
            <View style={[styles.mask, { left: 0, top: 0, right: 0, height: activeBox.y }]} />
            <View style={[styles.mask, { left: 0, top: activeBox.y + activeBox.h, right: 0, bottom: 0 }]} />
            <View style={[styles.mask, { left: 0, top: activeBox.y, width: activeBox.x, height: activeBox.h }]} />
            <View style={[styles.mask, { left: activeBox.x + activeBox.w, top: activeBox.y, right: 0, height: activeBox.h }]} />

            {/* Draggable Crop Box Border & 3x3 Grid Overlay */}
            <View style={[styles.cropBox, { left: activeBox.x, top: activeBox.y, width: activeBox.w, height: activeBox.h }]}>
              {/* Grid Lines */}
              <View style={[styles.gridLineV, { left: '33.3%' }]} />
              <View style={[styles.gridLineV, { left: '66.6%' }]} />
              <View style={[styles.gridLineH, { top: '33.3%' }]} />
              <View style={[styles.gridLineH, { top: '66.6%' }]} />

              {/* Corner visual indicators */}
              <View style={[styles.cornerIndicator, styles.cornerTL]} />
              <View style={[styles.cornerIndicator, styles.cornerTR]} />
              <View style={[styles.cornerIndicator, styles.cornerBL]} />
              <View style={[styles.cornerIndicator, styles.cornerBR]} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.useBtn]} onPress={handleUseCard} disabled={isCropping}>
          <Text style={styles.btnText}>Use This Card</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.retakeBtn]} onPress={handleRetake} disabled={isCropping}>
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
    paddingTop: 45,
  },
  instructionText: {
    color: '#bbb',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 20,
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#222',
  },
  activeTab: {
    backgroundColor: '#007bff',
  },
  tabText: {
    color: '#888',
    fontWeight: 'bold',
    fontSize: 13,
  },
  activeTabText: {
    color: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  cropContainer: {
    position: 'relative',
    backgroundColor: '#111',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#fff',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0.8,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  cornerIndicator: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#fff',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  actions: {
    width: '100%',
    padding: 16,
    gap: 10,
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
    borderColor: '#444',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retakeBtnText: {
    color: '#bbb',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 15,
    fontWeight: '500',
  }
});
