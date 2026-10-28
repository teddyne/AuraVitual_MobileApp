import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

WebBrowser.maybeCompleteAuthSession();

const BIOMETRIC_KEY = '@auravital:biometric';

export type AppUser = { id: string; name: string; email: string };
type Result = {
  ok: boolean;
  message?: string;
  needsConfirmation?: boolean;
  user?: AppUser;
};

type BiometricAvailability = {
  hardware: boolean;
  enrolled: boolean;
};

type AuthValue = {
  user: AppUser | null;
  loading: boolean;
  register: (name: string, email: string, password: string) => Promise<Result>;
  login: (email: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  signInWithProvider: (provider: 'google' | 'apple') => Promise<Result>;
  biometricAvailable: () => Promise<BiometricAvailability>;
  loginWithBiometrics: () => Promise<Result>;
};

const AuthContext = createContext<AuthValue | null>(null);

function toAppUser(u: SupabaseUser): AppUser {
  const email = u.email ?? '';
  const meta = u.user_metadata ?? {};
  const name = (
    (meta.display_name as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    ''
  ).trim();
  return {
    id: u.id,
    email,
    name,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ? toAppUser(data.session.user) : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? toAppUser(session.user) : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const register: AuthValue['register'] = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) return { ok: false, message: error.message };
    if (!data.session)
      return {
        ok: true,
        needsConfirmation: true,
        message: 'Cần xác nhận email trước khi đăng nhập.',
      };
    const appUser = toAppUser(data.session.user);
    setUser(appUser);
    return { ok: true, user: appUser };
  };

  const login: AuthValue['login'] = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) return { ok: false, message: error.message };
    const appUser = toAppUser(data.user);
    setUser(appUser);
    // Lưu thông tin đăng nhập cho sinh trắc học; lưu lỗi thì bỏ qua,
    // không chặn luồng đăng nhập bằng mật khẩu đã thành công.
    try {
      await SecureStore.setItemAsync(
        BIOMETRIC_KEY,
        JSON.stringify({ email: normalizedEmail, password }),
      );
    } catch {
      // Bỏ qua: thiết bị không hỗ trợ SecureStore hoặc lưu thất bại.
    }
    return { ok: true, user: appUser };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Không xóa SecureStore: Face ID / vân tay vẫn dùng được sau khi đăng xuất.
  };

  const requestPasswordReset: AuthValue['requestPasswordReset'] = async (
    email,
  ) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: Linking.createURL('ResetPassword') },
    );
    if (error) return { ok: false, message: error.message };
    return {
      ok: true,
      message:
        'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi. Hãy kiểm tra hộp thư (bản local: Mailpit) rồi bấm link.',
    };
  };

  const updatePassword: AuthValue['updatePassword'] = async (password) => {
    const { data, error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, message: error.message };
    const appUser = data.user ? toAppUser(data.user) : undefined;
    if (appUser) setUser(appUser);
    return { ok: true, user: appUser };
  };

  const signInWithProvider: AuthValue['signInWithProvider'] = async (
    provider,
  ) => {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { ok: false, message: error.message };
    if (!data.url)
      return { ok: false, message: 'Không lấy được link đăng nhập.' };
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success')
      return { ok: false, message: 'Đã hủy đăng nhập.' };
    const parsed = Linking.parse(result.url);
    const params = parsed.queryParams ?? {};
    if (typeof params.code === 'string' && params.code.length > 0) {
      const { error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(params.code);
      if (exchangeError) return { ok: false, message: exchangeError.message };
    } else if (
      typeof params.access_token === 'string' &&
      typeof params.refresh_token === 'string'
    ) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      if (sessionError) return { ok: false, message: sessionError.message };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData.session?.user;
    if (!sessionUser)
      return {
        ok: false,
        message: 'Không lấy được tài khoản sau khi đăng nhập.',
      };
    const appUser = toAppUser(sessionUser);
    setUser(appUser);
    return { ok: true, user: appUser };
  };

  const biometricAvailable: AuthValue['biometricAvailable'] = async () => {
    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return { hardware, enrolled };
    } catch {
      return { hardware: false, enrolled: false };
    }
  };

  const loginWithBiometrics: AuthValue['loginWithBiometrics'] = async () => {
    try {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      if (!hardware)
        return {
          ok: false,
          message: 'Thiết bị không hỗ trợ sinh trắc học.',
        };
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled)
        return {
          ok: false,
          message: 'Thiết bị chưa đăng ký sinh trắc học.',
        };
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Xác thực để đăng nhập AuraVital',
      });
      if (!auth.success)
        return { ok: false, message: 'Xác thực sinh trắc học thất bại.' };
      const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (!stored)
        return {
          ok: false,
          message:
            'Chưa lưu thông tin đăng nhập sinh trắc học. Hãy đăng nhập bằng email/mật khẩu một lần trước.',
        };
      let saved: { email?: string; password?: string } = {};
      try {
        saved = JSON.parse(stored) as { email?: string; password?: string };
      } catch {
        saved = {};
      }
      if (!saved.email || !saved.password)
        return {
          ok: false,
          message:
            'Chưa lưu thông tin đăng nhập sinh trắc học. Hãy đăng nhập bằng email/mật khẩu một lần trước.',
        };
      const { data, error } = await supabase.auth.signInWithPassword({
        email: saved.email,
        password: saved.password,
      });
      if (error) return { ok: false, message: error.message };
      const appUser = toAppUser(data.user);
      setUser(appUser);
      return { ok: true, user: appUser };
    } catch {
      return { ok: false, message: 'Xác thực sinh trắc học thất bại.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        logout,
        requestPasswordReset,
        updatePassword,
        signInWithProvider,
        biometricAvailable,
        loginWithBiometrics,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
