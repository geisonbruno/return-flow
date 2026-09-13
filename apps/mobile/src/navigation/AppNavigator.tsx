import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { useAuth } from '../auth/AuthContext';
import LoadingView from '../components/LoadingView';
import AddReturnPhotosScreen from '../screens/AddReturnPhotosScreen';
import CreateReturnScreen from '../screens/CreateReturnScreen';
import CustomerSignatureScreen from '../screens/CustomerSignatureScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
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
            {/* The redesigned dark screens draw their own title and bottom
                navigation, so they opt out of the stack header rather than
                showing two competing titles. Every other route keeps it. */}
            <Stack.Screen name="ReturnList" component={ReturnListScreen} options={{ title: 'My Returns', headerShown: false }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile', headerShown: false }} />
            <Stack.Screen name="CreateReturn" component={CreateReturnScreen} options={{ title: 'New Return', headerShown: false }} />
            <Stack.Screen name="ReturnDetails" component={ReturnDetailsScreen} options={{ title: 'Return Details' }} />
            <Stack.Screen name="AddReturnPhotos" component={AddReturnPhotosScreen} options={{ title: 'Add Photos', headerShown: false }} />
            <Stack.Screen
              name="CustomerSignature"
              component={CustomerSignatureScreen}
              options={{ title: 'Customer Signature', headerShown: false }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
