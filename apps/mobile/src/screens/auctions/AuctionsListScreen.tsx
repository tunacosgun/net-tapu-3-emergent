import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image, Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice, formatDate, resolveImageUrl } from '../../lib/format';
import { StatusBadge, SkeletonAuctionCard } from '../../components/ui';
import type { Auction } from '../../types';

type TabKey = 'active' | 'upcoming' | 'ended';

function PulsatingDot() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.8, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={pStyles.container}>
      <Animated.View style={[pStyles.outerDot, { transform: [{ scale: pulse }], opacity: pulse.interpolate({ inputRange: [1, 1.8], outputRange: [0.6, 0] }) }]} />
      <View style={pStyles.innerDot} />
    </View>
  );
}
const pStyles = StyleSheet.create({
  container: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  outerDot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  innerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
});

export default function AuctionsListScreen() {
  const navigation = useNavigation<any>();
  const { colors: c, isDark } = useTheme();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [tab, setTab] = useState<TabKey>('active');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

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
    const color = ms < 3600000 ? '#dc2626' : ms < 86400000 ? '#f59e0b' : '#16a34a';
    return { text, color };
  };

  function renderAuction({ item }: { item: Auction }) {
    const imageUri = item.parcel?.images?.[0] ? resolveImageUrl(item.parcel.images[0]) : null;
    const timeInfo = getTimeInfo(item);
    const isLive = item.status === 'live';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: isDark ? c.card : '#fff', borderColor: isDark ? c.border : '#e2e8f0' }]}
        onPress={() => navigation.navigate('LiveAuction', { id: item.id })}
        activeOpacity={0.8}
      >
        {/* Image */}
        <View style={styles.imageWrap}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, { backgroundColor: isDark ? c.surface : '#f8fafc', alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="business-outline" size={32} color={c.textMuted} />
            </View>
          )}
          <View style={styles.imageOverlay}>
            <StatusBadge status={item.status} size="sm" />
          </View>
          {isLive && (
            <View style={styles.liveTag}>
              <PulsatingDot />
              <Text style={styles.liveText}>CANLI</Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={2}>
            {item.parcel?.title || item.title || `İhale #${item.id.slice(0, 8)}`}
          </Text>

          {item.parcel?.city && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="location-outline" size={12} color={c.textMuted} />
              <Text style={[styles.cardLoc, { color: c.textMuted }]}>
                {item.parcel.city}{item.parcel.district ? `, ${item.parcel.district}` : ''}
              </Text>
              {timeInfo && (
                <>
                  <Text style={{ color: c.textMuted }}>  ·  </Text>
                  <View style={[styles.timeBadge, { backgroundColor: `${timeInfo.color}15` }]}>
                    <View style={[styles.timeDot, { backgroundColor: timeInfo.color }]} />
                    <Text style={[styles.timeText, { color: timeInfo.color }]}>{timeInfo.text}</Text>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={styles.cardFooter}>
            <View>
              <Text style={[styles.priceLabel, { color: c.textMuted }]}>
                {isLive ? 'Güncel Fiyat' : tab === 'upcoming' ? 'Başlangıç' : 'Son Fiyat'}
              </Text>
              <Text style={[styles.priceVal, { color: c.primary }]}>
                {formatPrice(item.currentPrice || item.startingPrice)}
              </Text>
            </View>
            {isLive && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="hammer-outline" size={14} color={c.textMuted} />
                <Text style={[styles.bidCount, { color: c.textMuted }]}>{item.bidCount} teklif</Text>
              </View>
            )}
            {!isLive && (item as any).startTime && (
              <Text style={[styles.dateText, { color: c.textMuted }]}>{formatDate((item as any).startTime, 'datetime')}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.titleBar}>
        <Text style={[styles.screenTitle, { color: c.text }]}>İhaleler</Text>
      </View>

      {/* Tabs — pill style */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? c.surface : '#f1f5f9' }]}>
        {tabItems.map((t) => {
          const sel = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.7}
              style={[styles.tab, sel && { backgroundColor: isDark ? c.card : '#fff' }]}
            >
              <Ionicons name={t.icon as any} size={14} color={sel ? c.primary : c.textMuted} />
              <Text style={[styles.tabLabel, { color: sel ? c.text : c.textMuted, fontWeight: sel ? '700' : '500' }]}>{t.label}</Text>
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? c.surface : '#f8fafc' }]}>
                <Ionicons name="flash-outline" size={36} color={c.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: c.text }]}>
                {tab === 'active' ? 'Aktif ihale yok' : tab === 'upcoming' ? 'Yaklaşan ihale yok' : 'Biten ihale yok'}
              </Text>
              <Text style={[styles.emptySub, { color: c.textSecondary }]}>
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
  titleBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  screenTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, borderRadius: 14, padding: 4,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10, gap: 5,
  },
  tabLabel: { fontSize: 14 },

  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1,
  },
  imageWrap: { position: 'relative' },
  image: { width: '100%', height: 180 },
  imageOverlay: { position: 'absolute', top: 14, left: 14 },
  liveTag: {
    position: 'absolute', bottom: 14, left: 14, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#dc2626', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, gap: 4,
  },
  liveText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  cardContent: { padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: '700', marginBottom: 6, lineHeight: 22, letterSpacing: -0.2 },
  cardLoc: { fontSize: 13, fontWeight: '400' },

  timeBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, gap: 4,
  },
  timeDot: { width: 5, height: 5, borderRadius: 2.5 },
  timeText: { fontSize: 11, fontWeight: '700' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 },
  priceLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  priceVal: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  bidCount: { fontSize: 13, fontWeight: '600' },
  dateText: { fontSize: 12, fontWeight: '400' },

  empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 20 },
});
