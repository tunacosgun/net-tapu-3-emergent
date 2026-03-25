import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Platform, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';
import type { RootStackParamList } from '../../navigation/RootNavigator';

const { width, height } = Dimensions.get('window');

const slides = [
  {
    icon: 'map-outline' as const,
    color: '#16a34a',
    gradient: ['#16a34a', '#059669'] as [string, string],
    bg: ['#f0fdf4', '#dcfce7'] as [string, string],
    bgDark: ['#052e16', '#14532d'] as [string, string],
    title: 'Arsa & Gayrimenkul',
    desc: 'Türkiye genelinde binlerce arsa ilanını harita üzerinden keşfedin. Lokasyon, fiyat ve imar durumuna göre filtreleyin.',
  },
  {
    icon: 'flash-outline' as const,
    color: '#dc2626',
    gradient: ['#dc2626', '#b91c1c'] as [string, string],
    bg: ['#fef2f2', '#fecaca'] as [string, string],
    bgDark: ['#450a0a', '#7f1d1d'] as [string, string],
    title: 'Canlı İhale',
    desc: 'Gerçek zamanlı online ihale sistemimizle en iyi fiyatı yakalayın. Anlık teklif verin, süreyi takip edin.',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    color: '#2563eb',
    gradient: ['#2563eb', '#1d4ed8'] as [string, string],
    bg: ['#eff6ff', '#bfdbfe'] as [string, string],
    bgDark: ['#172554', '#1e3a5f'] as [string, string],
    title: 'Güvenli Ödeme',
    desc: 'Kaparo ve ödeme işlemleriniz SSL ve 3D Secure ile korunur. Tüm işlemler yasal güvence altındadır.',
  },
];

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const isDark = theme.isDark;
  const scrollX = useRef(new Animated.Value(0)).current;

  async function handleDone() {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('Login');
  }

  function handleNext() {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      handleDone();
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <TouchableOpacity onPress={handleDone} style={styles.skipBtn}>
        <Text style={[styles.skipText, { color: theme.colors.textMuted }]}>Atla</Text>
      </TouchableOpacity>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(e) => {
          setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        renderItem={({ item, index }) => {
          const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
          const scale = scrollX.interpolate({ inputRange, outputRange: [0.8, 1, 0.8], extrapolate: 'clamp' });
          const opacity = scrollX.interpolate({ inputRange, outputRange: [0.4, 1, 0.4], extrapolate: 'clamp' });

          return (
            <View style={[styles.slide, { width }]}>
              <Animated.View style={{ transform: [{ scale }], opacity }}>
                {/* Triple ring icon container */}
                <View style={styles.iconArea}>
                  <View style={[styles.outerRing, { borderColor: `${item.color}10` }]}>
                    <View style={[styles.middleRing, { borderColor: `${item.color}20` }]}>
                      <LinearGradient
                        colors={item.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.iconGradient}
                      >
                        <Ionicons name={item.icon} size={48} color="#fff" />
                      </LinearGradient>
                    </View>
                  </View>
                </View>
              </Animated.View>
              <Text style={[styles.title, { color: theme.colors.text }]}>{item.title}</Text>
              <Text style={[styles.desc, { color: theme.colors.textSecondary }]}>{item.desc}</Text>
            </View>
          );
        }}
        keyExtractor={(_, i) => String(i)}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {slides.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 32, 8], extrapolate: 'clamp' });
          const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: theme.colors.primary,
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity
          onPress={handleNext}
          style={{ borderRadius: 18, overflow: 'hidden', flex: 1 }}
        >
          <LinearGradient
            colors={['#16a34a', '#15803d']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextBtn}
          >
            <Text style={styles.nextText}>
              {activeIndex === slides.length - 1 ? 'Başlayalım' : 'Devam'}
            </Text>
            <View style={styles.nextArrow}>
              <Ionicons name="arrow-forward" size={18} color="#16a34a" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Step indicator */}
      <Text style={[styles.stepText, { color: theme.colors.textMuted }]}>
        {activeIndex + 1} / {slides.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: Platform.OS === 'ios' ? 50 : 30 },
  skipBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 24, zIndex: 10 },
  skipText: { fontSize: 15, fontWeight: '600' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },

  // Icon area with rings
  iconArea: { marginBottom: 40, alignItems: 'center' },
  outerRing: {
    width: 200, height: 200, borderRadius: 100, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  middleRing: {
    width: 170, height: 170, borderRadius: 85, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  iconGradient: {
    width: 120, height: 120, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },

  title: { fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 14, letterSpacing: -0.5 },
  desc: { fontSize: 16, textAlign: 'center', lineHeight: 24, paddingHorizontal: 10 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 28 },
  dot: { height: 8, borderRadius: 4 },

  bottomRow: { paddingHorizontal: 24 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  nextText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  nextArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepText: { textAlign: 'center', fontSize: 12, fontWeight: '500', marginTop: 16 },
});
