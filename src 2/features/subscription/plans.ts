export type PlanId = 'free' | 'pro' | 'family';

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  priceVnd: number;
  period: string;
  features: string[];
  highlighted?: boolean;
};

export function formatVnd(n: number): string {
  return `${n.toLocaleString('vi-VN')}đ`;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'AuraVital Free',
    tagline: 'Gói miễn phí',
    priceVnd: 0,
    period: '/tháng',
    features: [
      'Theo dõi bước chân, giấc ngủ, nước uống',
      'Nhập món ăn thủ công và quét mã vạch',
      'Chỉ xem bài viết, video bài tập khóa',
      'AI Camera 3 ảnh/ngày, AI Chat 5 tin/ngày',
      'Chia sẻ gia đình: khóa',
    ],
  },
  {
    id: 'pro',
    name: 'AuraVital Pro',
    tagline: 'Gói Pro / Premium',
    priceVnd: 59000,
    period: '/tháng',
    highlighted: true,
    features: [
      'Mọi quyền của gói Free',
      'Mở toàn bộ bài tập và video',
      'AI Camera và AI Chat không giới hạn',
      'Báo cáo sức khỏe theo tuần, gợi ý cá nhân',
      'Chia sẻ gia đình: chưa mở (cần gói Family)',
    ],
  },
  {
    id: 'family',
    name: 'AuraVital Family',
    tagline: 'Chia sẻ cho cả gia đình',
    priceVnd: 99000,
    period: '/tháng',
    features: [
      'Mọi quyền của gói Pro',
      'Chia sẻ gia đình đầy đủ, không giới hạn người thân',
      'Kết nối và theo dõi sức khỏe người thân',
      'Ghi nhận buổi tập và theo dõi tiến độ',
    ],
  },
];

export function getPlanById(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
