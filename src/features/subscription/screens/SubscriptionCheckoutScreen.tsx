// Thanh toán cho gói trả phí — làm theo mẫu Buổi 9 BookStore:
// - Lỗi validate tính từ state mỗi lần render (không state lỗi riêng),
//   chỉ hiện lỗi sau khi đã chạm vào ô nhập (touched).
// - Gửi lỗi thì giữ nguyên form, không đổi gói.
// - Luồng v2 (một trang): form tên + SĐT + phương thức; khi form hợp
//   lệ thì TỰ tạo đơn nháp (createDraftOrder, mã AV-YYYYMMDD-XXXX)
//   để có mã đơn + số tiền rồi hiện QR NGAY trên cùng trang, không
//   cần bấm nút xác nhận mới thấy QR. Chỉ khi bấm "Tôi đã thanh toán"
//   mới kích hoạt gói 30 ngày (setActivePlan + markOrderPaid) rồi hiện
//   màn thành công.
// - QR chuyển khoản: VietQR Agribank (BIN 970405, STK 6902205441281,
//   chủ TK BUI NGOC HIEN), nội dung = mã đơn. QR MoMo: SĐT 0972606925.

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Clipboard,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../../context/SettingsContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import { formatVnd, getPlanById } from '../plans';
import {
  DEMO_BANK,
  createDraftOrder,
  markOrderPaid,
  validateCheckoutName,
  validateCheckoutPhone,
  type DemoOrder,
  type PaymentMethod,
} from '../subscriptionService';
import { PaymentOption } from '../../../components/subscription/PaymentOption';
import { s } from './SubscriptionCheckoutScreen.styles';

// VietQR: BIN Agribank 970405, STK 6902205441281, chủ TK BUI NGOC HIEN.
// addInfo = mã đơn (chỉ chữ hoa, số và dấu gạch ngang, không dấu/khoảng trắng).
const vietQrUrl = (amount: number, orderId: string): string =>
  `https://img.vietqr.io/image/970405-6902205441281-compact2.png?amount=${amount}&addInfo=${orderId}&accountName=BUI%20NGOC%20HIEN`;

// QR MoMo: nội dung mã hóa MoMo|SĐT|Số tiền|Mã đơn.
const momoQrUrl = (amount: number, orderId: string): string =>
  `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    `MoMo|0972606925|${amount}|${orderId}`,
  )}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('vi-VN') : '—';

type Step = 'form' | 'success';

export default function SubscriptionCheckoutScreen({ navigation, route }: any) {
  const { theme, t } = useSettings();
  const { refresh, setActivePlan } = useSubscription();
  const plan = getPlanById(route?.params?.planId);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const draftingRef = useRef(false);

  // Lỗi và valid tính từ state (mẫu Buổi 9, bài 9.1).
  const nameError = validateCheckoutName(name);
  const phoneError = validateCheckoutPhone(phone);
  const valid = !nameError && !phoneError && plan.id !== 'free';

  // Đơn nháp hiện tại có khớp đúng form đang nhập không (tên + SĐT +
  // phương thức). Đổi tên/SĐT/phương thức thì tạo đơn nháp mới để mã
  // đơn trên QR luôn khớp form; chỉ đổi phương thức thì QR đổi theo
  // phương thức đã chọn, mã đơn vẫn là đơn nháp mới nhất.
  const draftMatches =
    !!order &&
    order.name === name.trim() &&
    order.phone === phone.trim() &&
    order.paymentMethod === paymentMethod;

  // Form vừa hợp lệ thì tự tạo đơn nháp (debounce để không tạo đơn
  // theo từng ký tự gõ). Tạo đơn xong QR hiện ngay cùng trang — không
  // cần bấm nút xác nhận. Đơn nháp CHƯA kích hoạt gói.
  useEffect(() => {
    if (!valid || step !== 'form') return;
    if (draftMatches) return;
    const timer = setTimeout(() => {
      if (draftingRef.current) return;
      draftingRef.current = true;
      setDrafting(true);
      setDraftError(null);
      createDraftOrder({
        planId: plan.id,
        name,
        phone,
        paymentMethod,
      })
        .then(setOrder)
        .catch(() => {
          // Giữ nguyên form khi tạo đơn lỗi, giống Buổi 9 giữ nguyên giỏ.
          setDraftError(t('checkout.submitFailed'));
        })
        .finally(() => {
          draftingRef.current = false;
          setDrafting(false);
        });
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, name, phone, paymentMethod, plan.id, step, draftMatches]);

  // Bấm sau khi đã quét mã QR: kích hoạt gói 30 ngày như cũ, đánh dấu
  // đơn đã thanh toán, rồi hiện màn thành công với mã đơn.
  const confirmPaid = async () => {
    if (!order || submitting) return;
    setSubmitting(true);
    try {
      await setActivePlan(plan.id, order.id);
      await markOrderPaid(order.id);
      await refresh();
      setStep('success');
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), t('checkout.submitFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = (value: string) => {
    try {
      Clipboard.setString(value);
      Alert.alert(t('checkout.copied'));
    } catch {
      // Clipboard không có sẵn thì hiện giá trị để người dùng tự chép.
      Alert.alert(t('checkout.copied'), value);
    }
  };

  if (plan.id === 'free') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <View style={[s.wrap, { padding: 24, justifyContent: 'center' }]}>
            <Text style={[s.successTitle, { color: theme.text }]}>
              {t('subscription.freeActivated')}
            </Text>
            <TouchableOpacity
              style={s.confirmBtn}
              onPress={() => navigation.navigate('Plans')}
            >
              <Text style={s.confirmBtnText}>{t('checkout.backToPlans')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={s.wrap}>
          <View style={s.header}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name='chevron-back' size={26} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[s.headerTitle, { color: theme.text }]}>
                {t('checkout.title')}
              </Text>
              <Text style={[s.headerSub, { color: theme.muted }]}>
                {plan.name}
              </Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={s.content}>
            {step === 'success' && order ? (
              <View
                style={[s.successCard, { backgroundColor: theme.card }]}
              >
                <Ionicons
                  name='checkmark-circle'
                  size={56}
                  color={theme.primaryDark}
                />
                <Text style={[s.successTitle, { color: theme.text }]}>
                  {t('checkout.successTitle')}
                </Text>
                <Text style={[s.successBody, { color: theme.muted }]}>
                  {t('checkout.successBodyActive')}
                </Text>
                <Text style={[s.successLine, { color: theme.text }]}>
                  {t('checkout.orderCode')}: {order.id}
                </Text>
                <Text style={[s.successLine, { color: theme.text }]}>
                  {order.planName} · {formatVnd(order.total)}
                </Text>
                <Text style={[s.successLine, { color: theme.text }]}>
                  {t('checkout.validUntil')}: {formatDate(order.expiresAt)}
                </Text>
                <Text style={[s.successBody, { color: theme.muted }]}>
                  {t('checkout.renewalLine', {
                    date: formatDate(order.expiresAt),
                  })}
                </Text>
                <Text style={[s.successBody, { color: theme.muted }]}>
                  {t('checkout.cancelBeforeRenewal')}
                </Text>
                <TouchableOpacity
                  style={[s.confirmBtn, { alignSelf: 'stretch' }]}
                  onPress={() =>
                    navigation.navigate('Main', { screen: 'AccountTab' })
                  }
                >
                  <Text style={s.confirmBtnText}>{t('checkout.done')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.secondaryBtn, { borderColor: theme.border }]}
                  onPress={() =>
                    navigation.navigate('Main', { screen: 'HomeTab' })
                  }
                >
                  <Text style={[s.secondaryBtnText, { color: theme.text }]}>
                    {t('checkout.goHome')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={[s.summary, { backgroundColor: theme.card }]}>
                  <Text style={[s.summaryName, { color: theme.text }]}>
                    {plan.name}
                  </Text>
                  <Text style={[s.summaryPrice, { color: theme.primaryDark }]}>
                    {formatVnd(plan.priceVnd)}
                    {plan.period}
                  </Text>
                </View>

                <Text style={[s.label, { color: theme.text }]}>
                  {t('checkout.name')}
                </Text>
                <TextInput
                  style={[s.field, { borderColor: theme.border, backgroundColor: theme.cardAlt, color: theme.text }]}
                  value={name}
                  onChangeText={setName}
                  onBlur={() => setTouched(true)}
                  placeholder={t('checkout.namePlaceholder')}
                  placeholderTextColor={theme.muted}
                />
                {touched && nameError && (
                  <Text style={s.error}>{t(nameError)}</Text>
                )}

                <Text style={[s.label, { color: theme.text }]}>
                  {t('checkout.phone')}
                </Text>
                <TextInput
                  style={[s.field, { borderColor: theme.border, backgroundColor: theme.cardAlt, color: theme.text }]}
                  value={phone}
                  onChangeText={setPhone}
                  onBlur={() => setTouched(true)}
                  placeholder={t('checkout.phonePlaceholder')}
                  placeholderTextColor={theme.muted}
                  keyboardType='phone-pad'
                />
                {touched && phoneError && (
                  <Text style={s.error}>{t(phoneError)}</Text>
                )}

                <Text style={[s.label, { color: theme.text }]}>
                  {t('checkout.paymentMethod')}
                </Text>
                <PaymentOption
                  method='bank'
                  selected={paymentMethod === 'bank'}
                  title={t('checkout.bank')}
                  desc={t('checkout.bankDesc')}
                  icon='card-outline'
                  theme={theme}
                  onSelect={setPaymentMethod}
                />
                <PaymentOption
                  method='momo'
                  selected={paymentMethod === 'momo'}
                  title={t('checkout.momo')}
                  desc={t('checkout.momoDesc')}
                  icon='wallet-outline'
                  theme={theme}
                  onSelect={setPaymentMethod}
                />
                {paymentMethod === 'bank' && (
                  <View style={[s.bankBox, { backgroundColor: theme.cardAlt }]}>
                    <Text style={[s.bankLine, { color: theme.text }]}>
                      {DEMO_BANK.bank} · {DEMO_BANK.account}
                    </Text>
                    <Text style={[s.bankLine, { color: theme.text }]}>
                      {DEMO_BANK.holder}
                    </Text>
                    <Text style={[s.bankLine, { color: theme.muted }]}>
                      {t('checkout.bankContent')}: AURAVITAL {phone || '090xxxxxxx'}
                    </Text>
                  </View>
                )}

                {draftError && <Text style={s.error}>{draftError}</Text>}

                {!valid && (
                  <Text style={[s.successBody, { color: theme.muted }]}>
                    {t('checkout.fillToShowQr')}
                  </Text>
                )}
                {valid && !draftMatches && (
                  <Text style={[s.successBody, { color: theme.muted }]}>
                    {drafting || !order
                      ? t('checkout.creatingQr')
                      : t('checkout.fillToShowQr')}
                  </Text>
                )}

                {valid && draftMatches && order ? (
                  <View
                    style={[s.successCard, { backgroundColor: theme.card }]}
                  >
                    <Text style={[s.successTitle, { color: theme.text }]}>
                      {t('checkout.qrTitle')}
                    </Text>
                    <Image
                      source={{
                        uri:
                          paymentMethod === 'bank'
                            ? vietQrUrl(order.total, order.id)
                            : momoQrUrl(order.total, order.id),
                      }}
                      style={s.qrImage}
                      resizeMode='contain'
                    />
                    {paymentMethod === 'bank' ? (
                      <>
                        <Text style={[s.qrLine, { color: theme.text }]}>
                          {t('checkout.qrBankName')}: {DEMO_BANK.bank}
                        </Text>
                        <Text style={[s.qrLine, { color: theme.text }]}>
                          {t('checkout.qrAccountLabel')}: {DEMO_BANK.account}
                        </Text>
                        <Text style={[s.qrLine, { color: theme.text }]}>
                          {t('checkout.qrHolderLabel')}: {DEMO_BANK.holder}
                        </Text>
                      </>
                    ) : (
                      <Text style={[s.qrLine, { color: theme.text }]}>
                        {t('checkout.qrMomoPhoneLabel')}: 0972606925
                      </Text>
                    )}
                    <Text style={[s.qrLine, { color: theme.text }]}>
                      {t('checkout.qrAmountLabel')}: {formatVnd(order.total)}
                    </Text>
                    <Text style={[s.qrLine, { color: theme.text }]}>
                      {t('checkout.qrContentLabel')}: {order.id}
                    </Text>
                    <Text style={[s.successLine, { color: theme.text }]}>
                      {t('checkout.orderCode')}: {order.id}
                    </Text>
                    <Text style={[s.successBody, { color: theme.muted }]}>
                      {t('checkout.qrScanHint')}
                    </Text>

                    <View style={s.copyRow}>
                      {paymentMethod === 'bank' && (
                        <TouchableOpacity
                          style={[s.copyBtn, { borderColor: theme.border }]}
                          onPress={() => copyText(DEMO_BANK.account)}
                        >
                          <Text style={[s.copyBtnText, { color: theme.text }]}>
                            {t('checkout.copyAccount')}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[s.copyBtn, { borderColor: theme.border }]}
                        onPress={() => copyText(order.id)}
                      >
                        <Text style={[s.copyBtnText, { color: theme.text }]}>
                          {t('checkout.copyContent')}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[s.confirmBtn, { alignSelf: 'stretch' }]}
                      onPress={confirmPaid}
                      disabled={submitting}
                    >
                      <Text style={s.confirmBtnText}>
                        {submitting
                          ? t('common.saving')
                          : t('checkout.paidButton')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
