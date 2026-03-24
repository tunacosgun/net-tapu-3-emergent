import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Clipboard,
  Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import type { RouteProp, NavigationProp } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice } from '../../lib/format';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { useAuctionStore } from '../../stores/auction-store';
import type { Auction } from '../../types';

type PaymentMethod = 'credit_card' | 'bank_transfer';

export default function DepositPaymentScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'DepositPayment'>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { auctionId } = route.params;

  const [auction, setAuction] = useState<Auction | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [bankInfo, setBankInfo] = useState<{
    bank_name?: string; bank_iban?: string; bank_account_holder?: string; bank_branch?: string;
  }>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [auctionRes, settingsRes] = await Promise.all([
          apiClient.get<Auction>(`/auctions/${auctionId}`),
          apiClient.get('/content/site-settings').catch(() => ({ data: {} })),
        ]);
        if (!cancelled) {
          setAuction(auctionRes.data);
          const s = settingsRes.data || {};
          setBankInfo({
            bank_name: s.bank_name || 'Ziraat Bankası',
            bank_iban: s.bank_iban || 'TR00 0000 0000 0000 0000 0000 00',
            bank_account_holder: s.bank_account_holder || 'TR Eser Group',
            bank_branch: s.bank_branch || '',
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('İhale bilgisi alınamadı.');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [auctionId]);

  const handleSubmit = () => {
    if (!auction) return;
    const amt = (auction as any).requiredDeposit || (auction as any).depositAmount || '0';
    const methodLabel = paymentMethod === 'credit_card' ? 'Kredi Kartı' : 'Havale / EFT';
    Alert.alert(
      'Ödeme Onayı',
      `${formatPrice(amt)} tutarında depozito ödemesi ${methodLabel} yöntemiyle başlatılacaktır. Devam etmek istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Ödemeyi Başlat', style: 'default', onPress: () => executePayment() },
      ],
    );
  };

  const executePayment = async () => {
    if (!auction) return;
    setError(null);
    setSubmitting(true);

    try {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const depositAmount = (auction as any).requiredDeposit || (auction as any).depositAmount || '100000';

      const { data } = await apiClient.post('/payments', {
        parcelId: (auction as any).parcelId || null,
        auctionId,
        amount: depositAmount,
        currency: (auction as any).currency || 'TRY',
        paymentMethod,
        idempotencyKey,
        description: `Depozito: ${auction.title}`,
      });

      if (paymentMethod === 'bank_transfer') {
        // Bank transfer stays pending — update store and go back to auction
        useAuctionStore.getState().setUserDeposit(data);
        Alert.alert(
          'Havale Talimatı Oluşturuldu',
          'Lütfen belirtilen IBAN\'a havale/EFT yapın. Ödemeniz admin tarafından onaylandıktan sonra teklif verebilirsiniz.',
          [{
            text: 'Tamam',
            onPress: () => navigation.dispatch(
              CommonActions.reset({ index: 1, routes: [{ name: 'Main' }, { name: 'LiveAuction', params: { id: auctionId } }] })
            ),
          }],
        );
      } else if (data.status === 'awaiting_3ds' && data.threeDsRedirectUrl) {
        navigation.navigate('ThreeDsWebView' as any, {
          url: data.threeDsRedirectUrl,
          paymentId: data.id,
          auctionId,
        });
      } else if (data.status === 'provisioned' || data.status === 'completed') {
        navigation.navigate('PaymentResult' as any, {
          paymentId: data.id,
          auctionId,
          status: 'success',
        });
      } else {
        navigation.navigate('PaymentResult' as any, {
          paymentId: data.id,
          auctionId,
          status: 'pending',
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Ödeme başarısız oldu.');
    } finally {
      setSubmitting(false);
    }
  };

  const depositAmount = auction
    ? (auction as any).requiredDeposit || (auction as any).depositAmount || null
    : null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[styles.backIcon, { color: theme.colors.text }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Kaparo Öde</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 16 }]} showsVerticalScrollIndicator={false}>
          {/* Auction Info Card */}
          {auction && (
            <View style={[styles.auctionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.borderLight }]}>
              <Text style={[styles.auctionTitle, { color: theme.colors.text }]} numberOfLines={2}>
                {auction.title}
              </Text>
              <View style={styles.auctionRow}>
                <Text style={[styles.auctionLabel, { color: theme.colors.textSecondary }]}>Depozito Tutarı</Text>
                <Text style={[styles.auctionAmount, { color: theme.colors.primary }]}>
                  {depositAmount ? formatPrice(depositAmount) : '—'}
                </Text>
              </View>
              <View style={styles.auctionRow}>
                <Text style={[styles.auctionLabel, { color: theme.colors.textSecondary }]}>Başlangıç Fiyatı</Text>
                <Text style={[styles.auctionValue, { color: theme.colors.text }]}>
                  {formatPrice(auction.startingPrice)}
                </Text>
              </View>
            </View>
          )}

          {/* Security Notice */}
          <View style={[styles.securityCard, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
            <Text style={styles.securityIcon}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.securityTitle, { color: '#15803d' }]}>Güvenli Ödeme</Text>
              <Text style={[styles.securityText, { color: '#166534' }]}>
                Tüm ödemeler 3D Secure ile korunmaktadır. İhaleyi kazanamazsanız kaparonuz iade edilir.
              </Text>
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={[styles.errorCard, { borderColor: '#fecaca' }]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Payment Method Selection */}
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Ödeme Yöntemi</Text>
          <View style={styles.methodGrid}>
            <TouchableOpacity
              style={[
                styles.methodCard,
                { borderColor: paymentMethod === 'credit_card' ? theme.colors.primary : theme.colors.borderLight, backgroundColor: paymentMethod === 'credit_card' ? theme.colors.primaryBg : theme.colors.card },
              ]}
              onPress={() => setPaymentMethod('credit_card')}
              activeOpacity={0.7}
            >
              <Text style={styles.methodIcon}>💳</Text>
              <Text style={[styles.methodTitle, { color: paymentMethod === 'credit_card' ? theme.colors.primary : theme.colors.text }]}>Kredi Kartı</Text>
              <Text style={[styles.methodDesc, { color: theme.colors.textSecondary }]}>3D Secure güvenli</Text>
              {paymentMethod === 'credit_card' && (
                <View style={[styles.methodCheck, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.methodCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodCard,
                { borderColor: paymentMethod === 'bank_transfer' ? theme.colors.primary : theme.colors.borderLight, backgroundColor: paymentMethod === 'bank_transfer' ? theme.colors.primaryBg : theme.colors.card },
              ]}
              onPress={() => setPaymentMethod('bank_transfer')}
              activeOpacity={0.7}
            >
              <Text style={styles.methodIcon}>🏦</Text>
              <Text style={[styles.methodTitle, { color: paymentMethod === 'bank_transfer' ? theme.colors.primary : theme.colors.text }]}>Havale / EFT</Text>
              <Text style={[styles.methodDesc, { color: theme.colors.textSecondary }]}>Banka transferi</Text>
              {paymentMethod === 'bank_transfer' && (
                <View style={[styles.methodCheck, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.methodCheckText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Credit Card Info */}
          {paymentMethod === 'credit_card' && (
            <View style={[styles.infoCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.borderLight }]}>
              <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
                "Ödemeyi Başlat" butonuna bastığınızda güvenli ödeme sayfasına yönlendirileceksiniz.
                Kart bilgileriniz bankanızın güvenli 3D Secure sayfasında girilecektir.
              </Text>
              <View style={styles.cardLogos}>
                <View style={[styles.cardLogo, { backgroundColor: '#1a1f71' }]}>
                  <Text style={styles.cardLogoText}>VISA</Text>
                </View>
                <View style={[styles.cardLogo, { backgroundColor: '#eb001b' }]}>
                  <Text style={styles.cardLogoText}>MC</Text>
                </View>
                <View style={[styles.cardLogo, { backgroundColor: '#006fcf' }]}>
                  <Text style={styles.cardLogoText}>AMEX</Text>
                </View>
              </View>
            </View>
          )}

          {/* Bank Transfer Info */}
          {paymentMethod === 'bank_transfer' && (() => {
            const transferCode = `NT-${auctionId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
            return (
              <View style={[styles.bankCard, { borderColor: '#93c5fd' }]}>
                <Text style={[styles.bankTitle, { color: '#1e40af' }]}>Havale / EFT Bilgileri</Text>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Banka</Text>
                  <Text style={styles.bankValue}>{bankInfo.bank_name}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>IBAN</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setString(bankInfo.bank_iban || '');
                      Alert.alert('', 'IBAN kopyalandı');
                    }}
                  >
                    <Text style={[styles.bankValue, { textDecorationLine: 'underline' }]}>
                      {bankInfo.bank_iban}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.bankRow}>
                  <Text style={styles.bankLabel}>Hesap Sahibi</Text>
                  <Text style={styles.bankValue}>{bankInfo.bank_account_holder}</Text>
                </View>
                {bankInfo.bank_branch ? (
                  <View style={styles.bankRow}>
                    <Text style={styles.bankLabel}>Şube</Text>
                    <Text style={styles.bankValue}>{bankInfo.bank_branch}</Text>
                  </View>
                ) : null}
                <View style={[styles.transferCodeCard, { borderColor: '#60a5fa' }]}>
                  <Text style={styles.transferCodeLabel}>Açıklama Kodu (zorunlu)</Text>
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setString(transferCode);
                      Alert.alert('', 'Transfer kodu kopyalandı');
                    }}
                  >
                    <Text style={styles.transferCodeValue}>{transferCode}</Text>
                  </TouchableOpacity>
                  <Text style={styles.transferCodeHint}>
                    Havale açıklamasına bu kodu yazmanız zorunludur
                  </Text>
                </View>
                <View style={[styles.bankNote, { borderTopColor: '#bfdbfe' }]}>
                  <Text style={styles.bankNoteText}>
                    📋 Havale yaptıktan sonra dekontunuzu WhatsApp veya e-posta ile iletmeniz gerekmektedir.
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: theme.colors.primary },
              submitting && { opacity: 0.6 },
            ]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <View style={styles.submitLoading}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.submitText}>İşleniyor...</Text>
              </View>
            ) : (
              <Text style={styles.submitText}>
                {paymentMethod === 'credit_card'
                  ? `${depositAmount ? formatPrice(depositAmount) + ' ' : ''}Ödemeyi Başlat`
                  : 'Havale Bildirimini Gönder'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Terms */}
          <Text style={[styles.terms, { color: theme.colors.textMuted }]}>
            Ödemeyi başlatarak açık artırma katılım şartlarını ve
            depozito iade politikasını kabul etmiş olursunuz.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 28, fontWeight: '300', marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },

  content: { padding: 16 },

  // Auction card
  auctionCard: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12 },
  auctionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  auctionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  auctionLabel: { fontSize: 14 },
  auctionAmount: { fontSize: 20, fontWeight: '800' },
  auctionValue: { fontSize: 14, fontWeight: '600' },

  // Security
  securityCard: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 14, gap: 10, marginBottom: 12 },
  securityIcon: { fontSize: 20 },
  securityTitle: { fontWeight: '700', fontSize: 14, marginBottom: 2 },
  securityText: { fontSize: 12, lineHeight: 18 },

  // Error
  errorCard: { backgroundColor: '#fef2f2', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  errorText: { color: '#dc2626', fontSize: 14 },

  // Section title
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: 4 },

  // Method grid
  methodGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  methodCard: {
    flex: 1, borderRadius: 16, borderWidth: 2, padding: 16, alignItems: 'center', position: 'relative',
  },
  methodIcon: { fontSize: 28, marginBottom: 8 },
  methodTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  methodDesc: { fontSize: 11, textAlign: 'center' },
  methodCheck: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  methodCheckText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Info card
  infoCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  infoText: { fontSize: 13, lineHeight: 20 },
  cardLogos: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cardLogo: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  cardLogoText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Bank card
  bankCard: { backgroundColor: '#eff6ff', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 16 },
  bankTitle: { fontWeight: '700', fontSize: 14, marginBottom: 10 },
  bankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  bankLabel: { fontSize: 12, color: '#3b82f6', fontWeight: '500' },
  bankValue: { fontSize: 13, color: '#1e3a8a', fontWeight: '600' },
  transferCodeCard: { backgroundColor: '#dbeafe', borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 10, alignItems: 'center' },
  transferCodeLabel: { fontSize: 11, color: '#1e40af', fontWeight: '600', marginBottom: 4 },
  transferCodeValue: { fontSize: 22, fontWeight: '800', color: '#1e3a8a', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  transferCodeHint: { fontSize: 10, color: '#3b82f6', marginTop: 4 },
  bankNote: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  bankNoteText: { fontSize: 11, color: '#1d4ed8', lineHeight: 17 },

  // Submit
  submitBtn: { borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  submitLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  // Terms
  terms: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
