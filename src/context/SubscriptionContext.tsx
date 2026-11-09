// Gói đang dùng của người dùng. Đặt cạnh SettingsContext để App.tsx
// bọc cả hai provider theo cùng một kiểu.
//
// Cách nối (App.tsx, file này không có trong src.zip nên không sửa sẵn):
//   <SettingsProvider>
//     <AuthProvider>
//       <SubscriptionProvider>
//         ... navigator ...
//       </SubscriptionProvider>
//     </AuthProvider>
//   </SettingsProvider>

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  activatePlan,
  cancelPlan as cancelPlanService,
  loadSubscription,
  type SubscriptionState,
} from '../features/subscription/subscriptionService';
import {
  getPlanById,
  type Plan,
  type PlanId,
} from '../features/subscription/plans';
import { useAuth } from '../features/auth/AuthContext';

type SubscriptionValue = {
  planId: PlanId;
  plan: Plan;
  /** Pro và Family đều mở AI không giới hạn. */
  aiUnlimited: boolean;
  /** Mở bài tập/video đầy đủ: Pro và Family. */
  canWorkout: boolean;
  /** Chỉ Family mới dùng được tính năng chia sẻ. */
  canShare: boolean;
  isPro: boolean;
  isFamily: boolean;
  /** Alias tương thích: trỏ sang canWorkout (Pro/Family đều mở bài tập). */
  isWorkout: boolean;
  expiresAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setActivePlan: (planId: PlanId, orderId?: string | null) => Promise<void>;
  /** Hủy gói đang dùng: về Free + đánh dấu đơn đang dùng là cancelled
   *  (best-effort, xem subscriptionService.cancelPlan). */
  cancelPlan: () => Promise<void>;
};

const Ctx = createContext<SubscriptionValue | null>(null);
export const useSubscription = () => {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      'useSubscription phải nằm trong <SubscriptionProvider> — kiểm tra App.tsx đã bọc SubscriptionProvider chưa',
    );
  return ctx;
};

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  // Nằm trong <AuthProvider> (App.tsx) nên đọc được tài khoản hiện
  // tại. Nạp lại gói mỗi khi đổi tài khoản, nếu không bộ nhớ sẽ giữ
  // gói của tài khoản trước dù AsyncStorage đã tách theo tài khoản.
  const { user } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    planId: 'free',
    activatedAt: null,
    expiresAt: null,
    orderId: null,
  });
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const s = await loadSubscription();
    setState(s);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, [user?.id]);

  const setActivePlan = async (planId: PlanId, orderId: string | null = null) => {
    const s = await activatePlan(planId, orderId);
    setState(s);
  };

  const cancelPlan = async () => {
    const s = await cancelPlanService();
    setState(s);
  };

  const value = useMemo<SubscriptionValue>(
    () => ({
      planId: state.planId,
      plan: getPlanById(state.planId),
      aiUnlimited: state.planId === 'pro' || state.planId === 'family',
      canWorkout: state.planId === 'pro' || state.planId === 'family',
      canShare: state.planId === 'family',
      isPro: state.planId === 'pro',
      isFamily: state.planId === 'family',
      // Alias tương thích: isWorkout cũ (= gói 'workout') nay trỏ sang
      // canWorkout, vì quyền bài tập đã chuyển sang Pro/Family.
      isWorkout: state.planId === 'pro' || state.planId === 'family',
      expiresAt: state.expiresAt,
      loading,
      refresh,
      setActivePlan,
      cancelPlan,
    }),
    [state, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
