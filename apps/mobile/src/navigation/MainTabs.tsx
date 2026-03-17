import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useTheme } from '../theme';

import HomeScreen from '../screens/home/HomeScreen';
import ParcelsListScreen from '../screens/parcels/ParcelsListScreen';
import AuctionsListScreen from '../screens/auctions/AuctionsListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

/**
 * iOS 26 style tab bar — uses BlurView with systemThinMaterial
 * to replicate the native UITabBar liquid glass appearance.
 *
 * Harry Potter reference app uses standard UITabBarController which
 * gets liquid glass for free. In RN we simulate it with BlurView.
 */
export default function MainTabs() {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#8B5E3C',  // systemBrown like HP app
        tabBarInactiveTintColor: '#8E8E93', // systemGray
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType="systemThinMaterial"
              blurAmount={80}
              reducedTransparencyFallbackColor="#f8f8f8"
            />
          </View>
        ),
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="house.fill" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Parcels"
        component={ParcelsListScreen}
        options={{
          tabBarLabel: 'İlanlar',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="map.fill" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Auctions"
        component={AuctionsListScreen}
        options={{
          tabBarLabel: 'İhaleler',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="bolt.fill" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person.fill" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// SF Symbol icon component using emoji fallback
// React Native doesn't support SF Symbols natively,
// so we use text-based icons that match the style
import { Text } from 'react-native';

const SF_ICON_MAP: Record<string, string> = {
  'house.fill': '🏠',
  'map.fill': '🗺️',
  'bolt.fill': '⚡',
  'person.fill': '👤',
};

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <Text style={{ fontSize: size - 4, textAlign: 'center' }}>
      {SF_ICON_MAP[name] || '•'}
    </Text>
  );
}
