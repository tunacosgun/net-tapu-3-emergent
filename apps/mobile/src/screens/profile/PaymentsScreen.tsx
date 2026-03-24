import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice, formatDate } from '../../lib/format';
import { StatusBadge } from '../../components/ui';
import type { Payment } from '../../types';

export default function PaymentsScreen() {
  const { colors: c, isDark } = useTheme();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try { const { data } = await apiClient.get('/payments/my'); setPayments(data.data || data); } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <Text style={[styles.title, { color: c.text }]}>Ödemelerim</Text>
      <FlatList
        data={payments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await fetchData(); setRefreshing(false); }} tintColor={c.primary} />}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: c.card, borderColor: isDark ? c.borderLight : c.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={[styles.label, { color: c.textMuted }]}>{(item as any).type === 'deposit' ? 'Kaparo' : 'Ödeme'}</Text>
                <Text style={[styles.amount, { color: c.primary }]}>{formatPrice(item.amount)}</Text>
              </View>
              <StatusBadge status={item.status} />
            </View>
            <Text style={[styles.date, { color: c.textMuted }]}>{formatDate(item.createdAt, 'datetime')}</Text>
          </View>
        )}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={48} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>Henüz ödemeniz yok</Text>
            <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>Ödeme geçmişiniz burada görünecek</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  card: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 10 },
  label: { fontSize: 12, fontWeight: '500', marginBottom: 2 },
  amount: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  date: { fontSize: 12, fontWeight: '400' },
  empty: { alignItems: 'center', paddingTop: 100, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyDesc: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 20 },
});
