import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, AppState, Platform, Dimensions, KeyboardAvoidingView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice } from '../../lib/format';
import { useAuctionStore, BidFeedItem } from '../../stores/auction-store';
import { useConnectionStore } from '../../stores/connection-store';
import { connectToAuction, placeBid, disconnectFromAuction } from '../../lib/ws-client';
import { Button, Card } from '../../components/ui';

function formatRejectionMessage(msg: string): string {
  if (!msg) return 'Teklifiniz kabul edilmedi.';
  // "Minimum bid is 34500000" → "Minimum teklif: ₺34.500.000"
  const minMatch = msg.match(/[Mm]inimum bid is (\d+)/);
  if (minMatch) {
    const amount = parseInt(minMatch[1], 10).toLocaleString('tr-TR');
    return `Minimum teklif tutarı: ₺${amount}`;
  }
  // "Bid must be higher than current price" etc.
  if (msg.toLowerCase().includes('higher than current')) return 'Teklif mevcut fiyattan yüksek olmalıdır.';
  if (msg.toLowerCase().includes('increment')) return 'Teklif minimum artış miktarını karşılamıyor.';
  if (msg.toLowerCase().includes('consent')) return 'İhale sözleşmesini kabul etmeniz gerekiyor.';
  if (msg.toLowerCase().includes('deposit')) return 'Depozito yatırmanız gerekiyor.';
  if (msg.toLowerCase().includes('ended')) return 'İhale sona ermiştir.';
  return msg;
}
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { Auction } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LiveAuctionScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'LiveAuction'>>();
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const auctionId = route.params.id;
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAllBids, setShowAllBids] = useState(false);

  const {
    status, currentPrice, bidCount, participantCount, watcherCount,
    timeRemainingMs, bidFeed, lastRejection, winnerIdMasked, finalPrice,
    hasActiveDeposit, hasPendingDeposit, depositLoading, announcements, optimisticBid,
    broadcastNameMap, extendedUntil, timeExtensionAnimation,
  } = useAuctionStore();

  const connectionStatus = useConnectionStore((s) => s.status);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch auction detail + deposit status
  useEffect(() => {
    async function load() {
      try {
        const { data } = await apiClient.get<Auction>(`/auctions/${auctionId}`, { params: { include_bids: 'true' } });
        setAuction(data);
        useAuctionStore.getState().setAuctionDetail(data);
        // Load bids from the response (included via include_bids=true)
        const recentBids = (data as any).recentBids ?? (data as any).recent_bids ?? (data as any).bids;
        if (Array.isArray(recentBids) && recentBids.length > 0) {
          const feed = recentBids.map((b: any) => ({
            bid_id: b.id ?? b.bid_id,
            user_id_masked: b.user_id ?? b.userId ?? b.user_id_masked,
            amount: b.amount,
            server_timestamp: b.server_ts ?? b.serverTs ?? b.server_timestamp ?? b.createdAt,
          }));
          useAuctionStore.setState({ bidFeed: feed });
        }
      } catch {
        navigation.goBack();
        return;
      }
      // Check deposit/participation status via the same endpoint web uses
      const storeState = useAuctionStore.getState();
      if ((storeState.hasActiveDeposit || storeState.hasPendingDeposit) && storeState.userDeposit) {
        useAuctionStore.setState({ depositLoading: false });
      } else {
        try {
          const { data } = await apiClient.get(`/auctions/${auctionId}/my-participation`);
          if (data.eligible) {
            useAuctionStore.getState().setUserDeposit({ status: data.depositStatus ?? 'held' } as any);
          } else if (data.depositStatus) {
            useAuctionStore.getState().setUserDeposit({ status: data.depositStatus } as any);
          } else {
            useAuctionStore.getState().setUserDeposit(null);
          }
        } catch {
          useAuctionStore.getState().setUserDeposit(null);
        }
      }
    }
    load();
  }, [auctionId]);

  // Connect WS
  useEffect(() => {
    connectToAuction(auctionId);
    return () => disconnectFromAuction();
  }, [auctionId]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const ms = useAuctionStore.getState().timeRemainingMs;
      if (ms !== null && ms > 0) {
        useAuctionStore.getState().setTimeRemaining(ms - 1000);
      }
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Reconnect on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && connectionStatus === 'disconnected') {
        connectToAuction(auctionId);
      }
    });
    return () => sub.remove();
  }, [auctionId, connectionStatus]);

  // Clear time extension animation
  useEffect(() => {
    if (timeExtensionAnimation) {
      const timer = setTimeout(() => {
        useAuctionStore.getState().clearTimeExtensionAnimation();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [timeExtensionAnimation]);

  const formatTime = (ms: number | null) => {
    if (ms === null || ms <= 0) return { display: '00:00:00', days: 0, isUrgent: false };
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return {
      display: d > 0 ? `${d} gün ${timeStr}` : timeStr,
      days: d,
      isUrgent: ms < 60000,
    };
  };

  const handleBid = useCallback(() => {
    if (!bidAmount || !currentPrice) return;
    const amount = parseFloat(bidAmount);
    const current = parseFloat(currentPrice);
    if (isNaN(amount) || amount <= current) {
      Alert.alert('Hata', 'Teklif mevcut fiyattan yüksek olmalıdır.');
      return;
    }
    setSubmitting(true);
    placeBid(auctionId, bidAmount, currentPrice);
    setBidAmount('');
    setTimeout(() => setSubmitting(false), 1500);
  }, [bidAmount, currentPrice, auctionId]);

  const minBidIncrement = auction?.minimumIncrement ? parseFloat(auction.minimumIncrement) : (auction as any)?.minBidIncrement ? parseFloat((auction as any).minBidIncrement) : 1000;
  const currentPriceNum = currentPrice ? parseFloat(currentPrice) : 0;

  const suggestedBids = currentPrice
    ? [
        { label: `+${formatPrice(String(minBidIncrement))}`, amount: String(currentPriceNum + minBidIncrement) },
        { label: `+${formatPrice(String(minBidIncrement * 5))}`, amount: String(currentPriceNum + minBidIncrement * 5) },
        { label: `+${formatPrice(String(minBidIncrement * 10))}`, amount: String(currentPriceNum + minBidIncrement * 10) },
      ]
    : [];

  const isActive = status === 'live' || status === 'active' || status === 'ending';
  const isEnded = status === 'ended' || status === 'settled';
  const timeInfo = formatTime(timeRemainingMs);

  const connectionColor = connectionStatus === 'connected' ? '#22c55e'
    : connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? '#eab308'
    : '#ef4444';

  const connectionLabel = connectionStatus === 'connected' ? 'Bağlı'
    : connectionStatus === 'connecting' ? 'Bağlanıyor...'
    : connectionStatus === 'reconnecting' ? 'Yeniden bağlanıyor...'
    : 'Bağlantı kesildi';

  const getBidUserName = (bid: BidFeedItem) => {
    if (broadcastNameMap && broadcastNameMap[bid.user_id_masked]) {
      return broadcastNameMap[bid.user_id_masked];
    }
    return bid.user_id_masked;
  };

  const visibleBids = showAllBids ? bidFeed : bidFeed.slice(0, 10);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ─────────────────────────────── */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Canlı İhale</Text>
            <View style={styles.connectionRow}>
              <View style={[styles.connectionDot, { backgroundColor: connectionColor }]} />
              <Text style={[styles.connectionLabel, { color: theme.colors.textSecondary }]}>{connectionLabel}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.watcherBadge, { backgroundColor: theme.colors.surface }]}>
              <Ionicons name="eye-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.watcherCount, { color: theme.colors.text }]}>{watcherCount}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: isActive ? 200 : 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Time Extension Animation ───────── */}
          {timeExtensionAnimation && (
            <View style={styles.extensionBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="time-outline" size={16} color="#2563eb" />
                <Text style={styles.extensionText}>
                  Süre {timeExtensionAnimation.addedMinutes} dakika uzatıldı!
                </Text>
              </View>
            </View>
          )}

          {/* ── Timer Card ────────────────────── */}
          <View style={[styles.timerCard, { backgroundColor: timeInfo.isUrgent ? '#fef2f2' : theme.colors.card, borderColor: timeInfo.isUrgent ? '#fecaca' : theme.colors.borderLight }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {timeInfo.isUrgent && !isEnded && <Ionicons name="flash" size={14} color="#dc2626" />}
              <Text style={[styles.timerLabel, { color: timeInfo.isUrgent ? '#dc2626' : theme.colors.textSecondary }]}>
                {isEnded ? 'İhale Tamamlandı' : timeInfo.isUrgent ? 'Son Dakikalar!' : 'Kalan Süre'}
              </Text>
            </View>
            <Text style={[styles.timerValue, { color: isEnded ? theme.colors.textMuted : timeInfo.isUrgent ? '#dc2626' : theme.colors.text }]}>
              {isEnded ? 'Bitti' : timeInfo.display}
            </Text>
            {extendedUntil && !isEnded && (
              <Text style={[styles.extendedNote, { color: theme.colors.textSecondary }]}>
                Uzatılmış süre
              </Text>
            )}
          </View>

          {/* ── Price Card ────────────────────── */}
          <View style={[styles.priceCard, { backgroundColor: theme.colors.primaryBg, borderColor: theme.colors.primary + '30' }]}>
            <Text style={[styles.priceLabel, { color: theme.colors.primaryDark }]}>
              {isEnded ? 'Son Fiyat' : 'Güncel Fiyat'}
            </Text>
            <Text style={[styles.priceValue, { color: theme.colors.primary }]}>
              {currentPrice ? formatPrice(currentPrice) : '—'}
            </Text>
            <View style={styles.priceStats}>
              <View style={styles.priceStat}>
                <Text style={[styles.priceStatValue, { color: theme.colors.text }]}>{bidCount}</Text>
                <Text style={[styles.priceStatLabel, { color: theme.colors.textSecondary }]}>Teklif</Text>
              </View>
              <View style={[styles.priceStatDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.priceStat}>
                <Text style={[styles.priceStatValue, { color: theme.colors.text }]}>{participantCount}</Text>
                <Text style={[styles.priceStatLabel, { color: theme.colors.textSecondary }]}>Katılımcı</Text>
              </View>
              <View style={[styles.priceStatDivider, { backgroundColor: theme.colors.border }]} />
              <View style={styles.priceStat}>
                <Text style={[styles.priceStatValue, { color: theme.colors.text }]}>{watcherCount}</Text>
                <Text style={[styles.priceStatLabel, { color: theme.colors.textSecondary }]}>İzleyici</Text>
              </View>
            </View>
          </View>

          {/* ── Announcements ─────────────────── */}
          {announcements.length > 0 && (
            <View style={[styles.announcementCard, { borderColor: '#fde68a' }]}>
              <View style={styles.announcementHeader}>
                <Ionicons name="megaphone-outline" size={16} color="#92400e" />
                <Text style={styles.announcementTitle}>Duyuru</Text>
              </View>
              <Text style={styles.announcementText}>{announcements[0].message}</Text>
            </View>
          )}

          {/* ── Winner Banner ─────────────────── */}
          {isEnded && winnerIdMasked && (
            <View style={styles.winnerCard}>
              <Ionicons name="trophy" size={48} color="#f59e0b" style={{ marginBottom: 8 }} />
              <Text style={styles.winnerTitle}>İhale Tamamlandı!</Text>
              <Text style={styles.winnerDetail}>
                Kazanan: {winnerIdMasked}
              </Text>
              <Text style={styles.winnerPrice}>
                {finalPrice ? formatPrice(finalPrice) : ''}
              </Text>
            </View>
          )}

          {/* ── Rejection Banner ──────────────── */}
          {lastRejection && (
            <View style={[styles.rejectionCard, { borderColor: '#fecaca' }]}>
              <View style={styles.rejectionIcon}>
                <Ionicons name="close-circle" size={22} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rejectionTitle}>Teklif Reddedildi</Text>
                <Text style={styles.rejectionReason}>{formatRejectionMessage((lastRejection as any).message || (lastRejection as any).reason || 'Teklifiniz kabul edilmedi.')}</Text>
              </View>
            </View>
          )}

          {/* ── Bid Feed ──────────────────────── */}
          <View style={[styles.feedCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.borderLight }]}>
            <View style={styles.feedHeader}>
              <Text style={[styles.feedTitle, { color: theme.colors.text }]}>Teklif Akışı</Text>
              <Text style={[styles.feedCount, { color: theme.colors.textSecondary }]}>{bidFeed.length} teklif</Text>
            </View>

            {bidFeed.length === 0 ? (
              <View style={styles.feedEmpty}>
                <Ionicons name="list-outline" size={40} color={theme.colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={[styles.feedEmptyText, { color: theme.colors.textSecondary }]}>
                  Henüz teklif verilmedi
                </Text>
                <Text style={[styles.feedEmptySubtext, { color: theme.colors.textMuted }]}>
                  {connectionStatus === 'connected'
                    ? 'İlk teklifi siz verin!'
                    : 'Bağlantı bekleniyor...'}
                </Text>
              </View>
            ) : (
              <>
                {visibleBids.map((bid, i) => {
                  const isOptimistic = bid.bid_id.startsWith('optimistic-');
                  const isFirst = i === 0;
                  return (
                    <View
                      key={bid.bid_id}
                      style={[
                        styles.bidItem,
                        isFirst && styles.bidItemFirst,
                        isFirst && { backgroundColor: theme.colors.primaryBg },
                        isOptimistic && { opacity: 0.6 },
                      ]}
                    >
                      <View style={[styles.bidRank, { backgroundColor: isFirst ? theme.colors.primary : theme.colors.surface }]}>
                        <Text style={[styles.bidRankText, { color: isFirst ? '#fff' : theme.colors.textSecondary }]}>
                          {i + 1}
                        </Text>
                      </View>
                      <View style={styles.bidInfo}>
                        <Text style={[styles.bidUser, { color: theme.colors.text }]}>
                          {getBidUserName(bid)}
                          {isOptimistic && ' (bekliyor...)'}
                        </Text>
                        <Text style={[styles.bidTime, { color: theme.colors.textMuted }]}>
                          {new Date(bid.server_timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </Text>
                      </View>
                      <Text style={[styles.bidAmount, { color: isFirst ? theme.colors.primary : theme.colors.text }]}>
                        {formatPrice(bid.amount)}
                      </Text>
                    </View>
                  );
                })}
                {bidFeed.length > 10 && !showAllBids && (
                  <TouchableOpacity style={styles.showMoreBtn} onPress={() => setShowAllBids(true)}>
                    <Text style={[styles.showMoreText, { color: theme.colors.primary }]}>
                      Tümünü Göster ({bidFeed.length} teklif)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* ── Auction Info ──────────────────── */}
          {auction && (
            <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.borderLight }]}>
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}>İhale Bilgileri</Text>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Başlangıç Fiyatı</Text>
                <Text style={[styles.infoValue, { color: theme.colors.text }]}>{formatPrice(auction.startingPrice)}</Text>
              </View>
              {auction.minBidIncrement && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Min. Artış</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text }]}>{formatPrice(auction.minBidIncrement)}</Text>
                </View>
              )}
              {(auction as any).depositAmount && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Kaparo Tutarı</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text }]}>{formatPrice((auction as any).depositAmount)}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* ── Bid Bar (Fixed Bottom) ──────────── */}
        {isActive && (
          <View style={[styles.bidBar, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
            {depositLoading ? (
              <View style={styles.bidBarCenter}>
                <Text style={[styles.depositMsg, { color: theme.colors.textSecondary }]}>Kaparo durumu kontrol ediliyor...</Text>
              </View>
            ) : hasPendingDeposit ? (
              <View style={styles.bidBarCenter}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Ionicons name="hourglass-outline" size={20} color="#d97706" />
                  <Text style={[styles.depositMsg, { color: '#d97706', fontWeight: '700' }]}>
                    Havale/EFT Onay Bekliyor
                  </Text>
                </View>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center' }}>
                  Ödemeniz admin tarafından onaylandıktan sonra teklif verebilirsiniz.
                </Text>
              </View>
            ) : !hasActiveDeposit ? (
              <View style={styles.bidBarCenter}>
                <Text style={[styles.depositMsg, { color: theme.colors.textSecondary }]}>
                  Teklif vermek için kaparo yatırmanız gerekiyor
                </Text>
                <Button
                  title="Kaparo Yatır"
                  onPress={() => {
                    (navigation as any).navigate('DepositPayment', { auctionId });
                  }}
                  variant="primary"
                  size="md"
                  style={{ marginTop: 8, width: '100%' }}
                />
              </View>
            ) : connectionStatus !== 'connected' ? (
              <View style={styles.bidBarCenter}>
                <Text style={[styles.depositMsg, { color: '#eab308' }]}>
                  Bağlantı bekleniyor... Teklif verebilmek için bağlanmanız gerekiyor.
                </Text>
              </View>
            ) : (
              <>
                {/* Quick bid buttons */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickBids} contentContainerStyle={{ gap: 8 }}>
                  {suggestedBids.map((s) => (
                    <TouchableOpacity
                      key={s.amount}
                      style={[styles.quickBidBtn, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryBg }]}
                      onPress={() => setBidAmount(s.amount)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.quickBidText, { color: theme.colors.primary }]}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* Input row */}
                <View style={styles.bidInputRow}>
                  <View style={[styles.bidInputWrap, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.bidInputPrefix, { color: theme.colors.textMuted }]}>₺</Text>
                    <TextInput
                      style={[styles.bidInput, { color: theme.colors.text }]}
                      placeholder="Teklif tutarı"
                      placeholderTextColor={theme.colors.textMuted}
                      keyboardType="numeric"
                      value={bidAmount}
                      onChangeText={setBidAmount}
                      returnKeyType="done"
                    />
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.bidSubmitBtn,
                      { backgroundColor: theme.colors.primary },
                      (submitting || !bidAmount) && { opacity: 0.5 },
                    ]}
                    onPress={handleBid}
                    disabled={submitting || !bidAmount}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.bidSubmitText}>
                      {submitting ? '...' : 'Teklif Ver'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionLabel: { fontSize: 10 },
  headerRight: {},
  watcherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  watcherCount: { fontSize: 13, fontWeight: '600' },

  // Extension banner
  extensionBanner: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  extensionText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },

  // Timer
  timerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  timerLabel: { fontSize: 13, fontWeight: '500', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  timerValue: { fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  extendedNote: { fontSize: 11, marginTop: 4 },

  // Price
  priceCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  priceValue: { fontSize: 30, fontWeight: '800' },
  priceStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 0 },
  priceStat: { flex: 1, alignItems: 'center' },
  priceStatValue: { fontSize: 18, fontWeight: '700' },
  priceStatLabel: { fontSize: 11, marginTop: 2 },
  priceStatDivider: { width: 1, height: 28 },

  // Announcement
  announcementCard: {
    backgroundColor: '#fefce8',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  announcementHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  announcementTitle: { fontWeight: '700', color: '#92400e', fontSize: 14 },
  announcementText: { color: '#78350f', fontSize: 14, lineHeight: 20 },

  // Winner
  winnerCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  winnerTitle: { fontSize: 20, fontWeight: '800', color: '#15803d', marginBottom: 4 },
  winnerDetail: { fontSize: 15, color: '#166534', marginBottom: 4 },
  winnerPrice: { fontSize: 24, fontWeight: '800', color: '#16a34a' },

  // Rejection
  rejectionCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rejectionIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
  rejectionTitle: { fontWeight: '700', color: '#dc2626', fontSize: 14 },
  rejectionReason: { color: '#991b1b', fontSize: 13, marginTop: 2 },

  // Feed
  feedCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  feedTitle: { fontSize: 16, fontWeight: '700' },
  feedCount: { fontSize: 12 },
  feedEmpty: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  feedEmptyText: { fontSize: 15, fontWeight: '600' },
  feedEmptySubtext: { fontSize: 13, marginTop: 4 },

  bidItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  bidItemFirst: { borderRadius: 0 },
  bidRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidRankText: { fontSize: 12, fontWeight: '700' },
  bidInfo: { flex: 1 },
  bidUser: { fontSize: 14, fontWeight: '600' },
  bidTime: { fontSize: 11, marginTop: 1 },
  bidAmount: { fontSize: 15, fontWeight: '700' },

  showMoreBtn: { alignItems: 'center', paddingVertical: 14 },
  showMoreText: { fontSize: 14, fontWeight: '600' },

  // Info
  infoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  infoTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 14, fontWeight: '600' },

  // Bid bar
  bidBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  bidBarCenter: { alignItems: 'center', paddingVertical: 4 },
  depositMsg: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  quickBids: { marginBottom: 10 },
  quickBidBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  quickBidText: { fontSize: 13, fontWeight: '700' },

  bidInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  bidInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  bidInputPrefix: { fontSize: 18, fontWeight: '600', marginRight: 6 },
  bidInput: { flex: 1, fontSize: 17, fontWeight: '600', padding: 0 },
  bidSubmitBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
