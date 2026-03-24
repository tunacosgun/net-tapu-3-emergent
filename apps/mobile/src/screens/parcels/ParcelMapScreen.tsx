import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker, Callout } from 'react-native-maps';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice } from '../../lib/format';
import { parcelStatusColor } from '../../components/ui/Badge';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { Parcel, PaginatedResponse } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TURKEY_CENTER = { latitude: 39.0, longitude: 35.0, latitudeDelta: 8, longitudeDelta: 12 };

export default function ParcelMapScreen() {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const [parcels, setParcels] = useState<Parcel[]>([]);

  useEffect(() => {
    apiClient.get<PaginatedResponse<Parcel>>('/parcels', { params: { limit: 200, status: 'active' } })
      .then(({ data }) => setParcels(data.data.filter((p) => p.latitude && p.longitude)))
      .catch(() => {});
  }, []);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.colors.card }]}>
        <Text style={{ color: theme.colors.text, fontSize: 16 }}>← Geri</Text>
      </TouchableOpacity>

      <MapView
        style={styles.map}
        initialRegion={TURKEY_CENTER}
        showsUserLocation
        showsMyLocationButton
      >
        {parcels.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: parseFloat(p.latitude!), longitude: parseFloat(p.longitude!) }}
            pinColor={parcelStatusColor(p.status)}
          >
            <Callout onPress={() => navigation.navigate('ParcelDetail', { id: p.id })}>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.calloutLocation}>{p.city}, {p.district}</Text>
                <Text style={styles.calloutPrice}>{formatPrice(p.price)}</Text>
                <Text style={styles.calloutCta}>İlana Git →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={[styles.legend, { backgroundColor: theme.colors.card }]}>
        {[
          { color: '#22c55e', label: 'Satışta' },
          { color: '#eab308', label: 'Kaparo' },
          { color: '#ef4444', label: 'Satıldı' },
        ].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={[styles.legendText, { color: theme.colors.textSecondary }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  backBtn: { position: 'absolute', top: 60, left: 16, zIndex: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  callout: { width: 200, padding: 4 },
  calloutTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  calloutLocation: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  calloutPrice: { fontSize: 16, fontWeight: '700', color: '#16a34a', marginBottom: 4 },
  calloutCta: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  legend: { position: 'absolute', bottom: 40, left: 16, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11 },
});
