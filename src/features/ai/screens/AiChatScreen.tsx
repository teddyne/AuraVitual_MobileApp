// Màn Trò chuyện với trợ lý — mở từ Cài đặt > Trò chuyện.
// Gói Free: 5 tin/ngày, hết thì mời nâng cấp lên Pro. Gói Pro / Family:
// không giới hạn. Trợ lý gọi Gemini qua proxy Edge Function 'ai-chat'
// (key chỉ nằm trong secret của project). Khi proxy chưa sẵn sàng thì
// trợ lý vẫn trả lời bằng luật trên dữ liệu thật (xem aiChatService.ts).
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  type ScrollViewInstance,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthContext';
import { useSettings } from '../../../context/SettingsContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import {
  getProfile,
  getTodayMetric,
  type Profile,
} from '../../../api/auravitalApi';
import {
  FREE_CHAT_DAILY_LIMIT,
  loadChatUsage,
  recordChatUsage,
  sendAiChat,
  type AiChatContext,
  type AiChatMessage,
} from '../aiChatService';
import { ChatBubble } from '../../../components/ai/ChatBubble';
import { aiErrorMessageKey } from '../../../api/aiClient';
import { s } from './AiChatScreen.styles';

export default function AiChatScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, t, locale } = useSettings();
  const { aiUnlimited } = useSubscription();
  const [messages, setMessages] = useState<AiChatMessage[]>([
    { role: 'assistant', text: t('aiChat.hello') },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState(0);
  const [ctx, setCtx] = useState<AiChatContext>({});
  // Mặc định coi như trực tuyến (proxy Edge Function); lần trả lời đầu
  // sẽ sửa lại nếu proxy chưa deploy / chưa đặt secret.
  const [online, setOnline] = useState(true);

const scrollRef = useRef<ScrollViewInstance | null>(null);

  useEffect(() => {
    loadChatUsage().then(setUsage).catch(() => {});
    if (!user?.id) return;
    (async () => {
      try {
        const [profile, metric] = await Promise.all([
          getProfile(user.id),
          getTodayMetric(user.id).catch(() => null),
        ]);
        const p: Profile | null = profile;
        setCtx({
          displayName: p?.display_name,
          calorieGoal: p?.calorie_goal,
          stepGoal: p?.step_goal,
          waterGoalMl: p?.water_goal_ml,
          sleepGoalHours: p?.sleep_goal_hours,
          weightKg: p?.weight_kg,
          stepsToday: metric?.steps,
          sleepToday: metric?.sleep_hours,
          waterToday: metric?.water_ml,
        });
      } catch {
        // Không tải được hồ sơ thì chat offline vẫn trả lời chung được.
      }
    })();
  }, [user?.id]);

  const limitReached = !aiUnlimited && usage >= FREE_CHAT_DAILY_LIMIT;

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sending || limitReached) return;
    const nextHistory: AiChatMessage[] = [
      ...messages,
      { role: 'user', text },
    ];
    setMessages(nextHistory);
    setInput('');
    setSending(true);
    try {
      const res = await sendAiChat(nextHistory, ctx, locale);
      setOnline(res.online);
      setMessages([...nextHistory, { role: 'assistant', text: res.text }]);
      if (!aiUnlimited) setUsage(await recordChatUsage());
    } catch (e: any) {
      const code = typeof e?.message === 'string' ? e.message : 'ai_failed';
      setMessages([
        ...nextHistory,
        { role: 'assistant', text: t(aiErrorMessageKey(code)) },
      ]);
    } finally {
      setSending(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    }
  };

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
                {t('aiChat.title')}
              </Text>
              <Text style={[s.headerSub, { color: theme.muted }]}>
                {online
                  ? t('aiChat.online')
                  : t('aiChat.offline')}
                {!aiUnlimited &&
                  ` · ${t('aiChat.freeLeft', {
                    count: Math.max(0, FREE_CHAT_DAILY_LIMIT - usage),
                  })}`}
              </Text>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={s.list}
            contentContainerStyle={s.listContent}
            onContentSizeChange={() =>
              scrollRef.current?.scrollToEnd({ animated: true })
            }
          >
            {messages.map((m, i) => (
              <ChatBubble key={i} role={m.role} text={m.text} theme={theme} />
            ))}
            {sending && (
              <ActivityIndicator color={theme.primaryDark} />
            )}
          </ScrollView>

          {limitReached && (
            <View
              style={[s.limitCard, { backgroundColor: '#FFF8E1' }]}
            >
              <Text style={[s.limitTitle, { color: theme.text }]}>
                {t('aiChat.limitReached')}
              </Text>
              <Text style={[s.limitBody, { color: theme.muted }]}>
                {t('aiChat.limitBody')}
              </Text>
              <TouchableOpacity
                style={s.upgradeBtn}
                onPress={() => navigation.navigate('Plans')}
              >
                <Text style={s.upgradeBtnText}>{t('aiChat.upgrade')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.inputRow}>
            <TextInput
              style={[s.input, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text }]}
              value={input}
              onChangeText={setInput}
              placeholder={t('aiChat.placeholder')}
              placeholderTextColor={theme.muted}
              multiline
              editable={!sending && !limitReached}
              onSubmitEditing={() => send()}
            />
            <TouchableOpacity
              style={[s.sendBtn, (sending || limitReached) && { opacity: 0.5 }]}
              onPress={() => send()}
              disabled={sending || limitReached || !input.trim()}
            >
              <Text style={s.sendBtnText}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
