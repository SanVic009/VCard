import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getEnrichmentStatus } from '../lib/enrichmentApi';

interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'info';
  onPress?: () => void;
  duration?: number;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
  pollEnrichmentStatus: (cardId: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const { width } = Dimensions.get('window');

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error' | 'info'>('info');
  const [onPressAction, setOnPressAction] = useState<(() => void) | undefined>(undefined);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<any>(null);
  const activePollsRef = useRef<{ [cardId: string]: any }>({});


  const showToast = ({ message, type = 'info', onPress, duration = 2500 }: ToastOptions) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setMessage(message);
    setType(type);
    setOnPressAction(() => onPress);
    setVisible(true);

    fadeAnim.setValue(0);
    slideAnim.setValue(-100);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 50,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    timeoutRef.current = setTimeout(() => {
      dismissToast();
    }, duration);
  };

  const dismissToast = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      setVisible(false);
    });
  };

  const handlePress = () => {
    if (onPressAction) {
      onPressAction();
    }
    dismissToast();
  };

  const pollEnrichmentStatus = (cardId: string) => {
    if (activePollsRef.current[cardId]) {
      return;
    }

    let elapsed = 0;
    let currentDelay = 2000; // Start with 2 seconds
    const maxDelay = 10000;  // Max backoff delay is 10 seconds
    const maxDuration = 60000; // Total timeout is 60 seconds

    const poll = async () => {
      try {
        const res = await getEnrichmentStatus(cardId);
        if (res.status === 'completed' && res.company_id) {
          stopPolling(cardId);
          const companyId = res.company_id;
          showToast({
            message: 'Company info available.',
            type: 'success',
            onPress: () => {
              router.push(`/(app)/company/${companyId}?cardId=${cardId}` as any);
            }
          });
        } else if (res.status === 'failed') {
          stopPolling(cardId);
          const companyId = res.company_id;
          showToast({
            message: 'Company research failed.',
            type: 'error',
            onPress: companyId ? () => {
              router.push(`/(app)/company/${companyId}?cardId=${cardId}` as any);
            } : undefined
          });
        } else {
          elapsed += currentDelay;
          if (elapsed >= maxDuration) {
            stopPolling(cardId);
            const companyId = res.company_id;
            showToast({
              message: 'Company research timed out.',
              type: 'error',
              onPress: companyId ? () => {
                router.push(`/(app)/company/${companyId}?cardId=${cardId}` as any);
              } : undefined
            });
          } else {
            // Apply exponential backoff: double the delay up to maxDelay
            const nextDelay = currentDelay;
            currentDelay = Math.min(currentDelay * 2, maxDelay);
            activePollsRef.current[cardId] = setTimeout(poll, nextDelay);
          }
        }
      } catch (err: any) {
        console.error('Error polling enrichment status:', err);
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          stopPolling(cardId);
          showToast({ message: 'Session expired. Please log in again.', type: 'error' });
          return;
        }
        elapsed += currentDelay;
        if (elapsed >= maxDuration) {
          stopPolling(cardId);
          showToast({ message: 'Company research failed to poll.', type: 'error' });
        } else {
          const nextDelay = currentDelay;
          currentDelay = Math.min(currentDelay * 2, maxDelay);
          activePollsRef.current[cardId] = setTimeout(poll, nextDelay);
        }
      }
    };

    activePollsRef.current[cardId] = setTimeout(poll, currentDelay);
  };

  const stopPolling = (cardId: string) => {
    if (activePollsRef.current[cardId]) {
      clearTimeout(activePollsRef.current[cardId]);
      delete activePollsRef.current[cardId];
    }
  };

  useEffect(() => {
    return () => {
      Object.values(activePollsRef.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, pollEnrichmentStatus }}>
      {children}
      {visible && (
        <Animated.View 
          style={[
            styles.toastContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity 
            style={[
              styles.toastContent,
              type === 'success' ? styles.toastSuccess : null
            ]} 
            onPress={handlePress} 
            activeOpacity={0.85}
          >
            <View style={styles.toastLeft}>
              <FontAwesome 
                name={type === 'success' ? 'check-circle' : 'info-circle'} 
                size={18} 
                color={type === 'success' ? '#FFFFFF' : '#0868D6'} 
                style={styles.toastIcon} 
              />
              <Text style={styles.toastText} numberOfLines={2}>{message}</Text>
            </View>
            {onPressAction && (
              <View style={[
                styles.actionBtn,
                type === 'success' ? styles.actionBtnSuccess : null
              ]}>
                <Text style={[
                  styles.toastActionText,
                  type === 'success' ? styles.toastActionTextSuccess : null
                ]}>VIEW</Text>
                <FontAwesome 
                  name="chevron-right" 
                  size={10} 
                  color={type === 'success' ? '#FFFFFF' : '#0868D6'} 
                  style={styles.arrowIcon} 
                />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    paddingHorizontal: 20,
  },
  toastContent: {
    width: Math.min(width - 40, 360),
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: '#6FAC39',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  toastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  toastIcon: {
    marginRight: 10,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 104, 214, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  actionBtnSuccess: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  toastActionText: {
    color: '#0868D6',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 4,
  },
  toastActionTextSuccess: {
    color: '#FFFFFF',
  },
  arrowIcon: {
    marginTop: 1,
  },
});
