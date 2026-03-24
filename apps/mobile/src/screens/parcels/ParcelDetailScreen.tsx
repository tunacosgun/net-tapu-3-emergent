import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, FlatList,
  Dimensions, Share, Alert, Linking, Platform,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice, formatArea, resolveImageUrl, formatDate } from '../../lib/format';
import { StatusBadge, Skeleton } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { Parcel, ParcelImage } from '../../types';

const { width } = Dimensions.get('window');

export default function ParcelDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ParcelDetail'>>();
  const navigation = useNavigation();
  const { colors: c, isDark } = useTheme();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [images, setImages] = useState<ParcelImage[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await apiClient.get<Parcel>(`/parcels/${route.params.id}`);
        setParcel(data);
        setImages(data.images || []);
      } catch { navigation.goBack(); }
    }
    load();
  }, [route.params.id]);

  async function toggleFavorite() {
    if (!parcel) return;
    try {
      if (isFavorite) { await apiClient.delete(`/favorites/${parcel.id}`); }
      else { await apiClient.post('/favorites', { parcelId: parcel.id }); }
      setIsFavorite(!isFavorite);
    } catch {}
  }

  async function handleShare() {
    if (!parcel) return;
    try {
      await Share.share({
        message: `${parcel.title}\n${parcel.city}, ${parcel.district}\n${formatPrice(parcel.price)}`,
      });
    } catch {}
  }

  if (!parcel) return (
    <View style={[styles.loading, { backgroundColor: c.background }]}>
      <View style={{ padding: 20 }}>
        <Skeleton width="100%" height={340} borderRadius={0} />
        <View style={{ marginTop: 20, gap: 10 }}>
          <Skeleton width="60%" height={20} />
          <Skeleton width="80%" height={16} />
          <Skeleton width="40%" height={28} style={{ marginTop: 10 }} />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Gallery */}
        <View style={styles.gallery}>
          <FlatList
            data={images}
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setImageIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image source={{ uri: resolveImageUrl(item) }} style={{ width, height: 360 }} resizeMode="cover" />
            )}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={[styles.noImage, { backgroundColor: isDark ? c.surface : '#f8fafc' }]}>
                <Ionicons name="image-outline" size={48} color={c.textMuted} />
              </View>
            }
          />
          <View style={[styles.topGradient, { backgroundColor: 'rgba(0,0,0,0.2)' }]} />
          <View style={[styles.bottomGradient, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />

          {/* Dot pagination */}
          {images.length > 1 && (
            <View style={styles.dotsRow}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.galleryDot,
                    { backgroundColor: i === imageIndex ? '#fff' : 'rgba(255,255,255,0.4)' },
                    i === imageIndex && { width: 20 },
                  ]}
                />
              ))}
            </View>
          )}

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topActions}>
            <TouchableOpacity onPress={handleShare} style={styles.topActionBtn}>
              <Ionicons name="share-outline" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleFavorite} style={[styles.topActionBtn, isFavorite && { backgroundColor: 'rgba(220,38,38,0.6)' }]}>
              <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.content}>
          <StatusBadge status={parcel.status} />
          <Text style={[styles.title, { color: c.text }]}>{parcel.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 20 }}>
            <Ionicons name="location-outline" size={14} color={c.textMuted} />
            <Text style={[styles.location, { color: c.textMuted }]}>
              {parcel.city}, {parcel.district}{parcel.neighborhood ? `, ${parcel.neighborhood}` : ''}
            </Text>
          </View>

          {/* Price */}
          <View
            style={[styles.priceSection, {
              backgroundColor: isDark ? 'rgba(74,222,128,0.06)' : '#f0fdf4',
              borderColor: isDark ? c.borderLight : '#dcfce7',
            }]}
          >
            <View>
              <Text style={[styles.priceLabel, { color: c.textMuted }]}>FİYAT</Text>
              <Text style={[styles.price, { color: c.primary }]}>{formatPrice(parcel.price)}</Text>
            </View>
            {parcel.pricePerM2 && (
              <View>
                <Text style={[styles.priceLabel, { color: c.textMuted }]}>m² BİRİM</Text>
                <Text style={[styles.pricePerM2, { color: c.text }]}>{formatPrice(parcel.pricePerM2)}</Text>
              </View>
            )}
          </View>

          {/* Details */}
          <View style={[styles.detailsCard, { backgroundColor: c.card, borderColor: isDark ? c.borderLight : c.border }]}>
            <Text style={[styles.sectionTitle, { color: c.text }]}>İlan Bilgileri</Text>
            {[
              { label: 'Alan', value: formatArea(parcel.areaM2), icon: 'resize-outline' },
              { label: 'Ada / Parsel', value: parcel.ada && parcel.parsel ? `${parcel.ada} / ${parcel.parsel}` : '—', icon: 'grid-outline' },
              { label: 'İmar Durumu', value: parcel.zoningStatus || '—', icon: 'construct-outline' },
              { label: 'Arsa Tipi', value: parcel.landType || '—', icon: 'layers-outline' },
              { label: 'İlan No', value: parcel.listingId, icon: 'barcode-outline' },
              { label: 'İlan Tarihi', value: parcel.listedAt ? formatDate(parcel.listedAt, 'date') : '—', icon: 'calendar-outline' },
            ].map((row, i, arr) => (
              <View key={row.label} style={[
                styles.detailRow,
                { backgroundColor: i % 2 === 0 ? (isDark ? 'rgba(255,255,255,0.02)' : '#fafbfc') : 'transparent' },
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? c.borderLight : '#f1f5f9' },
              ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={row.icon as any} size={15} color={c.textMuted} />
                  <Text style={[styles.detailLabel, { color: c.textSecondary }]}>{row.label}</Text>
                </View>
                <Text style={[styles.detailValue, { color: c.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {parcel.description && (
            <View style={[styles.detailsCard, { backgroundColor: c.card, borderColor: isDark ? c.borderLight : c.border }]}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Açıklama</Text>
              <Text style={[styles.description, { color: c.textSecondary }]}>{parcel.description}</Text>
            </View>
          )}

          {/* CTA */}
          <View style={{ marginTop: 8, gap: 10, paddingBottom: 40 }}>
            <TouchableOpacity
              onPress={() => Alert.alert('Sizi Arayalım', 'İletişim formu yakında aktif olacak.')}
              style={[styles.ctaBtn, { backgroundColor: c.primary }]}
              activeOpacity={0.85}
            >
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.ctaBtnText}>Sizi Arayalım</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(`${parcel.title}\n${parcel.city}, ${parcel.district}\n${formatPrice(parcel.price)}`)}`)}
              style={[styles.whatsappBtn, { borderColor: isDark ? c.borderLight : '#dcfce7', backgroundColor: isDark ? c.surface : '#f0fdf4' }]}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#25d366" />
              <Text style={[styles.whatsappText, { color: c.text }]}>WhatsApp ile İletişim</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1 },

  gallery: { position: 'relative' },
  noImage: { width, height: 360, alignItems: 'center', justifyContent: 'center' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 120 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  dotsRow: {
    position: 'absolute', bottom: 20, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  galleryDot: {
    width: 6, height: 6, borderRadius: 3,
  },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, left: 16,
    width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  topActions: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, right: 16,
    flexDirection: 'row', gap: 8,
  },
  topActionBtn: {
    width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '800', marginTop: 10, letterSpacing: -0.4, lineHeight: 30 },
  location: { fontSize: 14, fontWeight: '400' },

  priceSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 20, paddingHorizontal: 18, borderRadius: 16, borderWidth: 1, marginBottom: 24,
  },
  priceLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  price: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  pricePerM2: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },

  detailsCard: { borderRadius: 20, borderWidth: 1, padding: 18, marginBottom: 14, overflow: 'hidden' },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 12, letterSpacing: -0.2 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8,
  },
  detailLabel: { fontSize: 14, fontWeight: '400' },
  detailValue: { fontSize: 14, fontWeight: '700' },
  description: { fontSize: 15, fontWeight: '400', lineHeight: 24 },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 17, gap: 8,
  },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  whatsappBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 16, borderWidth: 1, gap: 8,
  },
  whatsappText: { fontSize: 16, fontWeight: '600' },
});
