import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../api/supabase';
import { formatVnd, getPlanById, type PlanId } from './plans';

export type PaymentMethod = 'bank' | 'momo';

export type SubscriptionState = {
  planId: PlanId;
  activatedAt: string | null;
  expiresAt: string | null;
  orderId: string | null;
};

export type DemoOrder = {
  id: string;
  planId: PlanId;
  planName: string;
  name: string;
  phone: string;
  paymentMethod: PaymentMethod;
  total: number;
  /** Đơn nháp mới tạo là 'pending_demo'; chỉ thành 'paid_demo' khi
   *  người dùng bấm "Tôi đã thanh toán" (markOrderPaid), 'cancelled'
   *  khi hủy gói (chỉ lưu local — xem cancelPlan). */
  status: 'pending_demo' | 'paid_demo' | 'cancelled';
  createdAt: string;
  expiresAt: string | null;
};

const SUB_KEY = 'auravital:subscription';
const ORDERS_KEY = 'auravital:subscriptionOrders';

export const DEMO_BANK = {
  bank: 'Agribank',
  account: '6902205441281',
  holder: 'BUI NGOC HIEN',
};

export const FREE_STATE: SubscriptionState = {
  planId: 'free',
  activatedAt: null,
  expiresAt: null,
  orderId: null,
};

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function makeOrderId(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AV-${y}${m}${d}-${rand}`;
}

export async function loadSubscription(): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(SUB_KEY);
    if (!raw) return FREE_STATE;
    const parsed = JSON.parse(raw) as SubscriptionState;
    // Hết hạn thì tự về Free, không giữ gói trả phí quá hạn.
    if (
      parsed.expiresAt &&
      new Date(parsed.expiresAt).getTime() < Date.now() &&
      parsed.planId !== 'free'
    ) {
      return FREE_STATE;
    }
    return { ...FREE_STATE, ...parsed };
  } catch {
    return FREE_STATE;
  }
}

export async function saveSubscription(
  state: SubscriptionState,
): Promise<void> {
  await AsyncStorage.setItem(SUB_KEY, JSON.stringify(state));
}

export async function activatePlan(
  planId: PlanId,
  orderId: string | null = null,
): Promise<SubscriptionState> {
  const now = new Date().toISOString();
  const state: SubscriptionState =
    planId === 'free'
      ? { planId, activatedAt: now, expiresAt: null, orderId: null }
      : {
          planId,
          activatedAt: now,
          expiresAt: addDays(now, 30),
          orderId,
        };
  await saveSubscription(state);
  // Best-effort: đánh dấu đơn đã thanh toán trên DB thật khi kích hoạt
  // gói theo đơn (không có orderId — vd chuyển về Free — thì bỏ qua).
  // Lỗi DB không chặn kích hoạt gói local.
  if (orderId) {
    try {
      const { error } = await supabase
        .from('subscription_orders')
        .update({
          status: 'paid_demo',
          activated_at: state.activatedAt,
          expires_at: state.expiresAt,
        })
        .eq('order_code', orderId);
      if (error)
        console.warn('subscription_orders update failed', error.message);
    } catch {
      // Bỏ qua: DB chưa có bảng hoặc chưa đăng nhập.
    }
  }
  return state;
}

/** Tạo đơn nháp (CHƯA kích hoạt gói — gói chỉ kích hoạt khi người dùng
 *  bấm "Tôi đã thanh toán" ở màn QR, qua setActivePlan + markOrderPaid).
 *  Đơn nháp có sẵn mã đơn + số tiền để màn checkout hiện QR ngay khi
 *  form tên + SĐT hợp lệ. Lỗi ở bước nào thì ném ra để màn hình giữ
 *  form. Đơn cũng được ghi lên DB thật (bảng subscription_orders,
 *  trạng thái 'pending_demo') theo kiểu best-effort: chưa chạy migration
 *  hoặc chưa đăng nhập thì chỉ warn, không chặn. */
export async function createDraftOrder(input: {
  planId: PlanId;
  name: string;
  phone: string;
  paymentMethod: PaymentMethod;
}): Promise<DemoOrder> {
  const plan = getPlanById(input.planId);
  const now = new Date();
  const order: DemoOrder = {
    id: makeOrderId(now),
    planId: input.planId,
    planName: plan.name,
    name: input.name.trim(),
    phone: input.phone.trim(),
    paymentMethod: input.paymentMethod,
    total: plan.priceVnd,
    status: 'pending_demo',
    createdAt: now.toISOString(),
    expiresAt: addDays(now.toISOString(), 30),
  };
  const raw = await AsyncStorage.getItem(ORDERS_KEY);
  const orders: DemoOrder[] = raw ? JSON.parse(raw) : [];
  orders.unshift(order);
  await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  // Ghi đơn lên DB thật (trạng thái pending_demo — chỉ chuyển thành
  // paid_demo khi người dùng bấm "Tôi đã thanh toán"). Best-effort:
  // chưa chạy migration hoặc chưa đăng nhập thì chỉ warn.
  try {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { error } = await supabase.from('subscription_orders').insert({
        user_id: data.user.id,
        plan_id: input.planId,
        order_code: order.id,
        customer_name: order.name,
        phone: order.phone,
        payment_method: input.paymentMethod,
        total_vnd: order.total,
        status: 'pending_demo',
        created_at: order.createdAt,
        expires_at: order.expiresAt,
      });
      if (error)
        console.warn('subscription_orders insert failed', error.message);
    }
  } catch {
    // Bỏ qua: DB chưa có bảng hoặc chưa đăng nhập.
  }
  return order;
}

/** Giữ nguyên signature v1: tạo đơn demo. Từ v2, đơn tạo ra là đơn
 *  nháp (status 'pending_demo', chưa kích hoạt gói) — gọi thẳng
 *  createDraftOrder để một luồng tạo đơn duy nhất. */
export async function createDemoOrder(input: {
  planId: PlanId;
  name: string;
  phone: string;
  paymentMethod: PaymentMethod;
}): Promise<DemoOrder> {
  return createDraftOrder(input);
}

/** Đổi trạng thái đơn đã lưu trong AsyncStorage (best-effort, không
 *  ném lỗi ra ngoài để không chặn luồng chính). */
async function updateStoredOrderStatus(
  orderId: string,
  status: DemoOrder['status'],
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(ORDERS_KEY);
    if (!raw) return;
    const orders: DemoOrder[] = JSON.parse(raw);
    const found = orders.find((o) => o.id === orderId);
    if (!found) return;
    found.status = status;
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // Bỏ qua: lỗi đọc/ghi local không chặn kích hoạt hay hủy gói.
  }
}

/** Đánh dấu đơn đã thanh toán (gọi sau setActivePlan/activatePlan khi
 *  người dùng bấm "Tôi đã thanh toán"): đơn local thành 'paid_demo'
 *  và cập nhật DB thật (best-effort, lỗi DB không chặn). */
export async function markOrderPaid(orderId: string): Promise<void> {
  await updateStoredOrderStatus(orderId, 'paid_demo');
  try {
    const { error } = await supabase
      .from('subscription_orders')
      .update({ status: 'paid_demo' })
      .eq('order_code', orderId);
    if (error)
      console.warn('subscription_orders mark paid failed', error.message);
  } catch {
    // Bỏ qua: DB chưa có bảng hoặc chưa đăng nhập.
  }
}

/** Hủy gói đang dùng: về gói Free (qua activatePlan('free')) rồi đánh
 *  dấu đơn đang dùng là 'cancelled'. Đơn local đổi trạng thái được;
 *  DB chỉ nhận 'pending_demo'/'paid_demo' theo CHECK ở migration
 *  20261107213000 nên lần cập nhật DB này sẽ lỗi và chỉ warn — cần
 *  thêm 'cancelled' vào CHECK của migration mới ghi nhận hủy trên DB.
 *  Lỗi DB không chặn việc hủy gói local. */
export async function cancelPlan(): Promise<SubscriptionState> {
  const current = await loadSubscription();
  if (current.planId === 'free') return current;
  const orderId = current.orderId;
  const state = await activatePlan('free');
  if (orderId) {
    await updateStoredOrderStatus(orderId, 'cancelled');
    try {
      const { error } = await supabase
        .from('subscription_orders')
        .update({ status: 'cancelled' })
        .eq('order_code', orderId);
      if (error)
        console.warn(
          'subscription_orders mark cancelled failed',
          error.message,
        );
    } catch {
      // Bỏ qua: DB chưa có bảng, chưa đăng nhập, hoặc CHECK chưa cho
      // trạng thái 'cancelled'.
    }
  }
  return state;
}

// --- Validate form kiểu Buổi 9: lỗi tính từ state, không state riêng ---
export function validateCheckoutName(name: string): string | null {
  return name.trim() ? null : 'checkout.nameRequired';
}

export function validateCheckoutPhone(phone: string): string | null {
  if (!phone.trim()) return 'checkout.phoneRequired';
  return /^(0|\+84)\d{9}$/.test(phone.replace(/\s/g, ''))
    ? null
    : 'checkout.phoneInvalid';
}

export function formatOrderSummary(order: DemoOrder): string {
  return `${order.planName} · ${formatVnd(order.total)} · ${order.id}`;
}
