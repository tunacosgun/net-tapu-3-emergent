import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Animated, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { ParcelCard } from '../../components/parcel/ParcelCard';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { Parcel, PaginatedResponse } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type SortOption = 'newest' | 'price_asc' | 'price_desc';

export default function ParcelsListScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const isDark = theme.isDark;
  const c = theme.colors;
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<SortOption>('newest');
  const [showSort, setShowSort] = useState(false);

  const sortConfig: Record<SortOption, { sortBy: string; sortOrder: string; label: string; icon: string }> = {
    newest: { sortBy: 'createdAt', sortOrder: 'DESC', label: 'En Yeni', icon: 'time-outline' },
    price_asc: { sortBy: 'price', sortOrder: 'ASC', label: 'Fiyat ↑', icon: 'trending-up-outline' },
    price_desc: { sortBy: 'price', sortOrder: 'DESC', label: 'Fiyat ↓', icon: 'trending-down-outline' },
  };

  const fetchParcels = useCallback(async (p: number, reset = false) => {
    setLoading(true);
    try {
      const sc = sortConfig[sort];
      const params: Record<string, any> = {
        page: p, limit: 12, status: 'active', sortBy: sc.sortBy, sortOrder: sc.sortOrder,
      };
      if (search) params.search = search;
      const { data } = await apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params });
      setParcels((prev) => reset ? data.data : [...prev, ...data.data]);
      setTotalPages(data.meta.totalPages);
    } catch {} finally { setLoading(false); }
  }, [search, sort]);

  useEffect(() => { setPage(1); fetchParcels(1, true); }, [fetchParcels]);

  function loadMore() {
    if (page < totalPages && !loading) {
      const next = page + 1;
      setPage(next);
      fetchParcels(next);
    }
  }

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.titleBar}>
        <Text style={[styles.screenTitle, { color: c.text }]}>İlanlar</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('ParcelMap')}
          style={[styles.mapButton, { backgroundColor: isDark ? c.surface : '#fff', shadowColor: isDark ? '#000' : '#94a3b8' }]}
          activeOpacity={0.7}
        >
          <Ionicons name="navigate-outline" size={16} color={c.primary} />
          <Text style={[styles.mapButtonText, { color: c.primary }]}>Harita</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? c.surface : '#fff', shadowColor: isDark ? '#000' : '#94a3b8' }]}>
          <Ionicons name="search-outline" size={18} color={c.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            placeholder="İl, ilçe veya ilan ara..."
            placeholderTextColor={c.textMuted}
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {searchInput.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchInput(''); setSearch(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        {(Object.keys(sortConfig) as SortOption[]).map((key) => {
          const isActive = sort === key;
          return (
            <TouchableOpacity
              key={key} onPress={() => setSort(key)} activeOpacity={0.7}
              style={[styles.sortChip, {
                backgroundColor: isActive ? (isDark ? c.primaryBg : c.primaryBg) : 'transparent',
                borderColor: isActive ? c.primary : (isDark ? c.borderLight : c.border),
              }]}
            >
              <Text style={[styles.sortChipText, { color: isActive ? c.primary : c.textSecondary, fontWeight: isActive ? '700' : '400' }]}>
                {sortConfig[key].label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={parcels}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <ParcelCard parcel={item} onPress={() => navigation.navigate('ParcelDetail', { id: item.id })} />
          </View>
        )}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={loading ? <ActivityIndicator style={{ padding: 20 }} color={c.primary} /> : null}
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? c.surface : '#f8fafc' }]}>
              <Ionicons name="search-outline" size={36} color={c.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text }]}>İlan bulunamadı</Text>
            <Text style={[styles.emptyDesc, { color: c.textSecondary }]}>
              Farklı arama kriterleri deneyebilirsiniz
            </Text>
          </View>
        ) : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  titleBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
  },
  screenTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  mapButton: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  mapButtonText: { fontSize: 14, fontWeight: '500' },
  searchSection: { paddingHorizontal: 20, marginBottom: 12 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14,
    paddingHorizontal: 14, height: 48, gap: 10,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '400', padding: 0 },
  sortRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1,
  },
  sortChipText: { fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  emptyDesc: { fontSize: 14, fontWeight: '400', textAlign: 'center', lineHeight: 20 },
});
