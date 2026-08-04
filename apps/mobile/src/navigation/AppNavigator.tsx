import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useAuth } from '../auth/AuthContext';
import LoadingView from '../components/LoadingView';
import AddReturnPhotosScreen from '../screens/AddReturnPhotosScreen';
import CreateReturnScreen from '../screens/CreateReturnScreen';
import CustomerSignatureScreen from '../screens/CustomerSignatureScreen';
import LoginScreen from '../screens/LoginScreen';
import ReturnDetailsScreen from '../screens/ReturnDetailsScreen';
import ReturnListScreen from '../screens/ReturnListScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * One native stack; which screens exist depends entirely on
 * `AuthContext`'s status — the officially recommended React Navigation
 * pattern for gating an authenticated flow, rather than a second navigator
 * or a manual visibility toggle.
 */
export default function AppNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return <LoadingView label="Restoring your session…" />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
        {status === 'authenticated' ? (
          <>
            <Stack.Screen name="ReturnList" component={ReturnListScreen} options={{ title: 'My Returns' }} />
            <Stack.Screen name="CreateReturn" component={CreateReturnScreen} options={{ title: 'New Return' }} />
            <Stack.Screen name="ReturnDetails" component={ReturnDetailsScreen} options={{ title: 'Return Details' }} />
            <Stack.Screen name="AddReturnPhotos" component={AddReturnPhotosScreen} options={{ title: 'Add Photos', headerBackVisible: false }} />
            <Stack.Screen
              name="CustomerSignature"
              component={CustomerSignatureScreen}
              options={{ title: 'Customer Signature', headerBackVisible: false }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
