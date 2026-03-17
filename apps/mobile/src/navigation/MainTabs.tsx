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

// SVG-like path icons using unicode + custom rendering
const TAB_CONFIG = [
  { name: 'Home', label: 'Ana Sayfa', icon: '⌂', iconFocused: '⌂' },
  { name: 'Parcels', label: 'İlanlar', icon: '⊞', iconFocused: '⊞' },
  { name: 'Auctions', label: 'İhaleler', icon: '⚡', iconFocused: '⚡' },
  { name: 'Profile', label: 'Profil', icon: '◉', iconFocused: '◉' },
];

function GlassTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPadding + 10 }]}>
      <View style={styles.tabBarContainer}>
        {/* Glassmorphism Background */}
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={theme.isDark ? 'thinMaterialDark' : 'systemThinMaterial'}
          blurAmount={40}
          reducedTransparencyFallbackColor={theme.isDark ? '#1e293b' : '#f8f9fa'}
        />
        {/* Glass overlay with inner glow */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: theme.isDark
                ? 'rgba(30, 41, 59, 0.35)'
                : 'rgba(255, 255, 255, 0.3)',
              borderWidth: 0.5,
              borderColor: theme.isDark
                ? 'rgba(255, 255, 255, 0.15)'
                : 'rgba(255, 255, 255, 0.7)',
              borderRadius: 32,
            },
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
                activeOpacity={0.7}
                style={styles.tabItem}
              >
                {/* Active indicator pill */}
                {isFocused && (
                  <View
                    style={[
                      styles.activeIndicator,
                      { backgroundColor: theme.colors.primary + '18' },
                    ]}
                  />
                )}

                {/* Icon */}
                <View
                  style={[
                    styles.iconWrap,
                    isFocused && [
                      styles.iconWrapActive,
                      { backgroundColor: theme.colors.primary + '20' },
                    ],
                  ]}
                >
                  <TabIconSVG
                    name={config.name}
                    focused={isFocused}
                    color={
                      isFocused
                        ? theme.colors.primary
                        : theme.isDark
                          ? '#94a3b8'
                          : '#6b7280'
                    }
                  />
                </View>

                {/* Label */}
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused
                        ? theme.colors.primary
                        : theme.isDark
                          ? '#94a3b8'
                          : '#6b7280',
                      fontWeight: isFocused ? '700' : '500',
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

/** Custom icon component with proper vector-like rendering */
function TabIconSVG({
  name,
  focused,
  color,
}: {
  name: string;
  focused: boolean;
  color: string;
}) {
  const size = 24;

  // Using Text-based icons with proper styling for a clean look
  const iconMap: Record<string, { char: string; size: number }> = {
    Home: { char: '🏠', size: 21 },
    Parcels: { char: '🗺️', size: 20 },
    Auctions: { char: '⚡', size: 22 },
    Profile: { char: '👤', size: 20 },
  };

  const icon = iconMap[name] || { char: '•', size };

  return (
    <Text
      style={{
        fontSize: icon.size,
        opacity: focused ? 1 : 0.8,
        textAlign: 'center',
        lineHeight: size + 2,
      }}
    >
      {icon.char}
    </Text>
  );
}

export default function MainTabs() {
  const theme = useTheme();

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
    paddingHorizontal: 40,
  },
  tabBarContainer: {
    width: '100%',
    maxWidth: 340,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabItemsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    left: 4,
    right: 4,
    borderRadius: 20,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  iconWrapActive: {
    transform: [{ scale: 1.08 }],
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.1,
  },
});
