# AuraVital

AuraVital là ứng dụng di động theo dõi sức khỏe và lối sống. Ứng dụng được xây dựng bằng Expo, React Native và TypeScript; dữ liệu tài khoản, sức khỏe, dinh dưỡng, chu kỳ và nội dung được kết nối với Supabase.

> **Tình trạng:** dự án đang trong quá trình phát triển. Một số màn hình và tích hợp yêu cầu cấu hình backend trước khi dùng đầy đủ. Các lỗi kiểm tra đang có được ghi ở mục [Hạn chế và lỗi hiện tại](#hạn-chế-và-lỗi-hiện-tại).

## Mục lục

- [Tính năng](#tính-năng)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Kỹ thuật và cách tổ chức](#kỹ-thuật-và-cách-tổ-chức)
- [Khởi tạo và chạy dự án](#khởi-tạo-và-chạy-dự-án)
- [Cấu hình Supabase](#cấu-hình-supabase)
- [Các lệnh thường dùng](#các-lệnh-thường-dùng)
- [Hạn chế và lỗi hiện tại](#hạn-chế-và-lỗi-hiện-tại)

## Tính năng

- Đăng ký, đăng nhập, đăng xuất, quên/đặt lại mật khẩu và đăng nhập OAuth qua Supabase Auth.
- Thiết lập hồ sơ và xem đề xuất sức khỏe, mục tiêu hoạt động, dinh dưỡng và giấc ngủ.
- Theo dõi bước chân qua cảm biến thiết bị khi được hỗ trợ; có luồng nhập số bước thủ công.
- Ghi nhận giấc ngủ, thiết lập báo thức và nhắc giờ bằng thông báo cục bộ.
- Theo dõi chu kỳ và nhật ký chu kỳ.
- Ghi nhận lượng nước và dinh dưỡng; thêm món thủ công, tra cứu mã vạch qua Open Food Facts và phân tích ảnh món ăn bằng Gemini.
- Khám phá bài viết/bài tập, xem nội dung tập luyện và lưu nhật ký tập.
- Tùy chỉnh giao diện sáng/tối và ngôn ngữ Việt/Anh.

Một số tính năng cần thiết lập Supabase, nhà cung cấp OAuth, quyền thiết bị hoặc khóa dịch vụ bên ngoài mới hoạt động đầy đủ.

## Cấu trúc thư mục

```text
Auravital/
├── App.tsx                         # Khởi tạo provider, deep link và navigation
├── index.ts                        # Điểm vào ứng dụng Expo
├── app.json                        # Cấu hình Expo và plugin native
├── package.json                    # Thư viện và scripts
├── assets/
│   ├── audio/                      # Âm thanh báo thức/tiếng mưa
│   └── images/                     # Logo, ảnh onboarding và ảnh món ăn
├── src/
│   ├── components/
│   │   ├── AlarmWatcher.tsx        # Xử lý tương tác với thông báo báo thức
│   │   ├── home/                   # Các khối giao diện trang chủ
│   │   └── ui/                     # Thành phần giao diện dùng chung
│   ├── context/
│   │   └── SettingsContext.tsx     # Ngôn ngữ, giao diện và cài đặt người dùng
│   ├── features/                   # Mã được nhóm theo chức năng
│   │   ├── auth/
│   │   │   ├── AuthContext.tsx
│   │   │   └── screens/            # Onboarding, Login, SignUp,
│   │   │                            # ForgotPassword, ResetPassword
│   │   ├── cycle/screens/          # CycleTrackingScreen
│   │   ├── explore/screens/        # ExploreScreen
│   │   ├── family/                 # Thư mục hiện chưa có màn hình
│   │   ├── health/screens/         # StepsDetailScreen, SleepTrackerScreen
│   │   ├── home/screens/           # HomeScreen
│   │   ├── notifications/screens/  # NotificationsScreen
│   │   ├── nutrition/screens/      # NutritionTracker, AddMeal, AddFood
│   │   ├── profile/screens/        # ProfileSettings, ProfileSetup,
│   │   │                            # Recommendation
│   │   ├── reminders/screens/      # RemindersScreen
│   │   └── workout/screens/        # WorkoutPlayer, ArticleDetail,
│   │                               # WorkoutLog, AddWorkout
│   ├── i18n/
│   │   └── translations.ts         # Bản dịch tiếng Việt và tiếng Anh
│   ├── lib/
│   │   ├── auravitalApi.ts         # Truy vấn hồ sơ và chỉ số sức khỏe
│   │   ├── healthCalc.ts           # Các phép tính/đề xuất sức khỏe
│   │   ├── navigationRef.ts        # Tham chiếu navigation dùng ngoài màn hình
│   │   ├── nutritionApi.ts         # Truy vấn món ăn, bữa ăn, mã vạch và phân tích ảnh
│   │   ├── pendingDeepLink.ts      # Lưu deep link đang chờ xử lý
│   │   ├── sleepSession.ts         # Lưu phiên ngủ và đồng bộ báo thức
│   │   ├── supabase.ts             # Khởi tạo Supabase client
│   │   └── workoutApi.ts           # Truy vấn bài tập và nhật ký tập
│   ├── navigation/
│   │   ├── MainTabNavigator.tsx    # Thanh tab chính
│   │   └── RootNavigator.tsx       # Stack màn hình cấp ứng dụng
│   └── theme/
│       └── colors.ts               # Màu sắc giao diện
├── supabase/
│   ├── config.toml                 # Cấu hình Supabase Local Development
│   ├── functions/
│   │   └── analyze-meal/           # Edge Function gọi Gemini phân tích ảnh
│   └── migrations/                 # Schema, hàm và chính sách cơ sở dữ liệu
└── __tests__/                      # Hiện chưa có bộ kiểm thử
```

Mỗi thư mục trong `src/features/` chứa các màn hình của một phân hệ. Mã dùng chung như truy cập API, tính toán, điều hướng và giao diện được đặt ngoài `features/` để các màn hình có thể tái sử dụng.

## Công nghệ sử dụng

| Nhóm             | Công nghệ                                                                                    | Vai trò                                                           |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Ứng dụng di động | Expo SDK 58, React Native 0.88, React 19, TypeScript 6                                       | Phát triển ứng dụng iOS/Android; cấu hình web cũng có trong dự án |
| Điều hướng       | React Navigation 7 (Native Stack, Bottom Tabs)                                               | Luồng màn hình và thanh tab                                       |
| Backend          | Supabase Auth, PostgreSQL, Row Level Security, Storage, Edge Functions                       | Tài khoản, dữ liệu ứng dụng, ảnh và xử lý phía server             |
| Thiết bị         | Expo Sensors, Notifications, Audio, Camera, Image Picker, Secure Store, Local Authentication | Bước chân, báo thức, âm thanh, ảnh và sinh trắc học               |
| Giao diện        | React Native SVG, Gifted Charts, Expo Image, Expo Linear Gradient, Expo Vector Icons         | Biểu đồ, hình ảnh, hiệu ứng và biểu tượng                         |
| Lưu trữ cục bộ   | AsyncStorage                                                                                 | Phiên Supabase, ngôn ngữ, giao diện và một số trạng thái cục bộ   |
| Dịch vụ ngoài    | Gemini API, Open Food Facts                                                                  | Phân tích ảnh món ăn và tra cứu thông tin sản phẩm theo mã vạch   |
| Chất lượng mã    | ESLint, Jest, jest-expo, React Native Testing Library                                        | Kiểm tra mã và kiểm thử (bộ test hiện chưa được viết)             |

`@tanstack/react-query`, `react-hook-form`, `zod` và `date-fns` cũng có trong `package.json`; hiện chưa thấy các thư viện này được sử dụng trong mã nguồn `src/`.

## Kỹ thuật và cách tổ chức

- **Tổ chức theo tính năng:** màn hình và logic được phân nhóm theo nghiệp vụ như `auth`, `health`, `nutrition` và `workout`.
- **Điều hướng dạng stack kết hợp bottom tab:** màn hình khởi tạo được khai báo tại `src/navigation/RootNavigator.tsx`; các tab chính ở `src/navigation/MainTabNavigator.tsx`.
- **React Context:** `AuthProvider` chia sẻ phiên đăng nhập; `SettingsProvider` cung cấp ngôn ngữ và chủ đề giao diện.
- **Tách lớp truy cập dữ liệu:** các hàm truy vấn Supabase và xử lý dữ liệu nằm trong `src/lib/`, thay vì lặp lại truy vấn ở mọi màn hình.
- **Bảo vệ dữ liệu phía cơ sở dữ liệu:** migration thiết lập các bảng, hàm PostgreSQL và chính sách Row Level Security (RLS). Vẫn cần triển khai migration lên đúng dự án Supabase để các truy vấn chạy được.
- **Tích hợp thiết bị có phương án dự phòng:** theo dõi bước chân có thể dùng cảm biến hoặc nhập thủ công; báo thức dùng thông báo và âm thanh cục bộ.
- **Hỗ trợ đa ngôn ngữ/giao diện:** bản dịch Việt/Anh và chế độ sáng/tối được lưu trong AsyncStorage.
- **Expo Continuous Native Generation:** cấu hình native nằm trong `app.json` và các plugin Expo; thư mục `ios/` và `android/` được Git bỏ qua, không chỉnh sửa thủ công.

## Khởi tạo và chạy dự án

### Yêu cầu

- Node.js phiên bản LTS và npm.
- Tài khoản/dự án Supabase nếu cần đăng nhập hoặc dùng dữ liệu backend.
- Expo Go hoặc simulator/emulator cho nền tảng cần chạy. Một số module native có thể cần development build tùy thiết bị và tính năng.
- Supabase CLI nếu cần chạy backend local, migration hoặc Edge Function.

### Cài đặt ứng dụng

```bash
git clone <repository-url>
cd Auravital
npm ci
```

Tạo file `.env` ở thư mục gốc và khai báo cấu hình Supabase:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
```

Thay các giá trị mẫu bằng URL và anon/publishable key của dự án Supabase. Ứng dụng sẽ báo lỗi khi thiếu hai biến này. `.env` là cấu hình riêng của máy phát triển; không commit file này, không ghi khóa bí mật hoặc `service_role` key vào ứng dụng.

Khởi động Expo:

```bash
npm run start
```

Quét QR bằng Expo Go hoặc chọn lệnh theo nền tảng:

```bash
npm run android
npm run ios
npm run web
```

## Cấu hình Supabase

### Chạy Supabase local (tùy chọn)

Sau khi cài Supabase CLI và Docker, chạy từ thư mục gốc:

```bash
supabase start
supabase db reset
```

`supabase db reset` tạo lại database local và chạy các migration trong `supabase/migrations/`. Lấy URL và anon key của local Supabase từ kết quả `supabase status`, sau đó cập nhật `.env`. Cấu hình hiện tại tắt seed data; database local không tự có món ăn, bài viết hoặc bài tập mẫu.

Để chạy Edge Function phân tích ảnh local, tạo `supabase/functions/.env` chứa `GEMINI_API_KEY` (không commit file này), rồi chạy:

```bash
supabase functions serve analyze-meal --env-file supabase/functions/.env
```

Với Supabase cloud, cần liên kết project, đẩy migration và triển khai function bằng Supabase CLI. Cấu hình `GEMINI_API_KEY` ở Supabase Edge Function Secrets; không đưa khóa này vào client mobile. Mã ứng dụng có nhánh gọi Gemini trực tiếp khi khai báo `EXPO_PUBLIC_GEMINI_API_KEY`, nhưng biến `EXPO_PUBLIC_*` được nhúng vào client — không dùng cách đó với khóa bí mật trong bản phát hành.

## Các lệnh thường dùng

| Lệnh                      | Mô tả                                      |
| ------------------------- | ------------------------------------------ |
| `npm run start`           | Chạy Expo development server               |
| `npm run android`         | Mở ứng dụng trên Android                   |
| `npm run ios`             | Mở ứng dụng trên iOS                       |
| `npm run web`             | Chạy bản web                               |
| `npm run lint`            | Chạy ESLint qua Expo                       |
| `npm run typecheck`       | Kiểm tra TypeScript, không tạo file đầu ra |
| `npm test -- --runInBand` | Chạy Jest tuần tự                          |

Tham khảo tài liệu Expo đúng phiên bản SDK của dự án: [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/).

## Hạn chế và lỗi hiện tại

Các kết quả dưới đây được ghi nhận khi chạy lệnh trong repository vào ngày **29/10/2026**; chúng phản ánh trạng thái mã tại thời điểm kiểm tra, không phải cam kết rằng các lỗi này là toàn bộ vấn đề của ứng dụng.

### Kết quả kiểm tra

- **Lint chưa đạt:** `npm run lint` kết thúc với lỗi, ghi nhận **34 lỗi và 19 cảnh báo**. Các lỗi bao gồm quy tắc React Hooks (ví dụ cập nhật state đồng bộ trong effect/truy cập ref trong lúc render) và một đường dẫn import không resolve được.
- **Typecheck chưa đạt:** `npm run typecheck` báo lỗi kiểu ref của `TextInput`/phương thức `focus()` trong `LoginScreen.tsx` và `SignUpScreen.tsx`; `src/navigation/AuthContext.tsx` import sai vị trí `supabase` và phát sinh lỗi kiểu implicit `any`.
- **Chưa có test:** `npm test -- --runInBand` trả về “No tests found”. Jest đã được cấu hình nhưng chưa có test case để bảo vệ các luồng ứng dụng.

### Phần chưa hoàn thiện hoặc phụ thuộc cấu hình

- Tab **Chia sẻ** đang hiển thị màn hình giữ chỗ; thư mục `src/features/family/` chưa có giao diện, dù migration có một số bảng liên quan đến liên kết gia đình.
- Supabase local đang tắt seed và chưa có file seed. Nếu chưa thêm dữ liệu mẫu, các danh sách món ăn, bài viết hoặc bài tập có thể trống.
- Đăng nhập Google/Apple, gửi email đặt lại mật khẩu, phân tích ảnh Gemini và các thao tác lưu dữ liệu cần cấu hình project, provider, Edge Function secrets và redirect URL tương ứng.
- Chức năng sensor, camera, thông báo, sinh trắc học và âm thanh phụ thuộc quyền hệ điều hành, phần cứng và nền tảng. Chưa có bộ kiểm thử xác nhận tương thích đầy đủ iOS/Android/Web.
- Các phép tính/đề xuất về BMI, calo, chu kỳ và dinh dưỡng mang tính tham khảo, không thay thế tư vấn y tế; kết quả nhận diện món ăn bằng AI cũng là ước tính.

## Tài liệu tham khảo

- [Tài liệu Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/)
- [Tài liệu Supabase](https://supabase.com/docs)
- [Open Food Facts API](https://world.openfoodfacts.org/data)
