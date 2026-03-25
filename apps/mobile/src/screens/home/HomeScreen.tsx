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
const { width: SCREEN_W } = Dimensions.get('window');

/* ── shadcn-inspired design tokens ── */
const token = {
  light: {
    bg: '#fafafa',
    card: '#ffffff',
    cardBorder: '#e4e4e7',
    muted: '#f4f4f5',
    mutedFg: '#71717a',
    fg: '#09090b',
    fgSecondary: '#3f3f46',
    primary: '#18181b',
    primaryFg: '#fafafa',
    accent: '#059669',
    accentMuted: '#ecfdf5',
    destructive: '#ef4444',
    ring: 'rgba(0,0,0,0.05)',
    separator: '#e4e4e7',
    shadow: '#71717a',
  },
  dark: {
    bg: '#09090b',
    card: '#18181b',
    cardBorder: '#27272a',
    muted: '#27272a',
    mutedFg: '#a1a1aa',
    fg: '#fafafa',
    fgSecondary: '#d4d4d8',
    primary: '#fafafa',
    primaryFg: '#18181b',
    accent: '#34d399',
    accentMuted: 'rgba(52,211,153,0.1)',
    destructive: '#f87171',
    ring: 'rgba(255,255,255,0.05)',
    separator: '#27272a',
    shadow: '#000',
  },
};

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { isDark } = useTheme();
  const t = isDark ? token.dark : token.light;
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [featured, setFeatured] = useState<Parcel[]>([]);
  const [latest, setLatest] = useState<Parcel[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [stats, setStats] = useState({ parcels: 0, auctions: 0, cities: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const bodyAnim = useRef(new Animated.Value(0)).current;
  const bodySlide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [featuredRes, latestRes, auctionRes, profileRes] = await Promise.all([
          apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { isFeatured: true, limit: 6, status: 'active' } }),
          apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { limit: 6, sortBy: 'createdAt', sortOrder: 'DESC', status: 'active' } }),
          apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 5 } }).catch(() => ({ data: { data: [], total: 0 } })),
          apiClient.get('/auth/me').catch(() => ({ data: null })),
        ]);
        if (cancelled) return;
        setFeatured(featuredRes.data.data);
        setLatest(latestRes.data.data);
        const allAuctions = auctionRes.data.data || [];
        setAuctions(allAuctions.filter((a: Auction) => ['live', 'scheduled', 'deposit_open'].includes(a.status)));

        const totalParcels = (featuredRes.data as any).total || featuredRes.data.data.length;
        const totalAuctions = (auctionRes.data as any).total || allAuctions.length;
        const cities = new Set([...featuredRes.data.data, ...latestRes.data.data].map((p: Parcel) => p.city).filter(Boolean));
        setStats({ parcels: totalParcels, auctions: totalAuctions, cities: cities.size });

        if (profileRes.data) setProfile(profileRes.data);
      } catch {}
      if (cancelled) return;
      setLoading(false);
      Animated.sequence([
        Animated.timing(heroAnim, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(bodyAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(bodySlide, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        ]),
      ]).start();
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRefresh() {
    setRefreshing(true);
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
      const totalParcels = (featuredRes.data as any).total || featuredRes.data.data.length;
      const totalAuctions = (auctionRes.data as any).total || allAuctions.length;
      const cities = new Set([...featuredRes.data.data, ...latestRes.data.data].map((p: Parcel) => p.city).filter(Boolean));
      setStats({ parcels: totalParcels, auctions: totalAuctions, cities: cities.size });
      if (profileRes.data) setProfile(profileRes.data);
    } catch {}
    setRefreshing(false);
  }

  const userName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ''}`.trim()
    : user?.email?.split('@')[0] || 'Kullanıcı';

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };

  const getAuctionTimeLeft = (auction: Auction) => {
    const endDate = (auction as any).extendedUntil || (auction as any).scheduledEnd;
    if (!endDate) return null;
    const ms = new Date(endDate).getTime() - Date.now();
    if (ms <= 0) return 'Bitti';
    const d = Math.floor(ms / 86400000);
    const hr = Math.floor((ms % 86400000) / 3600000);
    if (d > 0) return `${d}g ${hr}s`;
    const m = Math.floor((ms % 3600000) / 60000);
    if (hr > 0) return `${hr}s ${m}dk`;
    return `${m}dk`;
  };

  return (
    <SafeAreaView style={[S.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={S.scrollContent}
      >

        {/* ── HEADER ── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <TouchableOpacity onPress={() => navigation.navigate('Profile' as any)} activeOpacity={0.8}>
              <LinearGradient
                colors={['#059669', '#047857']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={S.avatar}
              >
                <Text style={S.avatarLetter}>{userName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={S.headerText}>
              <Text style={[S.greeting, { color: t.mutedFg }]}>{getGreeting()}</Text>
              <Text style={[S.userName, { color: t.fg }]} numberOfLines={1}>{userName}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
            style={[S.iconBtn, { backgroundColor: t.muted }]}
          >
            <Ionicons name="notifications-outline" size={20} color={t.fgSecondary} />
            <View style={[S.notifDot, { borderColor: t.bg }]} />
          </TouchableOpacity>
        </View>

        {/* ── HERO CARD ── */}
        <Animated.View style={[S.section, { opacity: heroAnim }]}>
          <View style={[S.card, { backgroundColor: t.card, borderColor: t.cardBorder, shadowColor: t.shadow }]}>
            <LinearGradient
              colors={isDark ? ['#052e16', '#064e3b'] : ['#ecfdf5', '#d1fae5']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={S.heroGradient}
            >
              <View style={S.heroBody}>
                <View style={[S.heroPill, { backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : 'rgba(5,150,105,0.1)' }]}>
                  <View style={[S.heroPillDot, { backgroundColor: t.accent }]} />
                  <Text style={[S.heroPillText, { color: t.accent }]}>Türkiye'nin Arsa Platformu</Text>
                </View>
                <Text style={[S.heroTitle, { color: isDark ? '#fff' : '#022c22' }]}>
                  Hayalinizdeki{'\n'}arsayı bulun.
                </Text>
                <Text style={[S.heroCaption, { color: t.mutedFg }]}>
                  {stats.parcels > 0
                    ? `${stats.parcels} aktif ilan · ${stats.cities > 0 ? `${stats.cities} şehir` : 'Türkiye geneli'}`
                    : 'Güvenilir emlak yatırımları'}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#059669', '#047857']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={S.heroCta}
                  >
                    <Text style={S.heroCtaLabel}>İlanları Keşfet</Text>
                    <View style={S.heroCtaArrow}>
                      <Ionicons name="arrow-forward" size={14} color="#059669" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              <View style={[S.heroIconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(5,150,105,0.06)' }]}>
                <Ionicons name="business" size={40} color={isDark ? 'rgba(52,211,153,0.3)' : 'rgba(5,150,105,0.25)'} />
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* ── SEARCH ── */}
        <Animated.View style={[S.section, { opacity: heroAnim }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
            style={[S.searchBar, { backgroundColor: t.card, borderColor: t.cardBorder, shadowColor: t.shadow }]}
          >
            <View style={[S.searchIconWrap, { backgroundColor: t.accentMuted }]}>
              <Ionicons name="search" size={15} color={t.accent} />
            </View>
            <Text style={[S.searchPlaceholder, { color: t.mutedFg }]}>
              İl, ilçe veya ada/parsel ara...
            </Text>
            <View style={[S.searchFilterBtn, { backgroundColor: t.muted }]}>
              <Ionicons name="options-outline" size={15} color={t.mutedFg} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── BODY ── */}
        <Animated.View style={{ opacity: bodyAnim, transform: [{ translateY: bodySlide }] }}>

          {/* ── STATS ROW ── */}
          <View style={S.statsRow}>
            {([
              { label: 'Aktif İlan', value: stats.parcels, icon: 'layers-outline' as const, color: '#059669' },
              { label: 'Açık İhale', value: stats.auctions, icon: 'flash-outline' as const, color: '#f59e0b' },
              { label: 'Şehir', value: stats.cities, icon: 'location-outline' as const, color: '#6366f1' },
            ]).map((s) => (
              <View key={s.label} style={[S.statCard, { backgroundColor: t.card, borderColor: t.cardBorder, shadowColor: t.shadow }]}>
                <View style={[S.statIconWrap, { backgroundColor: s.color + '14' }]}>
                  <Ionicons name={s.icon} size={16} color={s.color} />
                </View>
                <Text style={[S.statValue, { color: t.fg }]}>{s.value}</Text>
                <Text style={[S.statLabel, { color: t.mutedFg }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* ── QUICK ACTIONS 2x2 ── */}
          <View style={S.actionsGrid}>
            {([
              { label: 'İlanlar', icon: 'layers-outline' as const, onPress: () => navigation.navigate('Main', { screen: 'Parcels' } as any), color: '#059669', bg: isDark ? 'rgba(5,150,105,0.1)' : '#ecfdf5' },
              { label: 'İhaleler', icon: 'flash-outline' as const, onPress: () => navigation.navigate('Main', { screen: 'Auctions' } as any), color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb' },
              { label: 'Favoriler', icon: 'heart-outline' as const, onPress: () => navigation.navigate('Favorites'), color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2' },
              { label: 'Harita', icon: 'map-outline' as const, onPress: () => navigation.navigate('ParcelMap'), color: '#6366f1', bg: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff' },
            ]).map((item) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                activeOpacity={0.7}
                style={[S.actionCard, { backgroundColor: t.card, borderColor: t.cardBorder, shadowColor: t.shadow }]}
              >
                <View style={[S.actionIcon, { backgroundColor: item.bg }]}>
                  <Ionicons name={item.icon} size={22} color={item.color} />
                </View>
                <Text style={[S.actionLabel, { color: t.fgSecondary }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── FEATURED ── */}
          {loading ? (
            <View style={S.skeletonWrap}>
              <SkeletonParcelCard />
            </View>
          ) : featured.length > 0 ? (
            <View style={S.sectionBlock}>
              <SectionHeader
                title="Öne Çıkan"
                desc="Editör seçimi premium araziler"
                fg={t.fg} muted={t.mutedFg}
                onSeeAll={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
              />
              <View style={S.sectionContent}>
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
                  contentContainerStyle={S.horizontalList}
                  decelerationRate="fast"
                  snapToInterval={SCREEN_W * 0.72 + 12}
                  snapToAlignment="start"
                >
                  {featured.slice(1).map((item) => (
                    <View key={item.id} style={S.horizontalCard}>
                      <ParcelCard parcel={item} onPress={() => navigation.navigate('ParcelDetail', { id: item.id })} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {/* ── LIVE AUCTIONS ── */}
          {loading ? (
            <View style={S.skeletonWrap}>
              <SkeletonAuctionCard />
            </View>
          ) : auctions.length > 0 ? (
            <View style={S.sectionBlock}>
              <SectionHeader
                title="Canlı İhaleler"
                desc="Aktif açık artırmalar"
                fg={t.fg} muted={t.mutedFg}
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
                    style={[S.auctionCard, {
                      backgroundColor: t.card,
                      borderColor: isLive ? (isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.15)') : t.cardBorder,
                      shadowColor: t.shadow,
                    }]}
                  >
                    <View style={S.auctionImgWrap}>
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={S.auctionImg} resizeMode="cover" />
                      ) : (
                        <View style={[S.auctionImg, S.auctionPlaceholder, { backgroundColor: t.muted }]}>
                          <Ionicons name="business-outline" size={24} color={t.mutedFg} />
                        </View>
                      )}
                      {isLive && (
                        <View style={S.liveTag}>
                          <View style={S.livePulse} />
                          <Text style={S.liveText}>CANLI</Text>
                        </View>
                      )}
                    </View>
                    <View style={S.auctionBody}>
                      <Text style={[S.auctionTitle, { color: t.fg }]} numberOfLines={1}>
                        {a.parcel?.title || a.title || `İhale #${a.id.slice(0, 8)}`}
                      </Text>
                      <View style={S.auctionMeta}>
                        <StatusBadge status={a.status} size="sm" />
                        {timeLeft && (
                          <View style={[S.timeChip, { backgroundColor: t.muted }]}>
                            <Ionicons name="time-outline" size={11} color={t.mutedFg} />
                            <Text style={[S.timeText, { color: t.mutedFg }]}>{timeLeft}</Text>
                          </View>
                        )}
                      </View>
                      <View style={S.auctionPriceRow}>
                        <View>
                          <Text style={[S.auctionPriceLabel, { color: t.mutedFg }]}>Güncel Fiyat</Text>
                          <Text style={[S.auctionPrice, { color: t.accent }]}>
                            {formatPrice(a.currentPrice || a.startingPrice)}
                          </Text>
                        </View>
                        <View style={[S.bidBadge, { backgroundColor: t.muted }]}>
                          <Ionicons name="people-outline" size={12} color={t.mutedFg} />
                          <Text style={[S.bidCount, { color: t.mutedFg }]}>{a.bidCount}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={S.auctionChevron}>
                      <Ionicons name="chevron-forward" size={16} color={t.mutedFg} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* ── LATEST ── */}
          {loading ? (
            <View style={S.skeletonWrap}>
              <SkeletonParcelCard />
              <SkeletonParcelCard />
            </View>
          ) : latest.length > 0 ? (
            <View style={S.sectionBlock}>
              <SectionHeader title="Yeni Eklenenler" desc="Son eklenen arazi ilanları" fg={t.fg} muted={t.mutedFg} />
              <View style={S.sectionContent}>
                {latest.map((p) => (
                  <ParcelCard key={p.id} parcel={p} onPress={() => navigation.navigate('ParcelDetail', { id: p.id })} compact />
                ))}
              </View>
            </View>
          ) : null}

          {/* ── TRUST STRIP ── */}
          <View style={[S.trustStrip, { borderTopColor: t.separator }]}>
            {([
              { icon: 'shield-checkmark-outline' as const, label: 'Güvenli Ödeme' },
              { icon: 'document-text-outline' as const, label: 'Resmi Tapu' },
              { icon: 'headset-outline' as const, label: '7/24 Destek' },
            ]).map((item) => (
              <View key={item.label} style={S.trustItem}>
                <Ionicons name={item.icon} size={18} color={t.mutedFg} />
                <Text style={[S.trustLabel, { color: t.mutedFg }]}>{item.label}</Text>
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, desc, fg, muted, live, onSeeAll }: {
  title: string; desc: string; fg: string; muted: string; live?: boolean;
  onSeeAll?: () => void;
}) {
  return (
    <View style={S.sectionHeader}>
      <View style={S.sectionHeaderLeft}>
        <View style={S.sectionTitleRow}>
          <Text style={[S.sectionTitle, { color: fg }]}>{title}</Text>
          {live && (
            <View style={S.liveBadge}>
              <View style={S.liveBadgeDot} />
              <Text style={S.liveBadgeLabel}>CANLI</Text>
            </View>
          )}
        </View>
        <Text style={[S.sectionDesc, { color: muted }]}>{desc}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={S.seeAllBtn}>
            <Text style={S.seeAllText}>Tümünü Gör</Text>
            <Ionicons name="chevron-forward" size={13} color="#059669" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ─────────── STYLES (shadcn/ui design language) ─────────── */

const CARD_SHADOW = Platform.select({
  ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 },
  android: { elevation: 1 },
}) as any;

const RADIUS = 16;
const RADIUS_SM = 12;
const RADIUS_XS = 8;
const PX = 20; // horizontal page padding

const S = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  /* Header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: PX, paddingTop: 8, paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerText: { flex: 1 },
  avatar: {
    width: 44, height: 44, borderRadius: RADIUS_SM,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 17, fontWeight: '700', color: '#fff' },
  greeting: { fontSize: 12, fontWeight: '500', marginBottom: 1 },
  userName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  iconBtn: {
    width: 42, height: 42, borderRadius: RADIUS_SM,
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute', top: 9, right: 9,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444', borderWidth: 2,
  },

  /* Shared section spacing */
  section: { paddingHorizontal: PX, marginBottom: 16 },

  /* Card base — shadcn style: thin border, low shadow, consistent radius */
  card: {
    borderRadius: RADIUS, borderWidth: 1, overflow: 'hidden',
    ...CARD_SHADOW,
  },

  /* Hero */
  heroGradient: {
    flexDirection: 'row', alignItems: 'center',
    padding: 24, minHeight: 200,
  },
  heroBody: { flex: 1, zIndex: 2 },
  heroPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginBottom: 14,
  },
  heroPillDot: { width: 5, height: 5, borderRadius: 2.5 },
  heroPillText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.8, lineHeight: 34, marginBottom: 8 },
  heroCaption: { fontSize: 13, fontWeight: '500', marginBottom: 20, lineHeight: 18 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingLeft: 18, paddingRight: 6, paddingVertical: 6,
    borderRadius: RADIUS_SM,
  },
  heroCtaLabel: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  heroCtaArrow: {
    width: 28, height: 28, borderRadius: RADIUS_XS,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  heroIconBox: {
    width: 76, height: 76, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },

  /* Search */
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, borderRadius: RADIUS_SM, paddingHorizontal: 10,
    borderWidth: 1,
    ...CARD_SHADOW,
  },
  searchIconWrap: {
    width: 30, height: 30, borderRadius: RADIUS_XS,
    alignItems: 'center', justifyContent: 'center',
  },
  searchPlaceholder: { fontSize: 14, fontWeight: '400', flex: 1 },
  searchFilterBtn: {
    width: 34, height: 34, borderRadius: RADIUS_XS,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row', paddingHorizontal: PX, gap: 10, marginBottom: 16,
  },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8,
    borderRadius: RADIUS, borderWidth: 1,
    ...CARD_SHADOW,
  },
  statIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 2 },

  /* Actions grid */
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: PX, gap: 10, marginBottom: 32,
  },
  actionCard: {
    width: (SCREEN_W - PX * 2 - 10) / 2,
    alignItems: 'center', paddingVertical: 20,
    borderRadius: RADIUS, borderWidth: 1,
    ...CARD_SHADOW,
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  actionLabel: { fontSize: 13, fontWeight: '600' },

  /* Section blocks */
  sectionBlock: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: PX, marginBottom: 16,
  },
  sectionHeaderLeft: { flex: 1 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  sectionDesc: { fontSize: 12, fontWeight: '400', marginTop: 2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: '700', color: '#059669' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS_XS,
  },
  liveBadgeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.85)' },
  liveBadgeLabel: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  sectionContent: { paddingHorizontal: PX },
  horizontalList: { paddingHorizontal: PX, gap: 12 },
  horizontalCard: { width: SCREEN_W * 0.72 },
  skeletonWrap: { paddingHorizontal: PX, marginBottom: 32 },

  /* Auction cards */
  auctionCard: {
    flexDirection: 'row', marginHorizontal: PX, borderRadius: RADIUS,
    overflow: 'hidden', marginBottom: 10, alignItems: 'center',
    borderWidth: 1,
    ...CARD_SHADOW,
  },
  auctionImgWrap: { position: 'relative' },
  auctionImg: { width: 100, height: 100 },
  auctionPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  liveTag: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#dc2626', paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 7, gap: 4,
  },
  livePulse: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.85)' },
  liveText: { color: '#fff', fontSize: 8.5, fontWeight: '800', letterSpacing: 0.6 },
  auctionBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  auctionTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2, lineHeight: 18 },
  auctionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  timeText: { fontSize: 11, fontWeight: '500' },
  auctionPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  auctionPriceLabel: { fontSize: 10, fontWeight: '500', marginBottom: 1 },
  auctionPrice: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  bidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: RADIUS_XS,
  },
  bidCount: { fontSize: 11.5, fontWeight: '600' },
  auctionChevron: { paddingRight: 12 },

  /* Trust strip */
  trustStrip: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 24, marginHorizontal: PX, marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trustItem: { alignItems: 'center', gap: 6 },
  trustLabel: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.2 },
});
