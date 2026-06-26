import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export default function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          opacity: pulseAnim,
        },
        style,
      ]}
    />
  );
}

export function CardListSkeleton() {
  return (
    <View style={{ padding: 15 }}>
      {[1, 2, 3, 4, 5].map((key) => (
        <View key={key} style={styles.listRow}>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" height={18} borderRadius={6} />
            <Skeleton width="40%" height={14} borderRadius={4} />
          </View>
          <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
            <Skeleton width={80} height={14} borderRadius={3} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function CardDetailSkeleton() {
  return (
    <View style={styles.detailContainer}>
      {[1, 2, 3, 4, 5, 6, 7].map((key) => (
        <View key={key} style={styles.detailGroup}>
          <Skeleton width="25%" height={12} borderRadius={3} style={{ marginBottom: 8 }} />
          <Skeleton width="70%" height={18} borderRadius={4} />
        </View>
      ))}
      <View style={styles.metaDivider}>
        <Skeleton width="50%" height={12} borderRadius={3} style={{ marginBottom: 6 }} />
        <Skeleton width="45%" height={12} borderRadius={3} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#e9ecef',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f1f3f5',
  },
  detailContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
  },
  detailGroup: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    paddingBottom: 10,
  },
  metaDivider: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f1f3f5',
    paddingTop: 15,
  },
});
