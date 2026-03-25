import React from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Platform,
  Dimensions,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme';

import HomeScreen from '../screens/home/HomeScreen';
import ParcelsListScreen from '../screens/parcels/ParcelsListScreen';
import AuctionsListScreen from '../screens/auctions/AuctionsListScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Fluid LayoutAnimations for React Native Tab Indicator changes
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Tab = createBottomTabNavigator();

const TAB_CONFIG = [
  { name: 'Home', label: 'Ana Sayfa', icon: 'home', iconOutline: 'home-outline' },
  { name: 'Parcels', label: 'İlanlar', icon: 'grid', iconOutline: 'grid-outline' },
  { name: 'Auctions', label: 'İhaleler', icon: 'flash', iconOutline: 'flash-outline' },
  { name: 'Profile', label: 'Profil', icon: 'person', iconOutline: 'person-outline' },
];

const SCREEN_MAP: Record<string, React.ComponentType<any>> = {
  Home: HomeScreen,
  Parcels: ParcelsListScreen,
  Auctions: AuctionsListScreen,
  Profile: ProfileScreen,
};

/* ─── iOS 18 / HarryPotter API Drop Tab Bar ─── */
function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const screenWidth = Dimensions.get('window').width;
  
  // Floating capsule container at the exact width
  const barWidth = Math.min(screenWidth * 0.94, 420);
  const barHorizontalMargin = (screenWidth - barWidth) / 2;
  const bottomMargin = Platform.OS === 'ios' ? Math.max(insets.bottom - 4, 16) : 20;

  return (
    <View
      style={[
        styles.barContainer,
        {
          bottom: bottomMargin,
          left: barHorizontalMargin,
          width: barWidth,
          // Exactly matching the light gray/white native background
          backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(240,240,245,0.95)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
        },
      ]}
    >
      <View style={styles.tabRow}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG.find(t => t.name === route.name) || TAB_CONFIG[0];

          // iOS 18 Brand Highlight or Classic Native Color
          const activeColor = isDark ? '#34d399' : '#059669'; // Brand Green mapping to the brown from the reference
          const inactiveColor = isDark ? 'rgba(255,255,255,0.5)' : '#6b7280'; // Muted native tint
          
          const iconName = isFocused ? config.icon : config.iconOutline;
          const color = isFocused ? activeColor : inactiveColor;

          const onPress = () => {
            // This replicates the native SwiftUI Tab View fluid sliding animation exactly!
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            
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
              activeOpacity={0.8}
              style={[
                styles.tabItemContainer, 
                // Active item gets a flex boost to accommodate the padding natively
                isFocused && { flex: 1.2 }
              ]}
            >
              <View 
                style={[
                  styles.tabItemBackground,
                  isFocused && {
                    // The dynamic pill wrapper for the active element
                    backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#ffffff',
                    shadowColor: isDark ? '#000' : 'rgba(0,0,0,0.1)',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 1,
                    shadowRadius: 8,
                    elevation: 2,
                  }
                ]}
              >
                <Ionicons 
                  name={iconName} 
                  size={24} 
                  color={color} 
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color,
                      fontWeight: isFocused ? '700' : '500',
                      marginTop: 4,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {config.label}
                </Text>
              </View>
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
    borderRadius: 40,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    // Native Apple heavy drop shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabItemContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The exact pill encapsulation behavior seen in the reference UI
  tabItemBackground: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 30, // Extremely rounded active pill
    width: '100%', 
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
