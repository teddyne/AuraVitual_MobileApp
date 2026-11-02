import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSettings } from '../../../context/SettingsContext';
import { healthScore, localToday } from '../../../lib/auravitalApi';
import {
  acceptRequest,
  declineRequest,
  dismissRequest,
  displayNameOf,
  getMembers,
  getMyInviteCode,
  getReceivedRequests,
  getSentRequests,
  healthBadge,
  rotateInviteCode,
  sendInvite,
  setNickname,
  timeAgo,
  type FamilyMember,
  type FamilyRequest,
} from '../../../lib/familyApi';

// =====================================================================
// Tab Chia sẻ (theo Figma "Chia sẻ sức khỏe gia đình"):
// - Thành viên đã kết nối (tên hiển thị = biệt danh nếu đã đặt).
// - Lời mời mình nhận: Đồng ý / Từ chối.
// - Lời mời mình gửi: đang chờ / đã bị từ chối (+ Ẩn).
// - Ghép đôi tức thì: mã mời 8 ký tự + mã QR CỦA MÃ ĐÓ (không phải
//   link web), hiệu lực 24 giờ; bên dưới là ô nhập mã / quét QR của
//   người khác + nút Gửi lời mời.
// - Nút "Bắt đầu chia sẻ với gia đình": đảm bảo đã có mã rồi cuộn
//   xuống khu vực ghép đôi. "Cài đặt & Phân quyền chia sẻ": sang màn
//   cài đặt nội dung chia sẻ + hủy kết nối.
// =====================================================================

const CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;

function fmtExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ngày ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function badgeBg(label: string): string {
  if (label === 'Tốt') return '#E8F5E9';
  if (label === 'Ổn định') return '#FFF8E1';
  if (label === 'Cần chú ý') return '#FFEBEE';
  return '#F1F1F1';
}

export default function SharingScreen({ navigation }: any) {
  const { theme } = useSettings();
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
  // Ref để nút "Bắt đầu chia sẻ" cuộn xuống khu vực ghép đôi.
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
      'Tạo mã mới?',
      'Mã cũ đang hiển thị sẽ hết hiệu lực ngay. Người chưa dùng mã cũ sẽ phải dùng mã mới.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tạo mã mới',
          onPress: async () => {
            setRotating(true);
            const next = await rotateInviteCode();
            setRotating(false);
            if (!next) {
              Alert.alert('Lỗi', 'Không tạo được mã mới, thử lại sau.');
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
        text: 'Mã mời gồm 8 ký tự, không chứa 0, O, 1, I, L.',
      });
      return;
    }
    setSending(true);
    const res = await sendInvite(code);
    setSending(false);
    if (!res.ok) {
      const map: Record<string, string> = {
        self: 'Không thể gửi lời mời cho chính mình.',
        invalid_code: 'Mã không đúng hoặc đã hết hạn (24 giờ).',
        already_linked: 'Hai bạn đã kết nối rồi.',
        already_pending: 'Bạn đã gửi lời mời rồi, đang chờ chấp nhận.',
        too_many_attempts: 'Nhập sai quá nhiều lần, thử lại sau 15 phút.',
        network: 'Lỗi mạng, thử lại sau.',
      };
      setSendMsg({ ok: false, text: map[res.error] ?? 'Không gửi được lời mời.' });
      return;
    }
    setSendMsg({
      ok: true,
      text: `Đã gửi lời mời đến ${res.toName}. Họ sẽ thấy lời mời trong tab Chia sẻ.`,
    });
    setCodeInput('');
    const s = await getSentRequests().catch(() => []);
    setSent(s);
  };

  const onAccept = async (r: FamilyRequest) => {
    const ok = await acceptRequest(r.id);
    if (!ok) {
      Alert.alert('Lỗi', 'Không chấp nhận được, thử lại sau.');
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
      Alert.alert('Lỗi', 'Không lưu được biệt danh.');
      return;
    }
    setNicknamePrompt(null);
    void loadAll();
  };

  const onScanPress = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Cần quyền camera', 'Cho phép dùng camera để quét mã QR.');
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
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadAll(); }} />
          }
        >
          {/* Header: logo + tiêu đề tab + avatar sang Tài khoản */}
          <View style={s.headerRow}>
            <Text style={[s.logo, { color: theme.primaryDark }]}>🫀 AuraVital</Text>
            <Text style={[s.headerTitle, { color: theme.text }]}>Chia sẻ</Text>
            <TouchableOpacity onPress={goAccount} style={[s.avatarBtn, { backgroundColor: theme.cardAlt }]}>
              <Text>👤</Text>
            </TouchableOpacity>
          </View>

          <View style={[s.badge, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[s.badgeText, { color: theme.primaryDark }]}>
              🛡 AURAVITAL GIA ĐÌNH AN TOÀN
            </Text>
          </View>
          <Text style={[s.title, { color: theme.text }]}>Chia sẻ sức khỏe gia đình</Text>
          <Text style={[s.subtitle, { color: theme.muted }]}>
            Gắn kết người thân yêu và theo dõi sức khỏe chủ động với sự an tâm tuyệt đối chuẩn y tế.
          </Text>

          {/* Minh họa mạng lưới gia đình (vẽ bằng View, không cần ảnh) */}
          <View style={[s.hero, { backgroundColor: theme.cardAlt }]}>
            <View style={s.heroCircles}>
              <View style={[s.heroCircle, { backgroundColor: '#C8E6C9' }]}>
                <Text style={s.heroEmoji}>👨</Text>
              </View>
              <View style={[s.heroCenter, { backgroundColor: '#FFFFFF' }]}>
                <Ionicons name='pulse' size={40} color={theme.primaryDark} />
              </View>
              <View style={[s.heroCircle, { backgroundColor: '#FFE0B2' }]}>
                <Text style={s.heroEmoji}>👩</Text>
              </View>
            </View>
            <Text style={[s.heroText, { color: theme.text }]}>
              ● Mạng lưới gia đình được bảo vệ 24/7
            </Text>
          </View>

          {/* Thành viên kết nối */}
          <View style={s.sectionHeader}>
            <Text style={[s.sectionTitle, { color: theme.text }]}>👥 Thành viên kết nối</Text>
            <Text style={[s.sectionRight, { color: theme.primaryDark }]}>
              {members.length === 0
                ? 'Chưa có thành viên'
                : syncedToday > 0
                  ? `${syncedToday} đang đồng bộ`
                  : `${members.length} thành viên`}
            </Text>
          </View>
          {members.length === 0 ? (
            <Text style={[s.empty, { color: theme.muted }]}>
              Chưa có thành viên. Tạo mã mời bên dưới và gửi cho người thân để bắt đầu.
            </Text>
          ) : (
            members.map((m) => {
              const score = healthScore(m.latest, {
                step_goal: m.stepGoal,
                water_goal_ml: m.waterGoalMl,
                sleep_goal_hours: m.sleepGoalHours,
              } as any);
              const badge = healthBadge(score);
              const showHr =
                (m.settings ?? { share_enabled: true, share_heart_rate: true } as any)
                  .share_enabled !== false &&
                (m.settings?.share_heart_rate ?? true) &&
                m.latest?.heart_rate != null;
              return (
                <TouchableOpacity
                  key={m.ownerId}
                  onPress={() => goDetail(m.ownerId)}
                  style={[s.memberCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <View style={[s.initialCircle, { backgroundColor: theme.cardAlt }]}>
                    <Text style={[s.initial, { color: theme.primaryDark }]}>
                      {displayNameOf(m).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.nameRow}>
                      <Text style={[s.memberName, { color: theme.text }]} numberOfLines={1}>
                        {displayNameOf(m)}
                      </Text>
                      <View style={[s.miniBadge, { backgroundColor: badgeBg(badge) }]}>
                        <Text style={[s.miniBadgeText, { color: theme.text }]}>{badge}</Text>
                      </View>
                    </View>
                    <Text style={[s.memberSub, { color: theme.muted }]}>
                      {m.latest ? `Đã đồng bộ ${timeAgo(m.latest.updated_at)}` : 'Chưa có dữ liệu'}
                    </Text>
                  </View>
                  {showHr ? (
                    <Text style={[s.bpm, { color: theme.text }]}>♡ {m.latest!.heart_rate} BPM</Text>
                  ) : null}
                  <Text style={[s.chev, { color: theme.muted }]}>›</Text>
                </TouchableOpacity>
              );
            })
          )}

          {/* Lời mời mình nhận */}
          {received.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>✉️ Lời mời kết nối</Text>
              </View>
              {received.map((r) => (
                <View key={r.id} style={[s.reqCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[s.reqText, { color: theme.text }]}>
                    <Text style={{ fontWeight: '800' }}>{r.fromName}</Text> muốn kết nối gia đình với bạn.
                  </Text>
                  <View style={s.reqBtns}>
                    <TouchableOpacity
                      onPress={() => onAccept(r)}
                      style={[s.acceptBtn, { backgroundColor: theme.primaryDark }]}
                    >
                      <Text style={s.acceptText}>Đồng ý</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDecline(r)}
                      style={[s.declineBtn, { borderColor: theme.border }]}
                    >
                      <Text style={[s.declineText, { color: theme.text }]}>Từ chối</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Đặt biệt danh ngay sau khi Đồng ý */}
          {nicknamePrompt && (
            <View style={[s.nickBox, { backgroundColor: '#E8F5E9', borderColor: theme.primaryDark }]}>
              <Text style={[s.nickTitle, { color: theme.text }]}>
                Đã kết nối với {nicknamePrompt.name}! Đặt biệt danh cho người này:
              </Text>
              <TextInput
                value={nicknameDraft}
                onChangeText={setNicknameDraft}
                placeholder='Ví dụ: Bố, Mẹ...'
                placeholderTextColor={theme.muted}
                maxLength={30}
                style={[s.nickInput, { backgroundColor: '#FFFFFF', color: theme.text }]}
              />
              <View style={s.reqBtns}>
                <TouchableOpacity
                  onPress={onSaveNickname}
                  style={[s.acceptBtn, { backgroundColor: theme.primaryDark }]}
                >
                  <Text style={s.acceptText}>Lưu biệt danh</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNicknamePrompt(null)}>
                  <Text style={[s.declineText, { color: theme.muted }]}>Để sau</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Lời mời mình đã gửi */}
          {sent.length > 0 && (
            <>
              <View style={s.sectionHeader}>
                <Text style={[s.sectionTitle, { color: theme.text }]}>📤 Lời mời đã gửi</Text>
              </View>
              {sent.map((r) => (
                <View key={r.id} style={[s.reqCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[s.reqText, { color: theme.text }]}>
                    {r.status === 'declined' ? (
                      <>
                        <Text style={{ fontWeight: '800' }}>{r.toName ?? 'Người nhận'}</Text> đã từ chối lời mời.
                      </>
                    ) : (
                      <>
                        Đang chờ <Text style={{ fontWeight: '800' }}>{r.toName ?? 'người nhận'}</Text> chấp nhận.
                      </>
                    )}
                  </Text>
                  {r.status === 'declined' && (
                    <TouchableOpacity onPress={() => onDismissSent(r)}>
                      <Text style={[s.dismiss, { color: theme.primaryDark }]}>Ẩn</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
            <Text style={[s.sectionTitle, { color: theme.text }]}>🔗 Ghép đôi tức thì</Text>
          </View>
          <Text style={[s.pairDesc, { color: theme.muted }]}>
            Mã QR và mã mời của bạn (hiệu lực 24 giờ). Người khác quét QR này hoặc nhập mã để gửi lời mời cho bạn.
          </Text>
          <View style={[s.pairCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {myCode ? (
              <>
                <Text style={[s.codeLabel, { color: theme.muted }]}>MÃ MỜI CỦA BẠN</Text>
                <Text style={[s.code, { color: theme.text }]}>{myCode.code}</Text>
                <Text style={[s.codeExp, { color: theme.muted }]}>
                  Hiệu lực đến {fmtExpiry(myCode.expiresAt)}
                </Text>
                <View style={s.qrWrap}>
                  <QRCode value={myCode.code} size={180} color='#1F2937' backgroundColor='#FFFFFF' />
                </View>
                <TouchableOpacity
                  onPress={onRotateCode}
                  disabled={rotating}
                  style={[
                    s.reloadBtn,
                    { borderColor: theme.border, opacity: rotating ? 0.5 : 1 },
                  ]}
                >
                  <Text style={[s.reloadText, { color: theme.primaryDark }]}>
                    {rotating ? 'Đang tạo…' : '↻ Tạo mã mới'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={[s.empty, { color: theme.muted }]}>
                Chưa tạo được mã mời, kéo xuống để thử lại hoặc kiểm tra mạng.
              </Text>
            )}

            <View style={s.divider}>
              <Text style={[s.dividerText, { color: theme.muted }]}>— hoặc nhập mã của người khác —</Text>
            </View>
            <TextInput
              value={codeInput}
              onChangeText={(t) => setCodeInput(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder='Nhập mã 8 ký tự'
              placeholderTextColor={theme.muted}
              autoCapitalize='characters'
              maxLength={8}
              style={[s.codeInput, { backgroundColor: theme.cardAlt, color: theme.text }]}
            />
            <View style={s.reqBtns}>
              <TouchableOpacity
                onPress={onScanPress}
                style={[s.scanBtn, { borderColor: theme.border }]}
              >
                <Text style={[s.scanText, { color: theme.text }]}>📷 Quét QR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onSend}
                disabled={sending}
                style={[s.sendBtn, { backgroundColor: theme.primaryDark, opacity: sending ? 0.6 : 1 }]}
              >
                <Text style={s.sendText}>{sending ? 'Đang gửi...' : 'Gửi lời mời'}</Text>
              </TouchableOpacity>
            </View>
            {sendMsg && (
              <Text style={[s.sendMsg, { color: sendMsg.ok ? theme.primaryDark : '#C62828' }]}>
                {sendMsg.text}
              </Text>
            )}
          </View>

          {/* Giá trị cốt lõi (nội dung tĩnh theo Figma) */}
          <Text style={[s.sectionTitle, { color: theme.text, marginTop: 20 }]}>Giá trị cốt lõi</Text>
          <Text style={[s.pairDesc, { color: theme.muted }]}>
            Thiết kế chuẩn mực y khoa vì tình thân gia đình.
          </Text>
          <View style={[s.valueCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={s.valueIcon}>📈</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.valueTitle, { color: theme.text }]}>Theo dõi sức khỏe chủ động</Text>
              <Text style={[s.valueBody, { color: theme.muted }]}>
                Tự động đồng bộ số bước chân, thời lượng giấc ngủ và cảnh báo nhịp tim bất thường cho người thân theo thời gian thực.
              </Text>
              <View style={s.chipRow}>
                {['Vận động', 'Giấc ngủ', 'Nhịp tim'].map((c) => (
                  <View key={c} style={[s.chip, { backgroundColor: theme.cardAlt }]}>
                    <Text style={[s.chipText, { color: theme.text }]}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View style={[s.valueCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={s.valueIcon}>🔔</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.valueTitle, { color: theme.text }]}>Thông báo thông minh</Text>
              <Text style={[s.valueBody, { color: theme.muted }]}>
                Nhận thông báo cập nhật tức thì khi người thân hoàn thành mục tiêu, đạt thành tích hoặc phát hiện cảnh báo cần hỗ trợ y tế kịp thời.
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
            <Text style={s.ctaText}>👥 Bắt đầu chia sẻ với gia đình</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goSettings}
            style={[s.ctaOutline, { borderColor: theme.border, backgroundColor: theme.card }]}
          >
            <Text style={[s.ctaOutlineText, { color: theme.text }]}>⚙️ Cài đặt & Phân quyền chia sẻ</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Quét QR: camera toàn màn hình, chỉ nhận mã 8 ký tự hợp lệ */}
        <Modal visible={scanning} transparent animationType='slide'>
          <View style={stylesScanner.wrap}>
            <CameraView
              style={stylesScanner.camera}
              facing='back'
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                const code = data.trim().toUpperCase();
                if (CODE_RE.test(code)) {
                  setCodeInput(code);
                  setScanning(false);
                }
              }}
            />
            <TouchableOpacity onPress={() => setScanning(false)} style={stylesScanner.closeBtn}>
              <Text style={stylesScanner.closeText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { fontSize: 17, fontWeight: '800' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  avatarBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10, marginTop: 16 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', marginTop: 10, lineHeight: 32 },
  subtitle: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  hero: { borderRadius: 16, padding: 16, marginTop: 16, alignItems: 'center' },
  heroCircles: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heroCenter: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 28 },
  heroText: { fontSize: 13, fontWeight: '700', marginTop: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionRight: { fontSize: 13, fontWeight: '700' },
  empty: { fontSize: 14, lineHeight: 20 },
  memberCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  initialCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  initial: { fontSize: 20, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  memberName: { fontSize: 15, fontWeight: '800' },
  miniBadge: { borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8 },
  miniBadgeText: { fontSize: 11, fontWeight: '700' },
  memberSub: { fontSize: 13, marginTop: 2 },
  bpm: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  chev: { fontSize: 22, marginLeft: 6 },
  reqCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  reqText: { fontSize: 14, lineHeight: 20 },
  reqBtns: { flexDirection: 'row', gap: 10, marginTop: 10 },
  acceptBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  acceptText: { color: '#FFFFFF', fontWeight: '800' },
  declineBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  declineText: { fontWeight: '700' },
  dismiss: { fontWeight: '700', marginTop: 8 },
  nickBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  nickTitle: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
  nickInput: { borderRadius: 10, padding: 10, marginTop: 10, fontSize: 15 },
  pairDesc: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  pairCard: { borderWidth: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  codeLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  code: { fontSize: 30, fontWeight: '900', letterSpacing: 4, marginTop: 4 },
  codeExp: { fontSize: 13, marginTop: 2 },
  qrWrap: { marginTop: 14, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12 },
  reloadBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, marginTop: 12 },
  reloadText: { fontWeight: '700' },
  divider: { marginVertical: 16 },
  dividerText: { fontSize: 13 },
  codeInput: { width: '100%', borderRadius: 10, padding: 12, fontSize: 16, letterSpacing: 3, textAlign: 'center' },
  scanBtn: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  scanText: { fontWeight: '700' },
  sendBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  sendText: { color: '#FFFFFF', fontWeight: '800' },
  sendMsg: { fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  valueCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10, gap: 10 },
  valueIcon: { fontSize: 26 },
  valueTitle: { fontSize: 15, fontWeight: '800' },
  valueBody: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  chip: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  chipText: { fontSize: 12, fontWeight: '700' },
  cta: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  ctaText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  ctaOutline: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  ctaOutlineText: { fontWeight: '700', fontSize: 15 },
});

const stylesScanner = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' },
  camera: { ...StyleSheet.absoluteFill },
  closeBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    margin: 20,
    alignItems: 'center',
  },
  closeText: { fontWeight: '800', fontSize: 15 },
});
