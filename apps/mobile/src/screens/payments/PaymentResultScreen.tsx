import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import type { RouteProp, NavigationProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../api/client';
import { useTheme } from '../../theme';
import { formatPrice } from '../../lib/format';
import { useAuctionStore } from '../../stores/auction-store';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type ResultStatus = 'polling' | 'success' | 'failed' | 'timeout';

export default function PaymentResultScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'PaymentResult'>>();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const theme = useTheme();

  const { paymentId, auctionId, status: initialStatus } = route.params;
  const [resultStatus, setResultStatus] = useState<ResultStatus>(
    initialStatus === 'success' ? 'success' : initialStatus === 'failed' ? 'failed' : 'polling'
  );
  const [paymentAmount, setPaymentAmount] = useState<string | null>(null);
  const pollCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resultStatus !== 'polling') return;

    const poll = async () => {
      try {
        const { data } = await apiClient.get(`/payments/${paymentId}`);
        setPaymentAmount(data.amount);

        if (data.status === 'provisioned' || data.status === 'completed') {
          setResultStatus('success');
          // Update auction store deposit status
          useAuctionStore.getState().setUserDeposit(data);
          return;
        }
        if (data.status === 'failed' || data.status === 'cancelled') {
          setResultStatus('failed');
          return;
        }
      } catch {
        // Continue polling on network error
      }

      pollCount.current += 1;
      if (pollCount.current >= 15) {
        setResultStatus('timeout');
        return;
      }

      // Poll every 2 seconds
      pollTimer.current = setTimeout(poll, 2000);
    };

    poll();

    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [resultStatus, paymentId]);

  const goToAuction = () => {
    // Pop all payment screens and go back to LiveAuction
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: 'Main' },
          { name: 'LiveAuction', params: { id: auctionId } },
        ],
      })
    );
  };

  const goBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.center}>
        {resultStatus === 'polling' && (
          <>
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginBottom: 20 }} />
            <Text style={[styles.title, { color: theme.colors.text }]}>Ödeme İşleniyor</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Bankanızdan onay bekleniyor...{'\n'}Lütfen bu ekrandan ayrılmayın.
            </Text>
            <View style={styles.progressDots}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: theme.colors.primary, opacity: pollCount.current % 3 === i ? 1 : 0.3 },
                  ]}
                />
              ))}
            </View>
          </>
        )}

        {resultStatus === 'success' && (
          <>
            <View style={styles.successCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={[styles.title, { color: '#15803d' }]}>Ödeme Başarılı!</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Kaparonuz başarıyla yatırıldı.{'\n'}Artık ihaleye teklif verebilirsiniz.
            </Text>
            {paymentAmount && (
              <Text style={[styles.amount, { color: theme.colors.primary }]}>
                {formatPrice(paymentAmount)}
              </Text>
            )}
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={goToAuction}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>İhaleye Dön</Text>
            </TouchableOpacity>
          </>
        )}

        {resultStatus === 'failed' && (
          <>
            <View style={styles.failCircle}>
              <Text style={styles.failIcon}>✕</Text>
            </View>
            <Text style={[styles.title, { color: '#dc2626' }]}>Ödeme Başarısız</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Ödemeniz gerçekleştirilemedi.{'\n'}Lütfen kart bilgilerinizi kontrol edip tekrar deneyin.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={goBack}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>Tekrar Dene</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={goToAuction}>
              <Text style={[styles.secondaryBtnText, { color: theme.colors.textSecondary }]}>İhaleye Dön</Text>
            </TouchableOpacity>
          </>
        )}

        {resultStatus === 'timeout' && (
          <>
            <View style={[styles.failCircle, { backgroundColor: '#fef3c7', borderColor: '#fbbf24' }]}>
              <Text style={[styles.failIcon, { color: '#d97706' }]}>⏳</Text>
            </View>
            <Text style={[styles.title, { color: '#d97706' }]}>İşlem Sürüyor</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Ödeme onayı henüz alınamadı. İşleminiz arka planda devam ediyor olabilir.
              Ödemelerim sayfasından durumu kontrol edebilirsiniz.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={goToAuction}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryBtnText}>İhaleye Dön</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },

  title: { fontSize: 24, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  amount: { fontSize: 28, fontWeight: '800', marginBottom: 24 },

  progressDots: { flexDirection: 'row', gap: 8, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#dcfce7', borderWidth: 3, borderColor: '#22c55e',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  successIcon: { fontSize: 36, fontWeight: '800', color: '#22c55e' },

  failCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fef2f2', borderWidth: 3, borderColor: '#ef4444',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  failIcon: { fontSize: 36, fontWeight: '800', color: '#ef4444' },

  primaryBtn: {
    width: '100%', height: 56, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  secondaryBtn: { paddingVertical: 12 },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
});
