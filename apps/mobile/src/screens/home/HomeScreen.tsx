import React, { useEffect, useState, useRef, useCallback } from 'react';
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

  // Staggered entrance animations
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const heroTranslateY = useRef(new Animated.Value(30)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;
  const searchTranslateY = useRef(new Animated.Value(20)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const statsTranslateY = useRef(new Animated.Value(20)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(24)).current;

  const runEntrance = useCallback(() => {
    const cfg = (val: Animated.Value, toVal: number, delay: number) =>
      Animated.timing(val, { toValue: toVal, duration: 600, delay, useNativeDriver: true });
    const spring = (val: Animated.Value, delay: number) =>
      Animated.spring(val, { toValue: 0, tension: 65, friction: 11, delay, useNativeDriver: true });

    Animated.parallel([
      cfg(heroOpacity, 1, 0), spring(heroTranslateY, 0),
      cfg(searchOpacity, 1, 120), spring(searchTranslateY, 120),
      cfg(statsOpacity, 1, 200), spring(statsTranslateY, 200),
      cfg(contentOpacity, 1, 320), spring(contentTranslateY, 320),
    ]).start();
  }, [heroOpacity, heroTranslateY, searchOpacity, searchTranslateY, statsOpacity, statsTranslateY, contentOpacity, contentTranslateY]);

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

      const totalParcels = (featuredRes.data as any).total || featuredRes.data.data.length;
      const totalAuctions = (auctionRes.data as any).total || allAuctions.length;
      const cities = new Set([...featuredRes.data.data, ...latestRes.data.data].map((p: Parcel) => p.city).filter(Boolean));
      setStats({ parcels: totalParcels, auctions: totalAuctions, cities: cities.size });

      if (profileRes.data) setProfile(profileRes.data);
    } catch {}
    setLoading(false);
    runEntrance();
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

  // Premium surface tokens
  const surface = isDark ? 'rgba(255,255,255,0.04)' : '#ffffff';
  const surfaceElevated = isDark ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const border = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const subtleText = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)';
  const bg = isDark ? '#050a08' : '#f8faf9';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >

        {/* ── PREMIUM HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile' as any)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={isDark ? ['#34d399', '#059669'] : ['#059669', '#047857']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarLetter}>{userName.charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={[styles.greeting, { color: subtleText }]}>{getGreeting()}</Text>
              <Text style={[styles.userName, { color: isDark ? '#fff' : '#0a0f0d' }]} numberOfLines={1}>
                {userName}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.7}
              style={[styles.iconBtn, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              }]}
            >
              <Ionicons name="notifications-outline" size={20} color={isDark ? 'rgba(255,255,255,0.7)' : '#1e293b'} />
              <View style={[styles.notifDot, { borderColor: bg }]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── HERO ── */}
        <Animated.View style={[styles.heroOuter, { opacity: heroOpacity, transform: [{ translateY: heroTranslateY }] }]}>
          <LinearGradient
            colors={isDark
              ? ['#041f13', '#052e16', '#064e3b']
              : ['#ecfdf5', '#d1fae5', '#a7f3d0']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            {/* Decorative orbs */}
            <View style={[styles.orb1, { backgroundColor: isDark ? 'rgba(52,211,153,0.06)' : 'rgba(5,150,105,0.06)' }]} />
            <View style={[styles.orb2, { backgroundColor: isDark ? 'rgba(52,211,153,0.04)' : 'rgba(5,150,105,0.04)' }]} />

            <View style={styles.heroBody}>
              {/* Mini badge */}
              <View style={[styles.heroBadge, { backgroundColor: isDark ? 'rgba(52,211,153,0.12)' : 'rgba(5,150,105,0.08)' }]}>
                <View style={[styles.heroBadgeDot, { backgroundColor: isDark ? '#34d399' : '#059669' }]} />
                <Text style={[styles.heroBadgeText, { color: isDark ? '#34d399' : '#047857' }]}>
                  Türkiye'nin Arsa Platformu
                </Text>
              </View>

              <Text style={[styles.heroHeadline, { color: isDark ? '#ffffff' : '#022c22' }]}>
                Hayalinizdeki{'\n'}arsayı bulun.
              </Text>

              <Text style={[styles.heroCaption, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(2,44,34,0.5)' }]}>
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
                  style={styles.heroCta}
                >
                  <Text style={styles.heroCtaLabel}>İlanları Keşfet</Text>
                  <View style={styles.heroCtaArrow}>
                    <Ionicons name="arrow-forward" size={14} color="#059669" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Abstract icon */}
            <View style={styles.heroVisual}>
              <View style={[styles.heroIconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(5,150,105,0.06)' }]}>
                <Ionicons name="business" size={44} color={isDark ? 'rgba(52,211,153,0.35)' : 'rgba(5,150,105,0.3)'} />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── SEARCH BAR ── */}
        <Animated.View style={{ opacity: searchOpacity, transform: [{ translateY: searchTranslateY }] }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
            style={[styles.searchBar, {
              backgroundColor: surfaceElevated,
              borderColor: border,
              shadowColor: isDark ? '#000' : '#94a3b8',
            }]}
          >
            <View style={[styles.searchIcon, { backgroundColor: isDark ? 'rgba(5,150,105,0.12)' : 'rgba(5,150,105,0.08)' }]}>
              <Ionicons name="search" size={16} color={isDark ? '#34d399' : '#059669'} />
            </View>
            <Text style={[styles.searchText, { color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)' }]}>
              İl, ilçe veya ada/parsel ara...
            </Text>
            <View style={[styles.searchFilterBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
              <Ionicons name="options-outline" size={16} color={isDark ? 'rgba(255,255,255,0.45)' : '#64748b'} />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* ── STATS ── */}
        <Animated.View style={[styles.statsRow, { opacity: statsOpacity, transform: [{ translateY: statsTranslateY }] }]}>
          {[
            { label: 'Aktif İlan', value: stats.parcels, icon: 'layers-outline', gradient: ['#059669', '#047857'] as [string, string] },
            { label: 'Açık İhale', value: stats.auctions, icon: 'flash-outline', gradient: ['#f59e0b', '#d97706'] as [string, string] },
            { label: 'Şehir', value: stats.cities, icon: 'location-outline', gradient: ['#6366f1', '#4f46e5'] as [string, string] },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, {
              backgroundColor: surfaceElevated,
              borderColor: border,
              shadowColor: isDark ? '#000' : '#94a3b8',
            }]}>
              <LinearGradient
                colors={s.gradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.statIcon}
              >
                <Ionicons name={s.icon as any} size={14} color="#fff" />
              </LinearGradient>
              <Text style={[styles.statValue, { color: isDark ? '#fff' : '#0a0f0d' }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: subtleText }]}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── QUICK ACTIONS GRID ── */}
        <Animated.View style={[styles.actionsGrid, { opacity: statsOpacity, transform: [{ translateY: statsTranslateY }] }]}>
          {[
            { label: 'İlanlar', icon: 'layers-outline', onPress: () => navigation.navigate('Main', { screen: 'Parcels' } as any), color: '#059669', bg: isDark ? 'rgba(5,150,105,0.1)' : '#ecfdf5' },
            { label: 'İhaleler', icon: 'flash-outline', onPress: () => navigation.navigate('Main', { screen: 'Auctions' } as any), color: '#f59e0b', bg: isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb' },
            { label: 'Favoriler', icon: 'heart-outline', onPress: () => navigation.navigate('Favorites'), color: '#ef4444', bg: isDark ? 'rgba(239,68,68,0.1)' : '#fef2f2' },
            { label: 'Harita', icon: 'map-outline', onPress: () => navigation.navigate('ParcelMap'), color: '#6366f1', bg: isDark ? 'rgba(99,102,241,0.1)' : '#eef2ff' },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              onPress={item.onPress}
              activeOpacity={0.7}
              style={[styles.actionCard, {
                backgroundColor: surfaceElevated,
                borderColor: border,
                shadowColor: isDark ? '#000' : '#94a3b8',
              }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon as any} size={22} color={item.color} />
              </View>
              <Text style={[styles.actionLabel, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* ── MAIN CONTENT ── */}
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }}>

          {/* ── FEATURED PARCELS ── */}
          {loading ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
              <SkeletonParcelCard />
            </View>
          ) : featured.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Öne Çıkan"
                desc="Editör seçimi premium araziler"
                isDark={isDark}
                onSeeAll={() => navigation.navigate('Main', { screen: 'Parcels' } as any)}
              />
              <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
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
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                  decelerationRate="fast"
                  snapToInterval={SCREEN_W * 0.72 + 12}
                  snapToAlignment="start"
                >
                  {featured.slice(1).map((item) => (
                    <View key={item.id} style={{ width: SCREEN_W * 0.72 }}>
                      <ParcelCard parcel={item} onPress={() => navigation.navigate('ParcelDetail', { id: item.id })} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          ) : null}

          {/* ── LIVE AUCTIONS ── */}
          {loading ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
              <SkeletonAuctionCard />
            </View>
          ) : auctions.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Canlı İhaleler"
                desc="Aktif açık artırmalar"
                isDark={isDark}
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
                      backgroundColor: surfaceElevated,
                      borderColor: isLive
                        ? (isDark ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.12)')
                        : border,
                      shadowColor: isDark ? '#000' : '#94a3b8',
                    }]}
                  >
                    <View style={styles.auctionImgWrap}>
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.auctionImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.auctionImg, {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                          alignItems: 'center', justifyContent: 'center',
                        }]}>
                          <Ionicons name="business-outline" size={26} color={isDark ? 'rgba(255,255,255,0.15)' : '#cbd5e1'} />
                        </View>
                      )}
                      {isLive && (
                        <View style={styles.liveTag}>
                          <View style={styles.livePulse} />
                          <Text style={styles.liveText}>CANLI</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.auctionBody}>
                      <Text style={[styles.auctionTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]} numberOfLines={1}>
                        {a.parcel?.title || a.title || `İhale #${a.id.slice(0, 8)}`}
                      </Text>
                      <View style={styles.auctionMeta}>
                        <StatusBadge status={a.status} size="sm" />
                        {timeLeft && (
                          <View style={[styles.timeChip, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }]}>
                            <Ionicons name="time-outline" size={11} color={subtleText} />
                            <Text style={[styles.timeText, { color: subtleText }]}>{timeLeft}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.auctionPriceRow}>
                        <View>
                          <Text style={[styles.auctionPriceCaption, { color: subtleText }]}>Güncel Fiyat</Text>
                          <Text style={[styles.auctionPrice, { color: isDark ? '#4ade80' : '#059669' }]}>
                            {formatPrice(a.currentPrice || a.startingPrice)}
                          </Text>
                        </View>
                        <View style={[styles.bidBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc' }]}>
                          <Ionicons name="people-outline" size={12} color={subtleText} />
                          <Text style={[styles.bidText, { color: subtleText }]}>{a.bidCount}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.auctionChevron}>
                      <Ionicons name="chevron-forward" size={16} color={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* ── LATEST PARCELS ── */}
          {loading ? (
            <View style={{ paddingHorizontal: 20 }}>
              <SkeletonParcelCard />
              <SkeletonParcelCard />
            </View>
          ) : latest.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader
                title="Yeni Eklenenler"
                desc="Son eklenen arazi ilanları"
                isDark={isDark}
              />
              <View style={{ paddingHorizontal: 20 }}>
                {latest.map((p) => (
                  <ParcelCard key={p.id} parcel={p} onPress={() => navigation.navigate('ParcelDetail', { id: p.id })} compact />
                ))}
              </View>
            </View>
          ) : null}

          {/* ── TRUST STRIP ── */}
          <View style={[styles.trustStrip, { borderTopColor: border }]}>
            {[
              { icon: 'shield-checkmark-outline', label: 'Güvenli Ödeme' },
              { icon: 'document-text-outline', label: 'Resmi Tapu' },
              { icon: 'headset-outline', label: '7/24 Destek' },
            ].map((t) => (
              <View key={t.label} style={styles.trustItem}>
                <Ionicons name={t.icon as any} size={18} color={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)'} />
                <Text style={[styles.trustLabel, { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }]}>{t.label}</Text>
              </View>
            ))}
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Section Header ── */
function SectionHeader({ title, desc, isDark, live, onSeeAll }: {
  title: string; desc: string; isDark: boolean; live?: boolean;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#0a0f0d' }]}>{title}</Text>
          {live && (
            <View style={styles.liveBadge}>
              <View style={styles.liveBadgeDot} />
              <Text style={styles.liveBadgeLabel}>CANLI</Text>
            </View>
          )}
        </View>
        <Text style={[styles.sectionDesc, { color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)' }]}>{desc}</Text>
      </View>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={styles.seeAllBtn}>
            <Text style={styles.seeAllText}>Tümünü Gör</Text>
            <Ionicons name="chevron-forward" size={13} color="#059669" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ─────────────────────── STYLES ─────────────────────── */

const SHADOW_SM = Platform.select({
  ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
  android: { elevation: 1 },
}) as any;

const SHADOW_MD = Platform.select({
  ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16 },
  android: { elevation: 3 },
}) as any;

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* Header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  headerTextWrap: { flex: 1 },
  headerRight: { flexDirection: 'row', gap: 8 },
  avatar: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontSize: 17, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  greeting: { fontSize: 12, fontWeight: '500', letterSpacing: 0.1, marginBottom: 1 },
  userName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.4 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  notifDot: {
    position: 'absolute', top: 9, right: 9,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 2,
  },

  /* Hero */
  heroOuter: { paddingHorizontal: 20, paddingTop: 4 },
  hero: {
    borderRadius: 24, padding: 28, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', minHeight: 200,
  },
  orb1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    top: -70, right: -50,
  },
  orb2: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    bottom: -60, left: -30,
  },
  heroBody: { flex: 1, zIndex: 2 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, marginBottom: 14,
  },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 2.5 },
  heroBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroHeadline: {
    fontSize: 30, fontWeight: '800', letterSpacing: -0.8,
    lineHeight: 36, marginBottom: 8,
  },
  heroCaption: { fontSize: 13, fontWeight: '500', marginBottom: 22, lineHeight: 18 },
  heroCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start', paddingLeft: 18, paddingRight: 6, paddingVertical: 6,
    borderRadius: 14,
  },
  heroCtaLabel: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  heroCtaArrow: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  heroVisual: { zIndex: 2, marginLeft: 8 },
  heroIconBox: {
    width: 80, height: 80, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Search */
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 50, borderRadius: 16, paddingHorizontal: 10,
    marginHorizontal: 20, marginTop: 16,
    borderWidth: 1,
    ...SHADOW_SM,
  },
  searchIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  searchText: { fontSize: 14.5, fontWeight: '400', flex: 1 },
  searchFilterBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8,
    borderRadius: 18, borderWidth: 1,
    ...SHADOW_SM,
  },
  statIcon: {
    width: 30, height: 30, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26 },
  statLabel: { fontSize: 11, fontWeight: '500', marginTop: 3, letterSpacing: 0.1 },

  /* Quick Actions */
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 20, gap: 10,
    marginTop: 16, marginBottom: 32,
  },
  actionCard: {
    width: (SCREEN_W - 50) / 2,
    alignItems: 'center', paddingVertical: 20,
    borderRadius: 18, borderWidth: 1,
    ...SHADOW_SM,
  },
  actionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  actionLabel: { fontSize: 13, fontWeight: '600', letterSpacing: -0.1 },

  /* Sections */
  section: { marginBottom: 36 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16,
  },
  sectionTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  sectionDesc: { fontSize: 12, fontWeight: '400', marginTop: 2 },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, fontWeight: '700', color: '#059669' },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  liveBadgeDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.85)' },
  liveBadgeLabel: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },

  /* Auction cards */
  auctionCard: {
    flexDirection: 'row', marginHorizontal: 20, borderRadius: 18,
    overflow: 'hidden', marginBottom: 10, alignItems: 'center',
    borderWidth: 1,
    ...SHADOW_MD,
  },
  auctionImgWrap: { position: 'relative' },
  auctionImg: { width: 100, height: 100 },
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
  auctionPriceCaption: { fontSize: 10, fontWeight: '500', marginBottom: 1 },
  auctionPrice: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  bidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
  },
  bidText: { fontSize: 11.5, fontWeight: '600' },
  auctionChevron: { paddingRight: 12 },

  /* Trust strip */
  trustStrip: {
    flexDirection: 'row', justifyContent: 'space-around',
    paddingVertical: 24, marginHorizontal: 20, marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trustItem: { alignItems: 'center', gap: 6 },
  trustLabel: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.2 },
});
