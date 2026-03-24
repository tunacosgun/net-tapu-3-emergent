import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';
import { StatusBadge } from '../ui/Badge';
import { formatPrice, formatArea, resolveImageUrl } from '../../lib/format';
import type { Parcel } from '../../types';

interface ParcelCardProps {
  parcel: Parcel;
  onPress: () => void;
  compact?: boolean;
  featured?: boolean;
}

export function ParcelCard({ parcel, onPress, compact = false, featured = false }: ParcelCardProps) {
  const { colors: c, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const coverImage = parcel.images?.find((i) => i.isCover) || parcel.images?.[0];
  const imageUrl = coverImage ? resolveImageUrl(coverImage) : null;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, friction: 8, tension: 100, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
  };

  // ── Compact variant ──
  if (compact) {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
          activeOpacity={0.9}
          style={[styles.compactCard, {
            backgroundColor: isDark ? c.card : '#fff',
            shadowColor: isDark ? '#000' : '#64748b',
          }]}
        >
          <View style={styles.compactImageWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.compactImage} />
            ) : (
              <View style={[styles.compactImage, styles.placeholder, { backgroundColor: isDark ? c.surface : '#f1f5f9' }]}>
                <Ionicons name="image-outline" size={20} color={c.textMuted} />
              </View>
            )}
          </View>
          <View style={styles.compactInfo}>
            <Text style={[styles.compactTitle, { color: c.text }]} numberOfLines={1}>{parcel.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="location-outline" size={11} color={c.textMuted} />
              <Text style={[styles.compactLoc, { color: c.textMuted }]} numberOfLines={1}>
                {parcel.city}, {parcel.district}
              </Text>
            </View>
            <Text style={[styles.compactPrice, { color: c.text }]}>{formatPrice(parcel.price)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.textMuted} style={{ marginRight: 14 }} />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Featured variant: big hero card ──
  if (featured) {
    return (
      <Animated.View style={[{ transform: [{ scale }] }]}>
        <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
          activeOpacity={0.95}
          style={[styles.featuredCard, {
            backgroundColor: isDark ? c.card : '#fff',
            shadowColor: isDark ? '#000' : '#1e293b',
          }]}
        >
          <View style={styles.featuredImageWrap}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.featuredImage} />
            ) : (
              <View style={[styles.featuredImage, styles.placeholder, { backgroundColor: isDark ? c.surface : '#f1f5f9' }]}>
                <Ionicons name="image-outline" size={48} color={c.textMuted} />
              </View>
            )}
            {/* Gradient overlay — bottom half for text readability */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              locations={[0.3, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Status badge top-left */}
            <View style={styles.featuredBadge}>
              <StatusBadge status={parcel.status} />
            </View>
            {/* Price overlay bottom-left */}
            <View style={styles.featuredBottom}>
              <Text style={styles.featuredPriceText}>{formatPrice(parcel.price)}</Text>
              {parcel.areaM2 && parcel.price && (
                <Text style={styles.featuredPricePerM2}>
                  {formatPrice(String(Math.round(parseFloat(parcel.price) / parseFloat(parcel.areaM2))))}/m²
                </Text>
              )}
            </View>
          </View>
          <View style={styles.featuredContent}>
            <Text style={[styles.featuredTitle, { color: c.text }]} numberOfLines={2}>{parcel.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
              <Ionicons name="location" size={13} color={c.primary} />
              <Text style={[styles.featuredLoc, { color: c.textSecondary }]} numberOfLines={1}>
                {parcel.city}, {parcel.district}
              </Text>
            </View>
            {/* Detail chips */}
            <View style={styles.featuredDetailRow}>
              {parcel.areaM2 && (
                <View style={[styles.chip, { backgroundColor: isDark ? c.surface : '#f0fdf4' }]}>
                  <Ionicons name="resize-outline" size={12} color={c.primary} />
                  <Text style={[styles.chipText, { color: isDark ? c.text : '#166534' }]}>{formatArea(parcel.areaM2)}</Text>
                </View>
              )}
              {parcel.zoningStatus && (
                <View style={[styles.chip, { backgroundColor: isDark ? c.surface : '#f8fafc' }]}>
                  <Text style={[styles.chipText, { color: c.textSecondary }]}>{parcel.zoningStatus}</Text>
                </View>
              )}
              {parcel.ada && parcel.parsel && (
                <View style={[styles.chip, { backgroundColor: isDark ? c.surface : '#f8fafc' }]}>
                  <Text style={[styles.chipText, { color: c.textSecondary }]}>{parcel.ada}/{parcel.parsel}</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── Default card — with depth ──
  const detailText = [
    parcel.areaM2 ? formatArea(parcel.areaM2) : null,
    parcel.zoningStatus || null,
  ].filter(Boolean).join(' · ');

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}
        activeOpacity={0.95}
        style={[styles.card, {
          backgroundColor: isDark ? c.card : '#fff',
          shadowColor: isDark ? '#000' : '#64748b',
        }]}
      >
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.image, styles.placeholder, { backgroundColor: isDark ? c.surface : '#f1f5f9' }]}>
              <Ionicons name="image-outline" size={32} color={c.textMuted} />
            </View>
          )}
          {/* Bottom gradient for depth */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.25)']}
            locations={[0.5, 1]}
            style={styles.imageGradient}
          />
          <View style={styles.badgePos}>
            <StatusBadge status={parcel.status} />
          </View>
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>{parcel.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 }}>
            <Ionicons name="location" size={12} color={c.primary} />
            <Text style={[styles.location, { color: c.textSecondary }]} numberOfLines={1}>
              {parcel.city}, {parcel.district}
            </Text>
          </View>
          {detailText ? (
            <Text style={[styles.detail, { color: c.textMuted }]} numberOfLines={1}>{detailText}</Text>
          ) : null}
          {/* Price — hero element with background */}
          <View style={[styles.priceBadge, { backgroundColor: isDark ? c.primaryBg : '#f0fdf4' }]}>
            <Text style={[styles.price, { color: isDark ? c.primary : '#166534' }]}>{formatPrice(parcel.price)}</Text>
            {parcel.areaM2 && parcel.price && (
              <Text style={[styles.pricePerM2, { color: c.textMuted }]}>
                {formatPrice(String(Math.round(parseFloat(parcel.price) / parseFloat(parcel.areaM2))))}/m²
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const SHADOW = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  android: { elevation: 6 },
}) as any;

const SHADOW_SM = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
}) as any;

const SHADOW_LG = Platform.select({
  ios: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
  },
  android: { elevation: 8 },
}) as any;

const styles = StyleSheet.create({
  // ── Default card — with shadow for depth ──
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    ...SHADOW,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 200, resizeMode: 'cover' },
  imageGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  badgePos: { position: 'absolute', top: 12, left: 12 },
  content: { padding: 18 },
  title: { fontSize: 17, fontWeight: '700', lineHeight: 23, letterSpacing: -0.3, marginBottom: 4 },
  location: { fontSize: 13, fontWeight: '500' },
  detail: { fontSize: 12, fontWeight: '400', marginBottom: 12 },
  priceBadge: {
    marginTop: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
  },
  price: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  pricePerM2: { fontSize: 12, fontWeight: '500' },

  // ── Compact variant ──
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    ...SHADOW_SM,
  },
  compactImageWrap: { borderRadius: 16, overflow: 'hidden' },
  compactImage: { width: 86, height: 86, resizeMode: 'cover' },
  compactInfo: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 3 },
  compactTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  compactLoc: { fontSize: 12, fontWeight: '400' },
  compactPrice: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 3 },

  // ── Featured variant ──
  featuredCard: {
    borderRadius: 24,
    overflow: 'hidden',
    ...SHADOW_LG,
  },
  featuredImageWrap: { position: 'relative' },
  featuredImage: { width: '100%', height: 280, resizeMode: 'cover' },
  featuredBadge: { position: 'absolute', top: 16, left: 16 },
  featuredBottom: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
  },
  featuredPriceText: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  featuredPricePerM2: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '500', marginTop: 2 },
  featuredContent: { padding: 20 },
  featuredTitle: { fontSize: 19, fontWeight: '700', lineHeight: 26, letterSpacing: -0.3 },
  featuredLoc: { fontSize: 14, fontWeight: '500' },
  featuredDetailRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  chipText: { fontSize: 12, fontWeight: '600' },
});
