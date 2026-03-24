import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Image, Animated, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/auth-store';
import { formatPrice, resolveImageUrl } from '../../lib/format';
import { StatusBadge, SkeletonParcelCard, SkeletonAuctionCard } from '../../components/ui';
import { ParcelCard } from '../../components/parcel/ParcelCard';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { Parcel, Auction, PaginatedResponse } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { colors: c, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [featured, setFeatured] = useState<Parcel[]>([]);
  const [latest, setLatest] = useState<Parcel[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [stats, setStats] = useState({ parcels: 0, auctions: 0, cities: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  async function loadData() {
    try {
      const [featuredRes, latestRes, auctionRes, profileRes] = await Promise.all([
        apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { isFeatured: true, limit: 6, status: 'active' } }),
        apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { limit: 6, sortBy: 'createdAt', sortOrder: 'DESC', status: 'active' } }),
        apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 5 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/auth/me').catch(() => ({ data: null })),
      ]);
      setFeatured(featuredRes.data.data);
      setLatest(latestRes.data.data);
      const allAuctions = auctionRes.data.data || [];
      setAuctions(allAuctions.filter((a: Auction) => ['live', 'scheduled', 'deposit_open'].includes(a.status)));

      // Stats
      const totalParcels = (featuredRes.data as any).total || featuredRes.data.data.length;
      const totalAuctions = (auctionRes.data as any).total || allAuctions.length;
      const cities = new Set([...featuredRes.data.data, ...latestRes.data.data].map((p: Parcel) => p.city).filter(Boolean));
      setStats({ parcels: totalParcels, auctions: totalAuctions, cities: cities.size });

      if (profileRes.data) setProfile(profileRes.data);
    } catch {}
    setLoading(false);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }

  async function onRefresh() { setRefreshing(true); await loadData(); setRefreshing(false); }
  useEffect(() => { loadData(); }, []);

  const userName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ''}`.trim()
    : user?.email?.split('@')[0] || 'Kullanıcı';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return 'İyi geceler';
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const getAuctionTimeLeft = (auction: Auction) => {
    const endDate = (auction as any).extendedUntil || (auction as any).scheduledEnd;
    if (!endDate) return null;
    const ms = new Date(endDate).getTime() - Date.now();
    if (ms <= 0) return 'Bitti';
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}g ${h}s`;
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 0) return `${h}s ${m}dk`;
    return `${m}dk`;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Professional Header ── */}
        <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatarContainer, { backgroundColor: c.primary }]}>
              <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.greetingSmall, { color: c.textMuted }]}>{getGreeting()}</Text>
              <Text style={[styles.userName, { color: c.text }]}>{userName}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={[styles.headerBtn, { backgroundColor: isDark ? c.surface : '#f8fafc' }]}
            >
              <Ionicons name="notifications-outline" size={20} color={c.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero Banner ── */}
        <LinearGradient
          colors={isDark ? ['#064e3b', '#065f46', '#047857'] : ['#ecfdf5', '#d1fae5', '#a7f3d0']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroContent}>
            <Text style={[styles.heroLabel, { color: isDark ? '#6ee7b7' : '#047857' }]}>NetTapu</Text>
            <Text style={[styles.heroTitle, { color: isDark ? '#fff' : '#064e3b' }]}>Hayalinizdeki{'\n'}arsayı bulun</Text>
            <Text style={[styles.heroSubtitle, { color: isDark ? '#a7f3d0' : '#065f46' }]}>
              Türkiye genelinde {stats.parcels > 0 ? stats.parcels : ''} arsa ilanı
            </Text>
          </View>
          <View style={styles.heroDecor}>
            <Ionicons name="business" size={80} color={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(4,120,87,0.08)'} />
          </View>
        </LinearGradient>

        {/* ── Search Bar ── */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
          style={[styles.searchBar, {
            backgroundColor: isDark ? c.surface : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
            shadowColor: isDark ? '#000' : '#64748b',
          }]}
        >
          <Ionicons name="search" size={18} color={c.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: c.textMuted }]}>İl, ilçe veya arsa ara...</Text>
          <View style={[styles.searchFilter, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}>
            <Ionicons name="options-outline" size={16} color={c.textSecondary} />
          </View>
        </TouchableOpacity>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Aktif İlan', value: stats.parcels, icon: 'document-text', color: '#10b981' },
            { label: 'İhale', value: stats.auctions, icon: 'flash', color: '#f59e0b' },
            { label: 'İl', value: stats.cities, icon: 'location', color: '#6366f1' },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, {
              backgroundColor: isDark ? c.surface : '#fff',
              shadowColor: isDark ? '#000' : '#94a3b8',
            }]}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '15' }]}>
                <Ionicons name={s.icon as any} size={16} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: c.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Quick Actions ── */}
        <View style={styles.actionsRow}>
          {[
            { label: 'İlanlar', icon: 'map-outline', onPress: () => navigation.navigate('Main', { screen: 'Parcels' } as any) },
            { label: 'İhaleler', icon: 'flash-outline', onPress: () => navigation.navigate('Main', { screen: 'Auctions' } as any) },
            { label: 'Favoriler', icon: 'heart-outline', onPress: () => navigation.navigate('Favorites') },
            { label: 'Harita', icon: 'navigate-outline', onPress: () => navigation.navigate('ParcelMap') },
          ].map((item) => (
            <TouchableOpacity key={item.label} onPress={item.onPress} style={styles.actionBtn} activeOpacity={0.7}>
              <View style={[styles.actionIcon, {
                backgroundColor: isDark ? c.surface : '#f8fafc',
                shadowColor: isDark ? '#000' : '#94a3b8',
              }]}>
                <Ionicons name={item.icon as any} size={22} color={c.textSecondary} />
              </View>
              <Text style={[styles.actionLabel, { color: c.textSecondary }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {/* ── Featured Parcels ── */}
          {loading ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
              <SkeletonParcelCard />
            </View>
          ) : featured.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Öne Çıkan"
                desc="Editör seçimi premium araziler"
                colors={c}
                onSeeAll={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
              />
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <ParcelCard
                  parcel={featured[0]}
                  onPress={() => navigation.navigate('ParcelDetail', { id: featured[0].id })}
                  featured
                />
              </View>
              {featured.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
                  decelerationRate="fast"
                  snapToInterval={width * 0.72 + 14}
                  snapToAlignment="start"
                >
                  {featured.slice(1).map((item) => (
                    <View key={item.id} style={{ width: width * 0.72 }}>
                      <ParcelCard parcel={item} onPress={() => navigation.navigate('ParcelDetail', { id: item.id })} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {/* ── Live Auctions ── */}
          {loading ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
              <SkeletonAuctionCard />
            </View>
          ) : auctions.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Canlı İhaleler"
                desc="Aktif açık artırmalar"
                colors={c}
                live
                onSeeAll={() => navigation.navigate('Main', { screen: 'Auctions' } as any)}
              />
              {auctions.map((a) => {
                const timeLeft = getAuctionTimeLeft(a);
                const imageUri = a.parcel?.images?.[0] ? resolveImageUrl(a.parcel.images[0]) : null;
                const isLive = a.status === 'live';
                return (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => navigation.navigate('LiveAuction', { id: a.id })}
                    activeOpacity={0.85}
                    style={[styles.auctionCard, {
                      backgroundColor: isDark ? c.card : '#fff',
                      shadowColor: isDark ? '#000' : '#64748b',
                    }]}
                  >
                    <View style={styles.auctionImgWrap}>
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.auctionImg} />
                      ) : (
                        <View style={[styles.auctionImg, { backgroundColor: isDark ? c.surface : '#f8fafc', alignItems: 'center', justifyContent: 'center' }]}>
                          <Ionicons name="business-outline" size={22} color={c.textMuted} />
                        </View>
                      )}
                      {isLive && (
                        <View style={styles.liveTag}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveText}>CANLI</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.auctionInfo}>
                      <Text style={[styles.auctionTitle, { color: c.text }]} numberOfLines={1}>
                        {a.parcel?.title || a.title || `İhale #${a.id.slice(0, 8)}`}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <StatusBadge status={a.status} size="sm" />
                        {timeLeft && <Text style={[styles.timeText, { color: c.textMuted }]}>{timeLeft}</Text>}
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.auctionPrice, { color: c.text }]}>
                          {formatPrice(a.currentPrice || a.startingPrice)}
                        </Text>
                        <Text style={[styles.bidCount, { color: c.textMuted }]}>{a.bidCount} teklif</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* ── Latest Parcels ── */}
          {loading ? (
            <View style={{ paddingHorizontal: 20 }}>
              <SkeletonParcelCard />
              <SkeletonParcelCard />
            </View>
          ) : latest.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Son Eklenenler"
                desc="Yeni eklenen arazi ilanları"
                colors={c}
              />
              <View style={{ paddingHorizontal: 20 }}>
                {latest.map((p) => (
                  <ParcelCard key={p.id} parcel={p} onPress={() => navigation.navigate('ParcelDetail', { id: p.id })} compact />
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, desc, colors: c, live, onSeeAll }: {
  title: string; desc: string; colors: any; live?: boolean;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text>
          {live && (
            <View style={styles.liveBadge}>
              <View style={styles.liveBadgeDot} />
              <Text style={styles.liveBadgeText}>CANLI</Text>
            </View>
          )}
        </View>
        <Text style={[styles.sectionDesc, { color: c.textMuted }]}>{desc}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7}
          style={[styles.seeAllBtn, { backgroundColor: c.primaryBg }]}
        >
          <Text style={[styles.seeAllText, { color: c.primary }]}>Tümü</Text>
          <Ionicons name="chevron-forward" size={14} color={c.primary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const SHADOW_SM = Platform.select({
  ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  android: { elevation: 3 },
}) as any;

const styles = StyleSheet.create({
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { flexDirection: 'row', gap: 8 },
  avatarContainer: {
    width: 42, height: 42, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  greetingSmall: { fontSize: 12, fontWeight: '400' },
  userName: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },

  // Hero Banner
  heroBanner: {
    marginHorizontal: 20, marginTop: 16, borderRadius: 20,
    padding: 24, overflow: 'hidden', position: 'relative',
  },
  heroContent: { zIndex: 1 },
  heroLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.6, lineHeight: 34, marginBottom: 8 },
  heroSubtitle: { fontSize: 14, fontWeight: '500' },
  heroDecor: { position: 'absolute', right: -10, bottom: -10 },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 50, borderRadius: 14, paddingHorizontal: 14,
    borderWidth: 1, marginHorizontal: 20, marginTop: 16,
    ...SHADOW_SM,
  },
  searchPlaceholder: { fontSize: 14, fontWeight: '400', flex: 1 },
  searchFilter: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginTop: 20, marginBottom: 24 },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16,
    ...SHADOW_SM,
  },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Quick actions
  actionsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 32 },
  actionBtn: { flex: 1, alignItems: 'center', gap: 8 },
  actionIcon: {
    width: 54, height: 54, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    ...SHADOW_SM,
  },
  actionLabel: { fontSize: 11, fontWeight: '600' },

  // Sections
  section: { marginBottom: 36 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionDesc: { fontSize: 12, fontWeight: '400', marginTop: 2 },
  seeAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  seeAllText: { fontSize: 13, fontWeight: '700' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  liveBadgeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },

  // Auction cards
  auctionCard: {
    flexDirection: 'row', marginHorizontal: 20, borderRadius: 16,
    overflow: 'hidden', marginBottom: 12,
    ...SHADOW_SM,
  },
  auctionImgWrap: { position: 'relative' },
  auctionImg: { width: 100, height: 100 },
  liveTag: {
    position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  auctionInfo: { flex: 1, padding: 12, justifyContent: 'space-between', gap: 4 },
  auctionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  timeText: { fontSize: 12, fontWeight: '400' },
  auctionPrice: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  bidCount: { fontSize: 12, fontWeight: '500' },
});
