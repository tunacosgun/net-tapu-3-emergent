import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { useTheme } from '../theme';

import HomeScreen from '../screens/home/HomeScreen';
import ParcelsListScreen from '../screens/parcels/ParcelsListScreen';
import AuctionsListScreen from '../screens/auctions/AuctionsListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

/**
 * iOS 26+ automatically applies liquid glass to the native tab bar.
 * By NOT providing a custom tabBar, React Navigation uses the native
 * UITabBar rendering which gets the glass effect for free on iOS 26.
 */
export default function MainTabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
        tabBarStyle: Platform.select({
          ios: {
            // Let iOS handle the tab bar appearance — iOS 26 will apply liquid glass
            position: 'absolute',
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
          android: {
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderTopWidth: 0,
            elevation: 12,
            height: 64,
            paddingBottom: 8,
            paddingTop: 4,
          },
        }),
        // iOS: transparent background lets the system glass shine through
        tabBarBackground: () =>
          Platform.OS === 'ios' ? null : null,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
          tabBarIcon: ({ focused }) => (
            <TabEmoji emoji="🏠" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Parcels"
        component={ParcelsListScreen}
        options={{
          tabBarLabel: 'İlanlar',
          tabBarIcon: ({ focused }) => (
            <TabEmoji emoji="🗺️" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Auctions"
        component={AuctionsListScreen}
        options={{
          tabBarLabel: 'İhaleler',
          tabBarIcon: ({ focused }) => (
            <TabEmoji emoji="⚡" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused }) => (
            <TabEmoji emoji="👤" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

import { Text } from 'react-native';

function TabEmoji({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}
