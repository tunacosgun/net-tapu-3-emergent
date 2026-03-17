import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
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

function GlassTabBar({ state, descriptors, navigation }: any) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);
  const [barWidth, setBarWidth] = useState(0);

  // Animated bubble position
  const [bubbleAnim] = useState(() => new Animated.Value(state.index));
  const [scaleX] = useState(() => new Animated.Value(1));
  const [scaleY] = useState(() => new Animated.Value(1));

  React.useEffect(() => {
    Animated.parallel([
      // Liquid spring slide
      Animated.spring(bubbleAnim, {
        toValue: state.index,
        useNativeDriver: false,
        tension: 68,
        friction: 10,
      }),
      // Squish: stretch X, compress Y during move
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleX, {
            toValue: 1.12,
            duration: 120,
            useNativeDriver: false,
          }),
          Animated.timing(scaleY, {
            toValue: 0.88,
            duration: 120,
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.spring(scaleX, {
            toValue: 1,
            useNativeDriver: false,
            tension: 120,
            friction: 6,
          }),
          Animated.spring(scaleY, {
            toValue: 1,
            useNativeDriver: false,
            tension: 120,
            friction: 6,
          }),
        ]),
      ]),
    ]).start();
  }, [state.index]);

  const onLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const hPad = 8;
  const itemWidth = barWidth > 0 ? (barWidth - hPad * 2) / TAB_COUNT : 0;

  const bubbleLeft = bubbleAnim.interpolate({
    inputRange: Array.from({ length: TAB_COUNT }, (_, i) => i),
    outputRange: Array.from(
      { length: TAB_COUNT },
      (_, i) => hPad + i * itemWidth + 2,
    ),
  });

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: bottomPadding + 10 }]}>
      <View style={styles.tabBarContainer} onLayout={onLayout}>
        {/* Base frosted glass */}
        <BlurView
          style={StyleSheet.absoluteFill}
          blurType="xlight"
          blurAmount={40}
          reducedTransparencyFallbackColor="#f5f5f5"
        />
        {/* White tint overlay */}
        <View style={[StyleSheet.absoluteFill, styles.glassOverlay]} />

        {/* Animated liquid bubble */}
        {barWidth > 0 && (
          <Animated.View
            style={[
              styles.bubble,
              {
                width: itemWidth - 4,
                left: bubbleLeft,
                transform: [{ scaleX }, { scaleY }],
              },
            ]}
          >
            {/* Extra blur inside bubble for refraction */}
            <BlurView
              style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
              blurType="light"
              blurAmount={15}
              reducedTransparencyFallbackColor="#ffffff"
            />
            {/* Bubble tint */}
            <View style={styles.bubbleTint} />
            {/* Top reflection */}
            <View style={styles.bubbleReflection} />
            {/* Chromatic edge */}
            <View style={styles.bubbleChromatic} />
          </Animated.View>
        )}

        {/* Tab buttons */}
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

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                activeOpacity={0.6}
                style={styles.tabItem}
              >
                <Text
                  style={[
                    styles.tabIcon,
                    { opacity: isFocused ? 1 : 0.4 },
                  ]}
                >
                  {config.icon}
                </Text>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused ? '#000' : '#374151',
                      fontWeight: isFocused ? '700' : '400',
                      opacity: isFocused ? 1 : 0.4,
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
      screenOptions={{ headerShown: false }}
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
      android: { elevation: 16 },
    }),
  },
  glassOverlay: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: 34,
  },
  // ─── Liquid bubble ───
  bubble: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: 22,
    overflow: 'hidden',
    zIndex: 5,
  },
  bubbleTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 22,
  },
  bubbleReflection: {
    position: 'absolute',
    top: 1,
    left: 10,
    right: 10,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 1,
  },
  bubbleChromatic: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(140,170,255,0.2)',
  },
  // ─── Tabs ───
  tabItemsRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    zIndex: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
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
