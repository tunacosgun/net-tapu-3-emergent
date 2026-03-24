import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Alert, TouchableOpacity, Platform,
  KeyboardAvoidingView, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import apiClient from '../../api/client';
import { Input } from '../../components/ui';
import { useTheme } from '../../theme';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const isDark = theme.isDark;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: any) {
      Alert.alert('Hata', err?.response?.data?.message || 'İşlem başarısız');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" bounces={false}>
          {/* Header */}
          <LinearGradient
            colors={isDark ? ['#052e16', '#0f172a'] : ['#15803d', '#16a34a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Şifremi Unuttum</Text>
            <Text style={styles.headerSubtitle}>
              Şifre sıfırlama bağlantısı göndereceğiz
            </Text>
            <View style={styles.headerCircle} />
          </LinearGradient>

          {/* Content Card */}
          <View style={[styles.card, {
            backgroundColor: theme.colors.card,
            shadowColor: isDark ? '#000' : '#16a34a',
          }]}>
            {sent ? (
              <View style={styles.successBox}>
                <View style={[styles.successIcon, { backgroundColor: theme.colors.primaryBg }]}>
                  <Ionicons name="mail-outline" size={40} color={theme.colors.primary} />
                </View>
                <Text style={[styles.successTitle, { color: theme.colors.text }]}>E-posta Gönderildi</Text>
                <Text style={[styles.successDesc, { color: theme.colors.textSecondary }]}>
                  Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.goBack()}
                  style={{ borderRadius: 14, overflow: 'hidden', alignSelf: 'stretch', marginTop: 20 }}
                >
                  <LinearGradient colors={['#16a34a', '#15803d']} style={styles.submitBtn}>
                    <Text style={styles.submitText}>Giriş Sayfasına Dön</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[styles.infoBox, { backgroundColor: isDark ? theme.colors.surface : '#f0fdf4' }]}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.colors.primary} />
                  <Text style={[styles.infoText, { color: theme.colors.primary }]}>
                    Kayıtlı e-posta adresinizi girin
                  </Text>
                </View>
                <Input
                  label="E-posta Adresi"
                  placeholder="ornek@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading || !email}
                  style={{ borderRadius: 14, overflow: 'hidden', opacity: !email ? 0.5 : 1 }}
                >
                  <LinearGradient colors={['#16a34a', '#15803d']} style={styles.submitBtn}>
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.submitText}>Sıfırlama Bağlantısı Gönder</Text>
                        <Ionicons name="send" size={16} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    paddingHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  headerCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -30,
    right: -40,
  },
  card: {
    marginTop: -20,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  infoText: { fontSize: 13, fontWeight: '500', flex: 1 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  successBox: { alignItems: 'center', paddingVertical: 16 },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  successDesc: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
