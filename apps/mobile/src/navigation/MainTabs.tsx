import React, { useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Dimensions,
  LayoutChangeEvent,
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

const TAB_COUNT = TAB_CONFIG.length;

function LiquidGlassTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  // Animated value for the liquid bubble position
  const bubbleAnim = useRef(new Animated.Value(state.index)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const barWidth = useRef(0);

  useEffect(() => {
    // Morph animation — spring for liquid feel
    Animated.parallel([
      Animated.spring(bubbleAnim, {
        toValue: state.index,
        useNativeDriver: false,
        tension: 68,
        friction: 10,
      }),
      // Squish effect during transition
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: false,
          tension: 120,
          friction: 8,
        }),
      ]),
    ]).start();
  }, [state.index]);

  const onBarLayout = (e: LayoutChangeEvent) => {
    barWidth.current = e.nativeEvent.layout.width;
  };

  // Calculate bubble position
  const hPad = 8;
  const bubbleWidth = barWidth.current
    ? (barWidth.current - hPad * 2) / TAB_COUNT
    : 80;

  const bubbleTranslateX = bubbleAnim.interpolate({
    inputRange: Array.from({ length: TAB_COUNT }, (_, i) => i),
    outputRange: Array.from(
      { length: TAB_COUNT },
      (_, i) => hPad + i * bubbleWidth,
    ),
  });

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPadding + 10 }]}>
      <View style={styles.tabBarContainer}>
        {/* Base frosted glass layer */}
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="xlight"
          blurAmount={40}
          reducedTransparencyFallbackColor="#f5f5f5"
        />
        {/* White tint */}
        <View style={[StyleSheet.absoluteFill, styles.glassOverlay]} />

        {/* Tab items row */}
        <View style={styles.tabItemsRow} onLayout={onBarLayout}>
          {/* Liquid glass bubble — animated */}
          {barWidth.current > 0 && (
            <Animated.View
              style={[
                styles.liquidBubble,
                {
                  width: bubbleWidth - 8,
                  transform: [
                    { translateX: bubbleTranslateX },
                    { scaleY: scaleAnim },
                  ],
                },
              ]}
            >
              {/* Extra blur inside bubble for refraction/magnifier feel */}
              <BlurView
                style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                blurType="light"
                blurAmount={20}
                reducedTransparencyFallbackColor="#ffffff"
              />
              {/* Chromatic aberration — multi-color border glow */}
              <View style={styles.chromaticOuter} />
              {/* Inner highlight for depth */}
              <View style={styles.bubbleInnerHighlight} />
            </Animated.View>
          )}

          {/* Tab buttons */}
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
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
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
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  glassOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 34,
  },
  tabItemsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  // ─── Liquid glass bubble ───
  liquidBubble: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    marginLeft: 4,
    borderRadius: 20,
    overflow: 'hidden',
    // Subtle shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0, 0, 0, 0.1)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  // Chromatic aberration ring — rainbow-ish edge glow
  chromaticOuter: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1.5,
    // Gradient-like border using multiple shadow layers isn't possible,
    // so we simulate with a semi-transparent colored border
    borderColor: 'rgba(130, 160, 255, 0.25)',
    backgroundColor: 'transparent',
  },
  // Inner bright highlight (top edge reflection)
  bubbleInnerHighlight: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 1,
  },
  // ─── Tab items ───
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
