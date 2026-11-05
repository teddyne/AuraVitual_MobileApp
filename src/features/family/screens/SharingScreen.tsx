import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useCameraPermissions } from 'expo-camera';
import { useSettings } from '../../../context/SettingsContext';
import { localToday } from '../../../lib/auravitalApi';
import {
  acceptRequest,
  declineRequest,
  dismissRequest,
  getMembers,
  getMyInviteCode,
  getReceivedRequests,
  getSentRequests,
  rotateInviteCode,
  sendInvite,
  setNickname,
  type FamilyMember,
  type FamilyRequest,
} from '../../../lib/familyApi';
import { CODE_RE } from '../utils/sharingFormat';
import { SharingMemberCard } from '../components/SharingMemberCard';
import {
  ReceivedRequestCard,
  SentRequestCard,
} from '../components/SharingRequestCards';
import { SharingNicknameBox } from '../components/SharingNicknameBox';
import { SharingPairCard } from '../components/SharingPairCard';
import { SharingQrScannerModal } from '../components/SharingQrScannerModal';
import { s } from './SharingScreen.styles';

export default function SharingScreen({ navigation }: any) {
  const { theme, t } = useSettings();
  const route = useRoute<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [received, setReceived] = useState<FamilyRequest[]>([]);
  const [sent, setSent] = useState<FamilyRequest[]>([]);
  const [myCode, setMyCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nicknamePrompt, setNicknamePrompt] = useState<{
    ownerId: string;
    name: string;
  } | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [scanning, setScanning] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  // Ref để nút "Bắt đầu chia sẻ" cuộn xuống khu vực chia sẻ.
  // Dùng any cho ref vì kiểu instance của ScrollView trong RN 0.88
  // (ScrollViewInstance) khác kiểu component ScrollView.
  const scrollRef = useRef<any>(null);
  const pairY = useRef(0);

  const loadAll = useCallback(async () => {
    try {
      const [m, r, s, c] = await Promise.all([
        getMembers().catch(() => []),
        getReceivedRequests().catch(() => []),
        getSentRequests().catch(() => []),
        getMyInviteCode().catch(() => null),
      ]);
      setMembers(m);
      setReceived(r);
      setSent(s);
      setMyCode(c);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll]),
  );

  // Khi Đồng ý lời mời từ trang chuông (Notifications), màn này mở lên
  // kèm tham số -> hiện ngay hộp đặt biệt danh cho người vừa kết nối.
  // Xóa tham số sau khi nhận để lần sau mở tab không hiện lại hộp này.
  useFocusEffect(
    useCallback(() => {
      const ownerId = route.params?.justAcceptedOwnerId;
      const name = route.params?.justAcceptedName;
      if (ownerId && name) {
        setNicknamePrompt({ ownerId, name });
        setNicknameDraft('');
        navigation.setParams({
          justAcceptedOwnerId: undefined,
          justAcceptedName: undefined,
        });
      }
    }, [route.params?.justAcceptedOwnerId]),
  );

  // Tạo mã mới thật: hủy mã cũ còn hiệu lực rồi cấp mã mới.
  // (Nút cũ chỉ đọc lại mã cũ nên bấm không đổi mã.)
  const onRotateCode = () => {
    Alert.alert(
      t('family.rotateTitle'),
      t('family.rotateBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('family.rotateAction'),
          onPress: async () => {
            setRotating(true);
            const next = await rotateInviteCode();
            setRotating(false);
            if (!next) {
              Alert.alert(t('family.errorTitle'), t('family.rotateFailed'));
              return;
            }
            setMyCode(next);
          },
        },
      ],
    );
  };

  const syncedToday = members.filter(
    (m) => m.latest?.log_date === localToday(),
  ).length;

  const onSend = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      setSendMsg({
        ok: false,
        text: t('family.codeInvalid'),
      });
      return;
    }
    setSending(true);
    const res = await sendInvite(code);
    setSending(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        self: t('family.inviteError.self'),
        invalid_code: t('family.inviteError.invalidCode'),
        already_linked: t('family.inviteError.alreadyLinked'),
        already_pending: t('family.inviteError.alreadyPending'),
        too_many_attempts: t('family.inviteError.tooManyAttempts'),
        network: t('family.inviteError.network'),
      };
      setSendMsg({ ok: false, text: map[res.error] ?? t('family.inviteError.default') });
      return;
    }
    setSendMsg({
      ok: true,
      text: t('family.inviteSent', { name: res.toName }),
    });
    setCodeInput('');
    const s = await getSentRequests().catch(() => []);
    setSent(s);
  };

  const onAccept = async (r: FamilyRequest) => {
    const ok = await acceptRequest(r.id);
    if (!ok) {
      Alert.alert(t('family.errorTitle'), t('family.acceptFailed'));
      return;
    }
    setNicknamePrompt({ ownerId: r.fromUserId, name: r.fromName });
    setNicknameDraft('');
    void loadAll();
  };

  const onDecline = async (r: FamilyRequest) => {
    if (await declineRequest(r.id)) void loadAll();
  };

  const onDismissSent = async (r: FamilyRequest) => {
    if (await dismissRequest(r.id)) void loadAll();
  };

  const onSaveNickname = async () => {
    if (!nicknamePrompt) return;
    const ok = await setNickname(nicknamePrompt.ownerId, nicknameDraft);
    if (!ok) {
      Alert.alert(t('family.errorTitle'), t('family.nicknameSaveFailed'));
      return;
    }
    setNicknamePrompt(null);
    void loadAll();
  };

  const onScanPress = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(t('family.cameraTitle'), t('family.cameraBody'));
        return;
      }
    }
    setScanning(true);
  };

  const goAccount = () => navigation.navigate('AccountTab');
  const goDetail = (memberId: string) =>
    navigation.navigate('FamilyDetail', { memberId });
  const goSettings = () => navigation.navigate('SharingSettings');

  if (loading) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
          <ActivityIndicator size='large' color={theme.primaryDark} style={{ marginTop: 80 }} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.safe, { backgroundColor: theme.background }]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {/* Header: logo + tiêu đề tab + avatar sang Tài khoản */}
          <View style={s.headerRow}>
            <Text style={[s.logo, { color: theme.primaryDark }]}>🌿 AuraVital</Text>
            <Text style={[s.headerTitle, { color: theme.text }]}>{t('tabs.share')}</Text>
          </View>
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadAll(); }} />
          }
        >

          {/* Banner mạng lưới gia đình */}
          <View style={s.bannerWrap}>
            <Image
              source={{ uri: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1200&q=80' }}
              style={s.bannerImg}
              resizeMode='cover'
            />
            <View style={s.bannerOverlay}>
              <Ionicons name='shield-checkmark' size={20} color='#fff' />
              <Text style={s.bannerText}>{t('family.banner')}</Text>
            </View>
          </View>

          {/* Thành viên kết nối */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>{t('family.membersTitle')}</Text>
            <Text style={[s.sectionRight, { color: theme.primaryDark }]}>
              {members.length === 0
                ? t('family.noMembers')
                : syncedToday > 0
                  ? t('family.syncingCount', { count: syncedToday })
                  : t('family.membersCount', { count: members.length })}
            </Text>
          </View>
          {members.length === 0 ? (
            <Text style={[s.empty, { color: theme.muted }]}>
              {t('family.emptyMembers')}
            </Text>
          ) : (
            members.map((m) => (
              <SharingMemberCard
                key={m.ownerId}
                member={m}
                theme={theme}
                onPress={() => goDetail(m.ownerId)}
              />
            ))
          )}

          {/* Lời mời mình nhận */}
          {received.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>{t('family.receivedTitle')}</Text>
              </View>
              {received.map((r) => (
                <ReceivedRequestCard
                  key={r.id}
                  request={r}
                  theme={theme}
                  onAccept={() => onAccept(r)}
                  onDecline={() => onDecline(r)}
                />
              ))}
            </>
          )}

          {/* Đặt biệt danh ngay sau khi Đồng ý */}
          {nicknamePrompt && (
            <SharingNicknameBox
              name={nicknamePrompt.name}
              value={nicknameDraft}
              theme={theme}
              onChangeText={setNicknameDraft}
              onSave={onSaveNickname}
              onDismiss={() => setNicknamePrompt(null)}
            />
          )}

          {/* Lời mời mình đã gửi */}
          {sent.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>{t('family.sentTitle')}</Text>
              </View>
              {sent.map((r) => (
                <SentRequestCard
                  key={r.id}
                  request={r}
                  theme={theme}
                  onDismiss={() => onDismissSent(r)}
                />
              ))}
            </>
          )}

          {/* Ghép đôi tức thì */}
          <View
            style={s.sectionHeader}
            onLayout={(e) => {
              pairY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[s.sectionTitle, { color: theme.text }]}>{t('family.pairTitle')}</Text>
          </View>

          <SharingPairCard
            myCode={myCode}
            codeInput={codeInput}
            sending={sending}
            sendMsg={sendMsg}
            rotating={rotating}
            theme={theme}
            onCodeInputChange={setCodeInput}
            onRotateCode={onRotateCode}
            onScanPress={onScanPress}
            onSend={onSend}
          />

          {/* Giá trị cốt lõi */}
          <Text style={[s.sectionTitle, { color: theme.text, marginTop: 30 }]}>{t('family.coreValuesTitle')}</Text>
          <View style={[s.valueCard, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 3 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.valueTitle, { color: theme.text }]}>{t('family.valueTrackTitle')}</Text>
              <Text style={[s.valueBody, { color: theme.muted }]}>
                {t('family.valueTrackBody')}
              </Text>
            </View>
          </View>
          <View style={[s.valueCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.valueTitle, { color: theme.text }]}>{t('family.valueNotifyTitle')}</Text>
              <Text style={[s.valueBody, { color: theme.muted }]}>
                {t('family.valueNotifyBody')}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              void loadAll();
              scrollRef.current?.scrollTo({ y: Math.max(pairY.current - 20, 0), animated: true });
            }}
            style={[s.cta, { backgroundColor: theme.primaryDark }]}
          >
            <Text style={s.ctaText}>{t('family.ctaStart')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goSettings}
            style={[s.ctaOutline, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <Text style={[s.ctaOutlineText, { color: theme.text }]}>{t('family.ctaSettings')}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Quét QR: camera toàn màn hình, chỉ nhận mã 8 ký tự hợp lệ */}
        <SharingQrScannerModal
          visible={scanning}
          onClose={() => setScanning(false)}
          onCodeScanned={(code) => {
            setCodeInput(code);
            setScanning(false);
          }}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
