import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice, formatDate } from '../../lib/format';
import { StatusBadge } from '../../components/ui';

interface Offer {
  id: string; parcelTitle: string; amount: string; status: string; createdAt: string; message?: string;
}

export default function OffersScreen() {
  const { colors: c, isDark } = useTheme();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try { const { data } = await apiClient.get('/offers/my'); setOffers(data.data || data); } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <Text style={[styles.title, { color: c.text }]}>Tekliflerim</Text>
      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} tintColor={c.primary} />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: isDark ? c.borderLight : c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.parcelTitle, { color: c.text }]} numberOfLines={1}>{item.parcelTitle}</Text>
                <Text style={[styles.amount, { color: c.primary }]}>{formatPrice(item.amount)}</Text>
              </View>
              <StatusBadge status={item.status} />
            </View>
            {item.message && <Text style={[styles.message, { color: c.textSecondary }]} numberOfLines={2}>{item.message}</Text>}
            <Text style={[styles.date, { color: c.textMuted }]}>{formatDate(item.createdAt, 'datetime')}</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>Henüz teklifiniz yok</Text>
            <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>İlan sahiplerine gönderdiğiniz teklifler burada listelenir</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 8 },
  parcelTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2, letterSpacing: -0.1 },
  amount: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  message: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  date: { fontSize: 12, fontWeight: '400' },
  empty: { alignItems: 'center', paddingTop: 100, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyDesc: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 20 },
});
