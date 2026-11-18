import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ACCESS_CHANGED_EVENT, type AccessRole, canViewRole, currentAccessToken, fetchAccessRole, postAccessRequest } from '../lib/access';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  /** 가입 때 적은 소속(팀) */
  team?: string;
}

/** 회원가입 입력값 */
export interface SignUpInput {
  name: string;
  team: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: AuthUser | null;
  /** 저장된 로그인과 열람 권한을 확인하는 중 */
  loading: boolean;
  /** 열람 권한 — 확인 전이거나 확인에 실패하면 null */
  role: AccessRole | null;
  /** 데이터를 볼 수 있는지 (관리자·승인된 계정) */
  canView: boolean;
  loginWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  /** 가입 + 관리자에게 승인 요청 */
  signUp: (input: SignUpInput) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
  /** 로그인한 계정으로 승인을 (다시) 요청한다 — 요청 기록이 없거나 거절·해제된 경우 */
  requestAccess: (name: string, team: string) => Promise<{ error?: string }>;
  /** 열람 권한을 다시 확인한다 (승인됐는지 볼 때) */
  refreshRole: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 아이디만 입력하면 이 도메인을 붙인다 (ad-insight 예전 관리자 계정과 같은 규칙)
const toLoginEmail = (loginId: string) => {
  const id = loginId.trim().toLowerCase();
  return id.includes('@') ? id : `${id}@gmail.com`;
};

const toAuthUser = (u: Session['user']): AuthUser => ({
  id: u.id,
  email: u.email || '',
  name: u.user_metadata?.name || u.email?.split('@')[0],
  team: u.user_metadata?.team,
});

/** Supabase 가입 오류 → 화면 문구 */
const signUpErrorText = (message: string): string => {
  if (/already|registered|exists/i.test(message)) return '이미 가입된 이메일입니다. 로그인해 주세요.';
  if (/password/i.test(message)) return '비밀번호는 6자 이상으로 입력해 주세요.';
  if (/rate|too many|seconds/i.test(message)) return '요청이 많아 잠시 막혔습니다. 몇 분 뒤 다시 시도해 주세요.';
  if (/invalid.*email|email.*invalid/i.test(message)) return '이메일 주소를 확인해 주세요.';
  return '가입하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
};

const requestErrorText = (error: string) =>
  error === 'too_many' ? '요청이 많아 잠시 막혔습니다. 한 시간 뒤 다시 시도해 주세요.' : '승인 요청을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.';

/** 로그인·열람 권한 — ad-insight 의 AuthContext 와 같은 흐름 (계정·승인 명단 공유) */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [role, setRole] = useState<AccessRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleTick, setRoleTick] = useState(0);
  const refreshRole = useCallback(() => setRoleTick((n) => n + 1), []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setUser(session?.user ? toAuthUser(session.user) : null))
      .catch(() => setUser(null))
      .finally(() => setSessionLoading(false));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toAuthUser(session.user) : null);
      setSessionLoading(false);
    });
    window.addEventListener(ACCESS_CHANGED_EVENT, refreshRole);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener(ACCESS_CHANGED_EVENT, refreshRole);
    };
  }, [refreshRole]);

  // 계정이 바뀌거나 다시 확인을 요청하면 열람 권한을 묻는다 (토큰 갱신처럼 계정이 그대로면 묻지 않는다)
  const userId = user?.id || '';
  useEffect(() => {
    if (sessionLoading) return;
    let alive = true;
    if (!userId) {
      setRole('guest');
      setRoleLoading(false);
      return;
    }
    setRoleLoading(true);
    currentAccessToken()
      .then(fetchAccessRole)
      .then((next) => {
        if (!alive) return;
        // 만료된 로그인은 지우고 로그인 화면으로 (인증 콜백 안에서 Supabase 를 다시 부르면 멈출 수 있어 setTimeout)
        if (next === 'invalid') setTimeout(() => supabase.auth.signOut(), 0);
        setRole(next);
      })
      .finally(() => alive && setRoleLoading(false));
    return () => {
      alive = false;
    };
  }, [sessionLoading, userId, roleTick]);

  const loginWithPassword = async (email: string, password: string): Promise<{ error?: string }> => {
    if (!email.trim() || !password) return { error: '이메일과 비밀번호를 입력해 주세요.' };
    const { error } = await supabase.auth.signInWithPassword({ email: toLoginEmail(email), password });
    if (error) {
      if (/confirm/i.test(error.message)) return { error: '가입 메일의 인증 링크를 먼저 눌러 주세요.' };
      return { error: '이메일 또는 비밀번호가 일치하지 않습니다.' };
    }
    return {};
  };

  const signUp = async ({ name, team, email, password }: SignUpInput): Promise<{ error?: string; needsEmailConfirm?: boolean }> => {
    const mail = email.trim().toLowerCase();
    if (!name.trim() || !team.trim() || !mail || !password) return { error: '이름·소속·이메일·비밀번호를 모두 입력해 주세요.' };
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: { data: { name: name.trim(), team: team.trim() }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (error) return { error: signUpErrorText(error.message) };
    const req = await postAccessRequest(mail, name.trim(), team.trim()).catch(() => ({ error: 'network' }));
    if (req.error) return { error: req.error === 'too_many' ? requestErrorText(req.error) : '가입은 됐지만 승인 요청을 보내지 못했습니다. 로그인한 뒤 다시 요청해 주세요.' };
    if (!data.session) return { needsEmailConfirm: true };
    return {};
  };

  const requestAccess = async (name: string, team: string): Promise<{ error?: string }> => {
    if (!user?.email || !name.trim() || !team.trim()) return { error: '이름과 소속을 입력해 주세요.' };
    const req = await postAccessRequest(user.email, name.trim(), team.trim()).catch(() => ({ error: 'network' }));
    if (req.error) return { error: requestErrorText(req.error) };
    refreshRole();
    return {};
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: sessionLoading || roleLoading,
        role,
        canView: canViewRole(role),
        loginWithPassword,
        signUp,
        requestAccess,
        refreshRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
