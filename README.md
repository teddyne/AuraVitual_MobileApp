# AuraVital — Dời kiến trúc + Thanh seek kéo được ở trang video

Bản này dời lại toàn bộ `src/` theo đúng 3 ý bạn nêu, cộng với phần
chính trong bản nhận xét bạn gửi kèm (Phần 1). File AI Camera / AI
Chat / Gold ở lần giao trước (07/11) đã gộp sẵn trong bản này, không
mất gì.

## 1. Cấu trúc mới

```
src/
  api/                  # client + API dữ liệu dùng chung
    supabase.ts         # (từ lib/supabase.ts)
    aiClient.ts         # Gemini, từ lib/aiClient.ts
    auravitalApi.ts, nutritionApi.ts, workoutApi.ts, familyApi.ts
  components/           # DUY NHẤT 1 folder components
    ui/                 # kit dùng chung: AppHeader, AppIcon, Field,
                        # PillButton, CheckBox, StrengthMeter, IconBadge, Ui
    ai/ auth/ cycle/ explore/ family/ health/ home/
    notifications/ nutrition/ profile/ reminders/
    subscription/ workout/
    AlarmWatcher.tsx, FamilyWatcher.tsx, NotificationToast.tsx
  context/              # SettingsContext, SubscriptionContext
  features/             # mỗi phân hệ chỉ còn: screens, api (nếu riêng),
                        # constants, types, service riêng (aiChatService…)
    ai/ auth/ cycle/ explore/ family/ health/ home/
    notifications/ nutrition/ profile/ reminders/
    subscription/ workout/
  i18n/                 # vi / en (không đổi)
  lib/                  # CHỈ CÒN 12 file shim re-export (mục 3)
  navigation/           # RootNavigator, MainTabNavigator,
                        # navigationRef, pendingDeepLink (từ lib/)
  theme/                # colors (không đổi)
  types/
    navigation.ts       # RootStackParamList tách khỏi RootNavigator
  utils/                # DUY NHẤT 1 folder utils
    dates.ts
    auth/ cycle/ family/ health/ home/ notifications/
    nutrition/ profile/ reminders/ workout/
```

Quy tắc đặt chỗ từ nay về sau:

- Component chỉ dùng ở 1 phân hệ → `src/components/<tên phân hệ>/`.
  Component dùng ở ≥2 phân hệ → `src/components/ui/`.
- Hàm thuần túy của 1 phân hệ → `src/utils/<tên phân hệ>/`.
  Hàm dùng chung → `src/utils/dates.ts` hoặc `src/utils/<miền>/`.
- Màn hình và logic riêng của phân hệ ở lại `src/features/<tên>/`.

Lưu ý về tên gọi: AuraVital không có phân hệ “admin” (admin là của
Luminous), nên `components/` có đúng 14 phân hệ hiện có của app, cộng
thêm `ui/`. Đầy đủ 69 file đã dời xem ở `MIGRATION_MAP.md`.

## 2. Vì sao API không chia về từng feature

Bản nhận xét đề xuất `features/<tên>/api/`, nhưng kiểm tra thực tế
thì cả 4 file API đều được dùng chéo nhiều phân hệ nên chia về 1
feature sẽ tạo import vòng:

- `auravitalApi`: 16 chỗ dùng (profile, home, health, family, auth…)
- `workoutApi`: workout + explore + home
- `familyApi`: family + notifications + home
- `nutritionApi`: nutrition + home

Vì vậy cả 4 về `src/api/` cùng với `supabase.ts` và `aiClient.ts`.
Luật: API chỉ 1 feature dùng thì mới đặt trong feature đó.

## 3. Cách chép vào project — đọc kỹ

Zip này chứa **toàn bộ `src/` mới (179 file)**. Không chép đè kiểu
cũ, vì các file ở vị trí cũ sẽ còn sót lại thành code chết:

1. Sao lưu project.
2. **Xóa hẳn thư mục `src/` cũ**, rồi chép thư mục `src/` trong zip
   vào. (Các file ngoài `src/` như `App.tsx`, `assets/`, `supabase/`
   không nằm trong zip nên không bị động tới.)
3. Trong `App.tsx` vẫn bọc `<SubscriptionProvider>` như lần trước
   đã dặn (Settings → Auth → Subscription), và `.env` giữ key
   Gemini như cũ.
4. Chạy `npx tsc --noEmit`, rồi `npx expo start`.

`src/lib/` còn 12 file shim chỉ có 1 dòng `export * from ...`
để code ngoài `src/` (vd `App.tsx`) còn import đường cũ không vỡ.
Khi đã đổi hết import sang đường mới thì xóa cả thư mục `src/lib/`.

## 4. Thanh seek kéo được ở trang video

Trang Trình phát có **2 thanh khác nhau**, nay cả 2 đều kéo được:

**a) Thanh của video — `src/components/workout/VideoPlayer.tsx`
(viết lại).** Trước đây chỉ có `nativeControls` của hệ điều hành.
Nay tắt `nativeControls`, vẽ thanh của app: nút play/pause, thanh
tiến trình có núm tròn, giờ `mm:ss / mm:ss`. Bấm hoặc kéo ngang
trên thanh đều tua được. Cách tua dùng đúng API `expo-video`
(SDK 58, đã đối chiếu docs): gán `player.currentTime = giây`
để seek chính xác; chỉ seek thật khi thả tay để video không giật
khi kéo nhanh; lúc đang kéo hiện giờ xem trước. Vì `expo-video`
không đẩy state về React nên app đọc `currentTime`/`duration`
định kỳ 500ms. Không cần cài thêm thư viện (không dùng slider
ngoài, chỉ dùng `PanResponder` có sẵn của React Native).
Lưu ý: tắt `nativeControls` thì mất nút fullscreen của hệ điều
hành; cần thì mở lại bằng `nativeControls` trong file này.

**b) Thanh tiến trình bước tập — `WorkoutPlayerScreen.tsx`.**
Thanh này trước đây chỉ hiển thị, nay bấm/kéo để nhảy tới mốc
giờ đó. Nó vẫn tôn trọng khóa bước như cũ: kéo tới bước chưa mở
thì báo “Chưa mở” như khi bấm vào bước đó, không nhảy qua.
(Khác với thanh video: thanh này theo `workout_steps` trong DB,
không đồng bộ từng giây với video mẫu — vẫn như trước.)

## 5. Đã kiểm chứng (trên máy này, không chạy được app thật)

- Mọi import trong 179 file đều trỏ đúng file tồn tại: **0 import
  hỏng** (kiểm bằng script quét toàn bộ cây, trừ `assets/` vốn
  nằm ngoài `src/` và các package npm).
- Cú pháp TypeScript transpile đúng: **179/179 file**.
- Mọi hàm/type export của 69 file đã dời đều còn nguyên, không
  mất, không đổi tên.
- Chưa chạy được `npx tsc --noEmit` đầy đủ và chưa chạy thử trên
  máy thật (máy này không có `node_modules` của project) — bạn
  chạy 2 bước ở mục 3 rồi báo mình kết quả.

## 6. Chưa làm trong đợt này (theo bản nhận xét, để đợt sau)

- **React Query:** `package.json` đã có sẵn nhưng code vẫn fetch
  bằng `useEffect` + `useState`. Đổi sang `useQuery`/`useMutation`
  là việc lớn, chạm tới mọi màn hình, không nên gộp chung với
  đợt dời thư mục (khó biết lỗi do dời file hay do đổi fetch).
- **Tách hook khỏi màn hình béo** (`SleepTrackerScreen` ~1.547
  dòng, `ProfileSetupScreen` ~1.160 dòng): nên tách
  `useSleepSession` / `useProfileForm` riêng, cũng để đợt sau
  vì đổi hành vi chạy, cần test trên máy thật.
- **`src/types/database.ts`:** cần gen bằng Supabase CLI từ DB
  thật (`supabase gen types`), không nên viết tay vì dễ lệch
  với schema v5/v6.
- **Test:** chưa có file test nào trong `__tests__/`; nên bổ
  sung unit test cho `healthCalc`, `cycleCalc`, `dates` trước.
