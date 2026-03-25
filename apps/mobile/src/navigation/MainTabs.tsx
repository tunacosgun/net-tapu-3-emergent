import React, { useRef, useEffect } from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme';

import HomeScreen from '../screens/home/HomeScreen';
import ParcelsListScreen from '../screens/parcels/ParcelsListScreen';
import AuctionsListScreen from '../screens/auctions/AuctionsListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Home', label: 'Ana Sayfa', icon: 'home', iconOutline: 'home-outline' },
  { name: 'Parcels', label: 'İlanlar', icon: 'map', iconOutline: 'map-outline' },
  { name: 'Auctions', label: 'İhaleler', icon: 'flash', iconOutline: 'flash-outline' },
  { name: 'Profile', label: 'Profil', icon: 'person', iconOutline: 'person-outline' },
];

const SCREEN_MAP: Record<string, React.ComponentType<any>> = {
  Home: HomeScreen,
  Parcels: ParcelsListScreen,
  Auctions: AuctionsListScreen,
  Profile: ProfileScreen,
};

/* ─── Custom Glass Tab Bar ─── */
function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors: c, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabCount = state.routes.length;

  // Animated bubble position
  const bubbleAnim = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(bubbleAnim, {
      toValue: state.index,
      useNativeDriver: true,
      damping: 18,
      stiffness: 200,
      mass: 0.8,
    }).start();
  }, [state.index]);

  const screenWidth = Dimensions.get('window').width;
  const barHorizontalMargin = 20;
  const barWidth = screenWidth - barHorizontalMargin * 2;
  const tabWidth = barWidth / tabCount;
  const bubblePadding = 8;
  const bubbleWidth = tabWidth - bubblePadding * 2;

  const translateX = bubbleAnim.interpolate({
    inputRange: Array.from({ length: tabCount }, (_, i) => i),
    outputRange: Array.from({ length: tabCount }, (_, i) => i * tabWidth + bubblePadding),
  });

  const barHeight = Platform.OS === 'ios' ? 64 : 60;
  const bottomMargin = Platform.OS === 'ios' ? Math.max(insets.bottom - 8, 8) : 12;

  return (
    <View
      style={[
        styles.barContainer,
        {
          bottom: bottomMargin,
          left: barHorizontalMargin,
          right: barHorizontalMargin,
          height: barHeight,
        },
      ]}
    >
      {/* Glass background */}
      <View style={styles.blurContainer}>
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType={
            Platform.OS === 'ios'
              ? isDark ? 'thinMaterialDark' : 'thinMaterial'
              : isDark ? 'dark' : 'light'
          }
          blurAmount={Platform.OS === 'ios' ? 50 : 32}
          reducedTransparencyFallbackColor={
            isDark ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)'
          }
        />
        {/* Light tint overlay for glass look */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(40,40,40,0.3)'
                : 'rgba(255,255,255,0.45)',
            },
          ]}
        />
        {/* Subtle top border for glass edge */}
        <View
          style={[
            styles.topBorder,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(255,255,255,0.7)',
            },
          ]}
        />
      </View>

      {/* Animated selection bubble */}
      <Animated.View
        style={[
          styles.bubble,
          {
            width: bubbleWidth,
            height: barHeight - 16,
            transform: [{ translateX }],
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.12)'
              : 'rgba(0,0,0,0.06)',
          },
        ]}
      />

      {/* Tab items */}
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG.find(t => t.name === route.name) || TAB_CONFIG[0];

          const iconName = isFocused ? config.icon : config.iconOutline;
          const color = isFocused
            ? (isDark ? '#ffffff' : '#000000')
            : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)');

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <Ionicons name={iconName} size={22} color={color} />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: isFocused ? '600' : '400',
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

/* ─── Main Tabs Navigator ─── */
export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={SCREEN_MAP[tab.name]}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    position: 'absolute',
    borderRadius: 32,
    overflow: 'hidden',
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    overflow: 'hidden',
  },
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  bubble: {
    position: 'absolute',
    top: 8,
    left: 0,
    borderRadius: 22,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.1,
  },
});
