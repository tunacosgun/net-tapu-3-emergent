import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { LiquidGlassView } from '../components/LiquidGlassView';

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
      {/* Native iOS Liquid Glass background with animated bubble */}
      <LiquidGlassView
        style={styles.glassBar}
        cornerRadius={34}
        activeIndex={state.index}
        tabCount={TAB_CONFIG.length}
      />

      {/* Tab buttons overlaid on glass */}
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
              <Text
                style={[
                  styles.tabIcon,
                  { opacity: isFocused ? 1 : 0.45 },
                ]}
              >
                {config.icon}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isFocused ? '#000000' : '#1f2937',
                    fontWeight: isFocused ? '700' : '400',
                    opacity: isFocused ? 1 : 0.45,
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
  glassBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 68,
    bottom: 0,
  },
  tabItemsRow: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    zIndex: 10,
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
