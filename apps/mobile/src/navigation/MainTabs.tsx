import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

import HomeScreen from '../screens/home/HomeScreen';
import ParcelsListScreen from '../screens/parcels/ParcelsListScreen';
import AuctionsListScreen from '../screens/auctions/AuctionsListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Home', label: 'Ana Sayfa', icon: '🏠' },
  { name: 'Parcels', label: 'İlanlar', icon: '🗺️' },
  { name: 'Auctions', label: 'İhaleler', icon: '⚡' },
  { name: 'Profile', label: 'Profil', icon: '👤' },
];

function GlassTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPadding + 10 }]}>
      <View style={styles.tabBarContainer}>
        {/* iOS native frosted glass - always light */}
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="xlight"
          blurAmount={50}
          reducedTransparencyFallbackColor="#f5f5f5"
        />
        {/* Light glass tint */}
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.glassOverlay,
          ]}
        />

        {/* Tab Items */}
        <View style={styles.tabItemsRow}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const config = TAB_CONFIG[index];
            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                activeOpacity={0.6}
                style={styles.tabItem}
              >
                {/* Active pill background */}
                {isFocused && (
                  <View style={styles.activePill} />
                )}

                {/* Icon */}
                <Text
                  style={[
                    styles.tabIcon,
                    { opacity: isFocused ? 1 : 0.5 },
                  ]}
                >
                  {config.icon}
                </Text>

                {/* Label */}
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused
                        ? theme.colors.primary
                        : '#1f2937',
                      fontWeight: isFocused ? '600' : '400',
                      opacity: isFocused ? 1 : 0.5,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {config.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Parcels" component={ParcelsListScreen} />
      <Tab.Screen name="Auctions" component={AuctionsListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  tabBarContainer: {
    width: '100%',
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  glassOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 32,
  },
  tabItemsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 2,
    right: 2,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  tabIcon: {
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 26,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
