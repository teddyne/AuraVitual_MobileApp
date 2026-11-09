import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, G } from 'react-native-svg';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { AppHeader } from '../../../components/ui/AppHeader';
import {
  formatNumber,
  getMetricByDate,
  getProfile,
  localToday,
  saveWater,
} from '../../../api/auravitalApi';
import { syncReminderNotifications } from '../../../utils/reminders/reminders';
import { s } from './WaterDetailScreen.styles';

const QUICK_AMOUNTS = [100, 200, 250, 400, 500];

export default function WaterDetailScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, t } = useSettings();
  const [loading, setLoading] = useState(true);
  const [todayTotal, setTodayTotal] = useState(0);
  const [goal, setGoal] = useState(0);
  const [selected, setSelected] = useState<number | null>(250);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [profile, metric] = await Promise.all([
        getProfile(user.id),
        getMetricByDate(user.id, localToday()),
      ]);
      setGoal(profile?.water_goal_ml ?? 0);
      setTodayTotal(metric?.water_ml ?? 0);
    } catch {
      // Giữ số cũ, không kẹt màn hình ở loading.
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Ưu tiên ô nhập tay khi có chữ; không thì lấy lượng đã chọn.
  const customNum = Number.parseInt(custom.replace(/\D/g, ''), 10);
  const amount = custom.trim().length > 0 ? customNum : selected;
  const pct = goal > 0 ? Math.min(todayTotal / goal, 1) : 0;
  // Biểu đồ tròn: vòng 170px, r = 79, chu vi C ≈ 496.
  const RING_R = 79;
  const RING_C = 2 * Math.PI * RING_R;

  const onAdd = async () => {
    if (!user) return;
    if (!Number.isFinite(amount as number) || (amount as number) < 1 || (amount as number) > 2000) {
      setError(t('waterDetail.amountRange'));
      return;
    }
    setError('');
    setSaving(true);
    try {
      const next = todayTotal + (amount as number);
      await saveWater(user.id, next);
      setTodayTotal(next);
      setCustom('');
      // Ghi nước xong thì đồng bộ lại nhắc: vừa đủ mục tiêu thì hủy
      // hết nhắc nước còn lại trong ngày (cùng cách làm ở Trang chủ).
      syncReminderNotifications().catch(() => {});
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t('common.errorTitle'), e?.message ?? t('common.loadFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <ActivityIndicator
            size='large'
            color={theme.primaryDark}
            style={{ marginTop: 80 }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <AppHeader title={t('waterDetail.title')} withTopInset={false} />
        </View>
        <ScrollView contentContainerStyle={s.scroll}>
          {/* Tổng hôm nay / mục tiêu — biểu đồ tròn thay cho thanh ngang */}
          <View style={[s.totalCard, { backgroundColor: theme.card }]}>
            <Text style={[s.totalLabel, { color: theme.muted }]}>
              {t('waterDetail.todayTotal')}
            </Text>
            <View style={s.ringWrap}>
              <Svg width={170} height={170} viewBox='0 0 170 170'>
                <G rotation='-90' origin='85, 85'>
                  <Circle
                    cx={85}
                    cy={85}
                    r={RING_R}
                    stroke='#E5E7EB'
                    strokeWidth={12}
                    fill='none'
                  />
                  <Circle
                    cx={85}
                    cy={85}
                    r={RING_R}
                    stroke={theme.primaryDark}
                    strokeWidth={12}
                    fill='none'
                    strokeDasharray={`${RING_C * pct} ${RING_C}`}
                    strokeLinecap='round'
                  />
                </G>
              </Svg>
              <View style={s.ringCenter}>
                <Text style={[s.ringValue, { color: theme.text }]}>
                  {formatNumber(todayTotal)}
                  <Text style={[s.ringUnit, { color: theme.muted }]}> ml</Text>
                </Text>
                {goal > 0 ? (
                  <Text style={[s.ringPct, { color: theme.primaryDark }]}>
                    {Math.round(pct * 100)}%
                  </Text>
                ) : null}
              </View>
            </View>
            {goal > 0 ? (
              <Text style={[s.goalText, { color: theme.muted }]}>
                {t('waterDetail.goalLabel', { goal: formatNumber(goal) })}
              </Text>
            ) : null}
          </View>

          {/* Lượng có sẵn */}
          <Text style={[s.sectionTitle, { color: theme.text }]}>
            {t('waterDetail.quickAmount')}
          </Text>
          <View style={s.chipRow}>
            {QUICK_AMOUNTS.map((ml) => {
              const active = selected === ml && custom.trim().length === 0;
              return (
                <TouchableOpacity
                  key={ml}
                  style={[
                    s.chip,
                    {
                      backgroundColor: active
                        ? theme.primaryDark
                        : theme.cardAlt,
                    },
                  ]}
                  onPress={() => {
                    setSelected(ml);
                    setCustom('');
                    setError('');
                  }}
                >
                  <Text
                    style={[
                      s.chipText,
                      { color: active ? '#fff' : theme.text },
                    ]}
                  >
                    {ml} ml
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Nhập tay lượng vừa uống */}
          <Text style={[s.sectionTitle, { color: theme.text }]}>
            {t('waterDetail.customAmount')}
          </Text>
          <View
            style={[s.inputRow, { backgroundColor: theme.cardAlt }]}
          >
            <TextInput
              style={[s.input, { color: theme.text }]}
              value={custom}
              onChangeText={(v) => {
                setCustom(v.replace(/[^\d]/g, ''));
                if (v.trim().length > 0) setSelected(null);
                setError('');
              }}
              keyboardType='number-pad'
              placeholder={t('waterDetail.customPlaceholder')}
              placeholderTextColor={theme.muted}
              maxLength={4}
            />
            <Text style={[s.inputUnit, { color: theme.muted }]}>ml</Text>
          </View>
          {error ? (
            <Text style={[s.errorText, { color: theme.danger }]}>{error}</Text>
          ) : (
            <Text style={[s.hint, { color: theme.muted }]}>
              {t('waterDetail.hint')}
            </Text>
          )}

          <TouchableOpacity
            style={[
              s.addBtn,
              { backgroundColor: theme.primaryDark },
              saving && { opacity: 0.6 },
            ]}
            onPress={onAdd}
            disabled={saving}
          >
            <Text style={s.addBtnText}>
              {saving ? t('steps.saving') : t('waterDetail.addButton')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
