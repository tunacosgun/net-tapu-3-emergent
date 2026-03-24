import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme';
import { useAuthStore } from '../../stores/auth-store';

export default function SettingsScreen() {
  const { colors: c, isDark } = useTheme();
  const { clearTokens } = useAuthStore();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert('Hesabı Sil', 'Bu işlem geri alınamaz.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Hesabı Sil', style: 'destructive', onPress: () => clearTokens() },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <Text style={[styles.title, { color: c.text }]}>Ayarlar</Text>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Notifications */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>BİLDİRİMLER</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: isDark ? c.borderLight : c.border }]}>
          {[
            { label: 'Push Bildirimleri', value: pushEnabled, onChange: setPushEnabled },
            { label: 'E-posta Bildirimleri', value: emailEnabled, onChange: setEmailEnabled },
            { label: 'SMS Bildirimleri', value: smsEnabled, onChange: setSmsEnabled },
          ].map((item, i, arr) => (
            <View key={item.label} style={[styles.row, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? c.borderLight : '#f1f5f9' }]}>
              <Text style={[styles.rowLabel, { color: c.text }]}>{item.label}</Text>
              <Switch value={item.value} onValueChange={item.onChange} trackColor={{ true: c.primary }} />
            </View>
          ))}
        </View>

        {/* Legal */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>YASAL</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: isDark ? c.borderLight : c.border }]}>
          {[
            { label: 'Kullanım Koşulları', url: 'https://nettapu.com/terms' },
            { label: 'Gizlilik Politikası', url: 'https://nettapu.com/privacy' },
            { label: 'KVKK Aydınlatma Metni', url: 'https://nettapu.com/kvkk' },
          ].map((item, i, arr) => (
            <TouchableOpacity key={item.label}
              style={[styles.row, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDark ? c.borderLight : '#f1f5f9' }]}
              onPress={() => Linking.openURL(item.url)} activeOpacity={0.6}
            >
              <Text style={[styles.rowLabel, { color: c.text }]}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Account */}
        <Text style={[styles.sectionLabel, { color: c.textMuted }]}>HESAP</Text>
        <View style={[styles.card, { backgroundColor: c.card, borderColor: isDark ? c.borderLight : c.border }]}>
          <TouchableOpacity style={[styles.row, { borderBottomWidth: 1, borderBottomColor: isDark ? c.borderLight : '#f1f5f9' }]}
            onPress={() => Alert.alert('Şifre Değiştir', 'Yakında aktif olacak.')}
          >
            <Text style={[styles.rowLabel, { color: c.text }]}>Şifre Değiştir</Text>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
            <Text style={[styles.rowLabel, { color: c.error }]}>Hesabı Sil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: c.textMuted }]}>NetTapu v1.0.0</Text>
          <Text style={[styles.appCopy, { color: c.textMuted }]}>© 2026 NetTapu</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '500', letterSpacing: 0.5, marginTop: 24, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  appInfo: { alignItems: 'center', marginTop: 32 },
  appName: { fontSize: 13, fontWeight: '500' },
  appCopy: { fontSize: 11, fontWeight: '400', marginTop: 4 },
});
