import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineBanner() {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    let wasOffline = false;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const currentConnected = state.isConnected ?? false;
      
      if (!currentConnected) {
        wasOffline = true;
        setShowOnlineBanner(false);
      } else if (currentConnected && wasOffline) {
        // Came back online
        wasOffline = false;
        setShowOnlineBanner(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();

        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowOnlineBanner(false));
        }, 3000);
      }
      
      setIsConnected(currentConnected);
    });

    return () => unsubscribe();
  }, [fadeAnim]);

  if (!isConnected) {
    return (
      <View style={[styles.banner, styles.offlineBanner]}>
        <Text style={styles.bannerText}>No internet connection.</Text>
      </View>
    );
  }

  if (showOnlineBanner) {
    return (
      <Animated.View style={[styles.banner, styles.onlineBanner, { opacity: fadeAnim }]}>
        <Text style={styles.bannerText}>Back online.</Text>
      </Animated.View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  offlineBanner: {
    backgroundColor: '#dc3545',
  },
  onlineBanner: {
    backgroundColor: '#28a745',
  },
  bannerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
