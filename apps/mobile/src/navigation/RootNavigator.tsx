import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/auth-store';
import { useTheme } from '../theme';

import MainTabs from './MainTabs';
import SplashScreen from '../screens/onboarding/SplashScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ParcelDetailScreen from '../screens/parcels/ParcelDetailScreen';
import ParcelMapScreen from '../screens/parcels/ParcelMapScreen';
import LiveAuctionScreen from '../screens/auctions/LiveAuctionScreen';
import DepositPaymentScreen from '../screens/payments/DepositPaymentScreen';
import ThreeDsWebViewScreen from '../screens/payments/ThreeDsWebViewScreen';
import PaymentResultScreen from '../screens/payments/PaymentResultScreen';
import FavoritesScreen from '../screens/profile/FavoritesScreen';
import OffersScreen from '../screens/profile/OffersScreen';
import PaymentsScreen from '../screens/profile/PaymentsScreen';
import SettingsScreen from '../screens/profile/SettingsScreen';
import NotificationsScreen from '../screens/profile/NotificationsScreen';

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: { returnTo?: string } | undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Main: undefined;
  ParcelDetail: { id: string };
  ParcelMap: undefined;
  LiveAuction: { id: string };
  DepositPayment: { auctionId: string };
  ThreeDsWebView: { url: string; paymentId: string; auctionId: string };
  PaymentResult: { paymentId: string; auctionId: string; status: 'success' | 'failed' | 'pending' };
  Favorites: undefined;
  Offers: undefined;
  Payments: undefined;
  Settings: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hydrate = useAuthStore((s) => s.hydrate);
  const theme = useTheme();

  useEffect(() => {
    hydrate();
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
        animation: 'slide_from_right',
      }}
    >
      {!isAuthenticated ? (
        <Stack.Group>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="ParcelDetail" component={ParcelDetailScreen} />
          <Stack.Screen name="ParcelMap" component={ParcelMapScreen} />
          <Stack.Screen name="LiveAuction" component={LiveAuctionScreen} />
          <Stack.Screen name="DepositPayment" component={DepositPaymentScreen} />
          <Stack.Screen name="ThreeDsWebView" component={ThreeDsWebViewScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="PaymentResult" component={PaymentResultScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Favorites" component={FavoritesScreen} />
          <Stack.Screen name="Offers" component={OffersScreen} />
          <Stack.Screen name="Payments" component={PaymentsScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}
