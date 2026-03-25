import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, Animated, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice, formatDate, resolveImageUrl } from '../../lib/format';
import { StatusBadge, SkeletonAuctionCard } from '../../components/ui';
import type { Auction } from '../../types';

type TabKey = 'active' | 'upcoming' | 'ended';

/* ── Pulsating Live Dot ── */
function PulsatingDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 2, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={pStyles.container}>
      <Animated.View style={[pStyles.outerDot, {
        transform: [{ scale: pulse }],
        opacity: pulse.interpolate({ inputRange: [1, 2], outputRange: [0.6, 0] }),
      }]} />
      <View style={pStyles.innerDot} />
    </View>
  );
}
const pStyles = StyleSheet.create({
  container: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  outerDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  innerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
});

/* ── Animated Card Wrapper ── */
function AnimatedCard({ children, style, onPress, isLive, isDark }: {
  children: React.ReactNode; style: any; onPress: () => void; isLive: boolean; isDark: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.975, useNativeDriver: true, friction: 8, tension: 100 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, isDark && isLive && {
      shadowColor: '#ef4444',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 6,
    }]}>
      <TouchableOpacity
        style={style}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.9}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function AuctionsListScreen() {
  const navigation = useNavigation<any>();
  const { colors: c, isDark } = useTheme();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [tab, setTab] = useState<TabKey>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Tab animation
  const tabIndicator = useRef(new Animated.Value(0)).current;

  const fetchAuctions = useCallback(async () => {
    try {
      const statusMap: Record<TabKey, string> = { active: 'live', upcoming: 'scheduled', ended: 'settled' };
      const { data } = await apiClient.get('/auctions', { params: { status: statusMap[tab], limit: 50 } });
      setAuctions(data.data || data);
    } catch {}
    setLoading(false);
  }, [tab]);

  useEffect(() => { setLoading(true); fetchAuctions(); }, [fetchAuctions]);
  const onRefresh = async () => { setRefreshing(true); await fetchAuctions(); setRefreshing(false); };

  const tabItems: { key: TabKey; label: string; icon: string }[] = [
    { key: 'active', label: 'Canlı', icon: 'flash' },
    { key: 'upcoming', label: 'Yaklaşan', icon: 'time-outline' },
    { key: 'ended', label: 'Biten', icon: 'checkmark-circle-outline' },
  ];

  const getTimeInfo = (auction: Auction) => {
    const endDate = (auction as any).extendedUntil || (auction as any).scheduledEnd;
    if (!endDate) return null;
    const ms = new Date(endDate).getTime() - Date.now();
    if (ms <= 0) return { text: 'Bitti', color: '#64748b' };
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    let text: string;
    if (d > 0) text = `${d}g ${h}s`;
    else if (h > 0) text = `${h}s ${m}dk`;
    else text = `${m}dk`;
    const color = ms < 3600000 ? '#f87171' : ms < 86400000 ? '#fbbf24' : '#34d399';
    return { text, color };
  };

  function renderAuction({ item }: { item: Auction }) {
    const imageUri = item.parcel?.images?.[0] ? resolveImageUrl(item.parcel.images[0]) : null;
    const timeInfo = getTimeInfo(item);
    const isLive = item.status === 'live';

    return (
      <AnimatedCard
        isLive={isLive}
        isDark={isDark}
        onPress={() => navigation.navigate('LiveAuction', { id: item.id })}
        style={[styles.card, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
          borderColor: isDark
            ? (isLive ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)')
            : (isLive ? 'rgba(239,68,68,0.15)' : '#e2e8f0'),
        }]}
      >
        {/* Image */}
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
              alignItems: 'center', justifyContent: 'center',
            }]}>
              <Ionicons name="business-outline" size={32} color={isDark ? 'rgba(255,255,255,0.2)' : c.textMuted} />
            </View>
          )}
          {/* Image overlay gradient for dark mode */}
          {isDark && (
            <LinearGradient
              colors={['transparent', 'rgba(3,7,18,0.3)']}
              style={styles.imageGradientOverlay}
            />
          )}
          <View style={styles.imageOverlay}>
            <StatusBadge status={item.status} size="sm" />
          </View>
          {isLive && (
            <LinearGradient
              colors={['#dc2626', '#ef4444']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.liveTag}
            >
              <PulsatingDot />
              <Text style={styles.liveText}>CANLI</Text>
            </LinearGradient>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: isDark ? '#f0fdf4' : c.text }]} numberOfLines={2}>
            {item.parcel?.title || item.title || `İhale #${item.id.slice(0, 8)}`}
          </Text>

          {item.parcel?.city && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location-outline" size={12} color={isDark ? 'rgba(255,255,255,0.35)' : c.textMuted} />
              <Text style={[styles.cardLoc, { color: isDark ? 'rgba(255,255,255,0.45)' : c.textMuted }]}>
                {item.parcel.city}{item.parcel.district ? `, ${item.parcel.district}` : ''}
              </Text>
              {timeInfo && (
                <>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.15)' : c.textMuted }}>  ·  </Text>
                  <View style={[styles.timeBadge, {
                    backgroundColor: isDark ? `${timeInfo.color}15` : `${timeInfo.color}15`,
                    borderWidth: isDark ? 1 : 0,
                    borderColor: isDark ? `${timeInfo.color}25` : 'transparent',
                  }]}>
                    <View style={[styles.timeDot, { backgroundColor: timeInfo.color }]} />
                    <Text style={[styles.timeText, { color: timeInfo.color }]}>{timeInfo.text}</Text>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={styles.cardFooter}>
            <View>
              <Text style={[styles.priceLabel, { color: isDark ? 'rgba(255,255,255,0.35)' : c.textMuted }]}>
                {isLive ? 'Güncel Fiyat' : tab === 'upcoming' ? 'Başlangıç' : 'Son Fiyat'}
              </Text>
              <Text style={[styles.priceVal, { color: isDark ? '#34d399' : c.primary }]}>
                {formatPrice(item.currentPrice || item.startingPrice)}
              </Text>
            </View>
            {isLive && (
              <View style={[styles.bidChip, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5',
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'transparent',
              }]}>
                <Ionicons name="hammer-outline" size={13} color={isDark ? 'rgba(255,255,255,0.5)' : c.textMuted} />
                <Text style={[styles.bidCount, { color: isDark ? 'rgba(255,255,255,0.6)' : c.textMuted }]}>{item.bidCount} teklif</Text>
              </View>
            )}
            {!isLive && (item as any).startTime && (
              <Text style={[styles.dateText, { color: isDark ? 'rgba(255,255,255,0.35)' : c.textMuted }]}>{formatDate((item as any).startTime, 'datetime')}</Text>
            )}
          </View>
        </View>
      </AnimatedCard>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#030712' : c.background }]} edges={['top']}>
      {/* Ambient orbs */}
      {isDark && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.orbTop} />
        </View>
      )}

      {/* Title */}
      <View style={styles.titleBar}>
        <Text style={[styles.screenTitle, { color: isDark ? '#f0fdf4' : c.text }]}>İhaleler</Text>
        <Text style={[styles.screenSubtitle, { color: isDark ? 'rgba(255,255,255,0.4)' : c.textMuted }]}>
          Canlı açık artırmalar
        </Text>
      </View>

      {/* Tabs — glass pill style */}
      <View style={[styles.tabBar, {
        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9',
        borderWidth: isDark ? 1 : 0,
        borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'transparent',
      }]}>
        {tabItems.map((t) => {
          const sel = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.7}
              style={[styles.tab, sel && {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                borderWidth: isDark && sel ? 1 : 0,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'transparent',
                ...(isDark && sel ? {
                  shadowColor: '#059669',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 2,
                } : {}),
              }]}
            >
              <Ionicons
                name={t.icon as any}
                size={14}
                color={sel ? (isDark ? '#34d399' : c.primary) : (isDark ? 'rgba(255,255,255,0.35)' : c.textMuted)}
              />
              <Text style={[styles.tabLabel, {
                color: sel ? (isDark ? '#f0fdf4' : c.text) : (isDark ? 'rgba(255,255,255,0.4)' : c.textMuted),
                fontWeight: sel ? '700' : '500',
              }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={{ padding: 20 }}>
          <SkeletonAuctionCard />
          <SkeletonAuctionCard />
          <SkeletonAuctionCard />
        </View>
      ) : (
        <FlatList
          data={auctions}
          renderItem={renderAuction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDark ? '#34d399' : c.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                borderWidth: isDark ? 1 : 0,
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'transparent',
              }]}>
                <Ionicons name="flash-outline" size={36} color={isDark ? 'rgba(255,255,255,0.25)' : c.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: isDark ? '#f0fdf4' : c.text }]}>
                {tab === 'active' ? 'Aktif ihale yok' : tab === 'upcoming' ? 'Yaklaşan ihale yok' : 'Biten ihale yok'}
              </Text>
              <Text style={[styles.emptySub, { color: isDark ? 'rgba(255,255,255,0.4)' : c.textSecondary }]}>
                {tab === 'active' ? 'Şu an aktif bir ihale bulunmuyor' : tab === 'upcoming' ? 'Yaklaşan ihale planlandığında burada görünecek' : 'Henüz tamamlanmış ihale yok'}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Ambient orb */
  orbTop: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(5,150,105,0.05)',
  },

  titleBar: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  screenTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.8 },
  screenSubtitle: { fontSize: 13, fontWeight: '500', marginTop: 3, letterSpacing: 0.1 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 12, marginBottom: 10,
    borderRadius: 16, padding: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 11, borderRadius: 12, gap: 6,
  },
  tabLabel: { fontSize: 14, letterSpacing: -0.1 },

  card: {
    borderRadius: 22, overflow: 'hidden', borderWidth: 1,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 190 },
  imageGradientOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
  },
  imageOverlay: { position: 'absolute', top: 14, left: 14 },
  liveTag: {
    position: 'absolute', bottom: 14, left: 14, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, gap: 5,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },

  cardContent: { padding: 20 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, lineHeight: 23, letterSpacing: -0.3 },
  cardLoc: { fontSize: 13, fontWeight: '400' },

  timeBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, gap: 4,
  },
  timeDot: { width: 5, height: 5, borderRadius: 2.5 },
  timeText: { fontSize: 11, fontWeight: '700' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 16 },
  priceLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  priceVal: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  bidChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  bidCount: { fontSize: 13, fontWeight: '600' },
  dateText: { fontSize: 12, fontWeight: '400' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 14, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  emptyTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3 },
  emptySub: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 21 },
});
