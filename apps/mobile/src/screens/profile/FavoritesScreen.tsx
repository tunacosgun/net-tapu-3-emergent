import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { ParcelCard } from '../../components/parcel/ParcelCard';
import type { Parcel } from '../../types';

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const { colors: c, isDark } = useTheme();
  const [favorites, setFavorites] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try { const { data } = await apiClient.get('/favorites'); setFavorites((data.data || data).map((f: any) => f.parcel || f)); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <Text style={[styles.title, { color: c.text }]}>Favorilerim</Text>
      <FlatList
        data={favorites}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <ParcelCard parcel={item} onPress={() => navigation.navigate('ParcelDetail', { id: item.id })} />
          </View>
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>Henüz favori ilanınız yok</Text>
            <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>Beğendiğiniz ilanları favorilere ekleyerek takip edin</Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  empty: { alignItems: 'center', paddingTop: 100, gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyDesc: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 20 },
});
