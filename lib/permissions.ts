import { Alert, Linking, Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

export async function requestCameraPermission(): Promise<boolean> {
  const { status, canAskAgain } = await Camera.getCameraPermissionsAsync();
  
  if (status === 'granted') {
    return true;
  }

  // If we can't ask again (user selected "Don't ask again"), don't even try to request.
  if (!canAskAgain && status === 'denied') {
    showPermissionDeniedAlert('Camera');
    return false;
  }

  const { status: newStatus } = await Camera.requestCameraPermissionsAsync();
  
  if (newStatus === 'granted') {
    return true;
  }
  
  showPermissionDeniedAlert('Camera');
  return false;
}

export async function requestGalleryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.getMediaLibraryPermissionsAsync();
  
  if (status === 'granted') {
    return true;
  }

  if (!canAskAgain && status === 'denied') {
    showPermissionDeniedAlert('Gallery');
    return false;
  }

  const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  if (newStatus === 'granted') {
    return true;
  }
  
  showPermissionDeniedAlert('Gallery');
  return false;
}

export function showPermissionDeniedAlert(source: 'Camera' | 'Gallery'): void {
  Alert.alert(
    `${source} Permission Required`,
    `Please enable ${source} access in your device settings to use this feature.`,
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Open Settings", 
        onPress: () => {
          if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
          } else {
            Linking.openSettings();
          }
        } 
      }
    ]
  );
}
