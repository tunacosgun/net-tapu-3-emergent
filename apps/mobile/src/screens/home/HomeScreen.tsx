import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions, Image, Animated, Platform, StatusBar,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/auth-store';
import { formatPrice, resolveImageUrl } from '../../lib/format';
import { SkeletonParcelCard, SkeletonAuctionCard } from '../../components/ui';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { Parcel, Auction, PaginatedResponse } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_PADDING = 20;
const CARD_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP) / 2;

/* ────────────────────────────────────────────
 *  Design Tokens
 * ──────────────────────────────────────────── */
const BRAND = '#059669';
const BRAND_DARK = '#047857';

const palette = {
  bg: '#f8f9fb',
  card: '#ffffff',
  border: '#e8ecf1',
  fg: '#0f172a',
  fgSecondary: '#475569',
  muted: '#94a3b8',
  accent: BRAND,
  accentSoft: '#ecfdf5',
  red: '#ef4444',
  redSoft: '#fef2f2',
  shadow: '#000',
};

const CATEGORIES = [
  { id: 'arsa', label: 'Arsa', icon: 'grid', color: '#059669', bg: '#f1f5f9' },
  { id: 'tarla', label: 'Tarla', icon: 'leaf', color: '#65a30d', bg: '#f1f5f9' },
  { id: 'ticari', label: 'Ticari', icon: 'business', color: '#0284c7', bg: '#f1f5f9' },
  { id: 'ihale', label: 'İhaleler', icon: 'flash', color: '#ea580c', bg: '#f1f5f9' },
  { id: 'harita', label: 'Harita', icon: 'map', color: '#7c3aed', bg: '#f1f5f9' },
];

/* ────────────────────────────────────────────
 *  Animated Press Hook (called outside .map)
 * ──────────────────────────────────────────── */
function useAnimatedPress(scaleDown = 0.97) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    Animated.spring(scale, { toValue: scaleDown, useNativeDriver: true, friction: 8, tension: 120 }).start();
  }, [scale, scaleDown]);
  const onPressOut = useCallback(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
  }, [scale]);
  return { scale, onPressIn, onPressOut };
}

/* ════════════════════════════════════════════
 *  HOME SCREEN
 * ════════════════════════════════════════════ */
export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [profile, setProfile] = useState<{ firstName?: string; lastName?: string } | null>(null);
  const [featured, setFeatured] = useState<Parcel[]>([]);
  const [latest, setLatest] = useState<Parcel[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchData = useCallback(async () => {
    try {
      const [featuredRes, latestRes, auctionRes, profileRes] = await Promise.all([
        apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { isFeatured: true, limit: 10, status: 'active' } }),
        apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { limit: 10, sortBy: 'createdAt', sortOrder: 'DESC', status: 'active' } }),
        apiClient.get<PaginatedResponse<Auction>>('/auctions', { params: { limit: 8 } }).catch(() => ({ data: { data: [], total: 0 } })),
        apiClient.get('/auth/me').catch(() => ({ data: null })),
      ]);
      setFeatured(featuredRes.data.data);
      setLatest(latestRes.data.data);
      const all = auctionRes.data.data || [];
      setAuctions(all.filter((a: Auction) => ['live', 'scheduled', 'deposit_open'].includes(a.status)));
      if (profileRes.data) setProfile(profileRes.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchData().then(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 6) return 'İyi Geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi Günler';
    return 'İyi Akşamlar';
  };

  const userName = profile?.firstName || user?.email?.split('@')[0] || 'Kullanıcı';

  // Header opacity driven by scroll
  const headerShadowOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 0.12],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BRAND} translucent />

      {/* ── HEADER ── */}
      <Animated.View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            shadowOpacity: headerShadowOpacity,
          },
        ]}
      >
        {/* Top Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Profile' as any)}
            style={styles.headerLeft}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.greeting}>{getGreeting()}</Text>
              <Text style={styles.userName}>{userName}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={22} color="#fff" />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── FLOATING SEARCH BAR ── */}
        <View style={styles.searchOuter}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
            style={styles.searchBar}
          >
            <Ionicons name="search" size={20} color={palette.muted} />
            <Text style={styles.searchPlaceholder}>İl, ilçe veya konum ara…</Text>
            <View style={styles.searchFilterBtn}>
              <Ionicons name="options-outline" size={16} color={palette.fgSecondary} />
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── SCROLLABLE CONTENT ── */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Spacer for floating search bar */}
        <View style={{ height: 28 }} />

        {/* ── CATEGORIES ── */}
        <View style={styles.categoriesWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesInner}>
            {CATEGORIES.map((cat) => (
              <CategoryItem
                key={cat.id}
                cat={cat}
                onPress={() => {
                  if (cat.id === 'harita') navigation.navigate('ParcelMap');
                  else if (cat.id === 'ihale') navigation.navigate('Main', { screen: 'Auctions' } as any);
                  else navigation.navigate('Main', { screen: 'Parcels' } as any);
                }}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── VITRIN: Featured Grid ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Vitrin İlanları"
            onSeeAll={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
          />
          {loading ? (
            <View style={styles.gridRow}>
              <SkeletonParcelCard />
              <SkeletonParcelCard />
            </View>
          ) : featured.length > 0 ? (
            <View style={styles.gridRow}>
              {featured.slice(0, 6).map((item) => (
                <GridCard
                  key={item.id}
                  parcel={item}
                  onPress={() => navigation.navigate('ParcelDetail', { id: item.id })}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Henüz vitrin ilanı yok.</Text>
          )}
        </View>

        {/* ── LIVE AUCTIONS ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Günün İhaleleri"
            live
            onSeeAll={() => navigation.navigate('Main', { screen: 'Auctions' } as any)}
          />
          {loading ? (
            <View style={{ paddingHorizontal: 20 }}><SkeletonAuctionCard /></View>
          ) : auctions.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {auctions.map((item, idx) => (
                <AuctionCard
                  key={item.id}
                  auction={item}
                  isLast={idx === auctions.length - 1}
                  onPress={() => navigation.navigate('LiveAuction', { id: item.id })}
                />
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>Şu an aktif ihale bulunmuyor.</Text>
          )}
        </View>

        {/* ── LATEST LISTINGS ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Yeni Eklenenler"
            onSeeAll={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
          />
          {loading ? (
            <View style={{ paddingHorizontal: 20 }}><SkeletonParcelCard /></View>
          ) : latest.length > 0 ? (
            <View style={styles.listWrap}>
              {latest.slice(0, 5).map((item) => (
                <ListCard
                  key={item.id}
                  parcel={item}
                  onPress={() => navigation.navigate('ParcelDetail', { id: item.id })}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  );
}

/* ════════════════════════════════════════════
 *  SUB-COMPONENTS (no hooks inside .map!)
 * ════════════════════════════════════════════ */

/* ── Category Item ── */
function CategoryItem({ cat, onPress }: { cat: typeof CATEGORIES[number]; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.catItem}>
      <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
        <Ionicons name={cat.icon as any} size={24} color={cat.color} />
      </View>
      <Text style={styles.catLabel}>{cat.label}</Text>
    </TouchableOpacity>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, live, onSeeAll }: { title: string; live?: boolean; onSeeAll: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {live && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>CANLI</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <View style={styles.seeAllBtn}>
          <Text style={styles.seeAllText}>Tümünü Gör</Text>
          <Ionicons name="chevron-forward" size={14} color={BRAND} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

/* ── Grid Card (2-column Sahibinden-style) ── */
function GridCard({ parcel, onPress }: { parcel: Parcel; onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = useAnimatedPress();
  const imageUri = parcel.images?.[0] ? resolveImageUrl(parcel.images[0]) : null;
  const isSold = parcel.status === 'sold';

  return (
    <Animated.View style={[styles.gridCardOuter, { transform: [{ scale }] }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={styles.gridCard}
      >
        {/* Image */}
        <View style={styles.gridImgWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.gridImg} resizeMode="cover" />
          ) : (
            <View style={[styles.gridImg, { backgroundColor: '#f1f5f9' }]}>
              <Ionicons name="image-outline" size={28} color="#cbd5e1" />
            </View>
          )}
          {isSold && (
            <View style={styles.soldBanner}>
              <Text style={styles.soldBannerText}>SATILDI</Text>
            </View>
          )}
          {/* Favorite btn */}
          <TouchableOpacity style={styles.favBtn} activeOpacity={0.7}>
            <Ionicons name="heart-outline" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Body */}
        <View style={styles.gridBody}>
          <Text style={styles.gridTitle} numberOfLines={2}>{parcel.title}</Text>
          <View style={styles.gridLocRow}>
            <Ionicons name="location-outline" size={12} color={palette.muted} />
            <Text style={styles.gridLoc} numberOfLines={1}>
              {parcel.city}{parcel.district ? `, ${parcel.district}` : ''}
            </Text>
          </View>
          {parcel.area && (
            <View style={styles.gridMeta}>
              <Text style={styles.gridMetaText}>{parcel.area} m²</Text>
            </View>
          )}
          <Text style={styles.gridPrice}>{formatPrice(parcel.price)}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ── Auction Card (horizontal scroll) ── */
function AuctionCard({ auction, isLast, onPress }: { auction: Auction; isLast: boolean; onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = useAnimatedPress();
  const imageUri = auction.parcel?.images?.[0] ? resolveImageUrl(auction.parcel.images[0]) : null;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, { marginRight: isLast ? 20 : 12 }]}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={styles.auctionCard}
      >
        <View style={styles.auctionImgWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.auctionImg} resizeMode="cover" />
          ) : (
            <View style={[styles.auctionImg, { backgroundColor: '#f1f5f9' }]} />
          )}
          {/* Live badge */}
          <View style={styles.auctionLiveTag}>
            <View style={styles.auctionPulse} />
            <Text style={styles.auctionLiveText}>CANLI İHALE</Text>
          </View>
          {/* Gradient overlay */}
          <View style={styles.auctionGradient} />
        </View>
        <View style={styles.auctionBody}>
          <Text style={styles.auctionTitle} numberOfLines={1}>
            {auction.parcel?.title || auction.title}
          </Text>
          <View style={styles.auctionPriceRow}>
            <Text style={styles.auctionPriceLabel}>Güncel Fiyat</Text>
            <Text style={styles.auctionPrice}>
              {formatPrice(auction.currentPrice || auction.startingPrice)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ── List Card (compact horizontal) ── */
function ListCard({ parcel, onPress }: { parcel: Parcel; onPress: () => void }) {
  const { scale, onPressIn, onPressOut } = useAnimatedPress(0.98);
  const imageUri = parcel.images?.[0] ? resolveImageUrl(parcel.images[0]) : null;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={onPress}
        style={styles.listCard}
      >
        <View style={styles.listImgWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.listImg} resizeMode="cover" />
          ) : (
            <View style={[styles.listImg, { backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="image-outline" size={22} color="#cbd5e1" />
            </View>
          )}
        </View>
        <View style={styles.listBody}>
          <Text style={styles.listTitle} numberOfLines={2}>{parcel.title}</Text>
          <View style={styles.listLocRow}>
            <Ionicons name="location-outline" size={12} color={palette.muted} />
            <Text style={styles.listLoc} numberOfLines={1}>
              {parcel.city}{parcel.district ? `, ${parcel.district}` : ''}
            </Text>
          </View>
          <Text style={styles.listPrice}>{formatPrice(parcel.price)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ════════════════════════════════════════════
 *  STYLES
 * ════════════════════════════════════════════ */
const SHADOW_SM = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  android: { elevation: 3 },
}) as any;

const SHADOW_MD = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16 },
  android: { elevation: 5 },
}) as any;

const SHADOW_LG = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 },
  android: { elevation: 8 },
}) as any;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },

  /* ── Header ── */
  header: {
    backgroundColor: BRAND,
    paddingBottom: 32, // extra for floating search
    zIndex: 10,
    ...SHADOW_MD,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  greeting: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  userName: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: BRAND,
  },

  /* ── Search Bar ── */
  searchOuter: {
    position: 'absolute',
    bottom: -24,
    left: 20,
    right: 20,
    zIndex: 20,
  },
  searchBar: {
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    ...SHADOW_LG,
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    letterSpacing: -0.2,
  },
  searchFilterBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Scroll ── */
  scrollContent: { paddingBottom: 140 },

  /* ── Categories ── */
  categoriesWrap: {
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 18,
    marginBottom: 8,
    ...SHADOW_SM,
  },
  categoriesInner: { paddingHorizontal: 16, gap: 8 },
  catItem: { alignItems: 'center', width: 72 },
  catIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  catLabel: { fontSize: 12, fontWeight: '700', color: palette.fgSecondary, textAlign: 'center', letterSpacing: -0.2 },

  /* ── Section ── */
  section: { marginTop: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: palette.fg, letterSpacing: -0.5 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: BRAND, fontSize: 14, fontWeight: '600' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.red,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 5,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  /* ── Grid Cards ── */
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING,
    gap: GRID_GAP,
  },
  gridCardOuter: { width: CARD_W },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOW_SM,
  },
  gridImgWrap: { width: '100%', height: 120, position: 'relative' },
  gridImg: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  soldBanner: {
    position: 'absolute',
    top: 10,
    left: -28,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 32,
    paddingVertical: 4,
    transform: [{ rotate: '-45deg' }],
  },
  soldBannerText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  favBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridBody: { padding: 12 },
  gridTitle: { fontSize: 13, fontWeight: '700', color: palette.fg, lineHeight: 18, marginBottom: 4 },
  gridLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  gridLoc: { fontSize: 11, color: palette.muted, flex: 1 },
  gridMeta: {
    backgroundColor: palette.accentSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  gridMetaText: { fontSize: 10, fontWeight: '700', color: BRAND },
  gridPrice: { fontSize: 18, fontWeight: '800', color: BRAND, letterSpacing: -0.5 },

  /* ── Auction Cards ── */
  horizontalList: { paddingLeft: 20 },
  auctionCard: {
    width: SCREEN_W * 0.68,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...SHADOW_MD,
  },
  auctionImgWrap: { width: '100%', height: 140, position: 'relative' },
  auctionImg: { width: '100%', height: '100%' },
  auctionGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'transparent',
  },
  auctionLiveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: palette.red,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  auctionPulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  auctionLiveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  auctionBody: { padding: 14 },
  auctionTitle: { fontSize: 15, fontWeight: '700', color: palette.fg, marginBottom: 10 },
  auctionPriceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auctionPriceLabel: { fontSize: 12, fontWeight: '500', color: palette.muted },
  auctionPrice: { fontSize: 18, fontWeight: '800', color: palette.red },

  /* ── List Cards ── */
  listWrap: { paddingHorizontal: 20 },
  listCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    alignItems: 'center',
    ...SHADOW_SM,
  },
  listImgWrap: { width: 88, height: 88, borderRadius: 12, overflow: 'hidden', marginRight: 14 },
  listImg: { width: '100%', height: '100%' },
  listBody: { flex: 1, justifyContent: 'center' },
  listTitle: { fontSize: 14, fontWeight: '700', color: palette.fg, marginBottom: 4, lineHeight: 20 },
  listLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  listLoc: { fontSize: 12, color: palette.muted },
  listPrice: { fontSize: 17, fontWeight: '800', color: BRAND },

  /* ── Empty ── */
  emptyText: { color: palette.muted, paddingHorizontal: 20, fontSize: 14 },
});
