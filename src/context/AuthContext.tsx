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

/** 회원가입 및 열람 요청 때 함께 적는 값 */
export interface SignUpInfo {
  name: string;
  team: string;
}

interface AuthContextType {
  user: AuthUser | null;
  /** 저장된 로그인과 열람 권한을 확인하는 중 */
  loading: boolean;
  /** 열람 권한 — 확인 전이거나 확인에 실패하면 null */
  role: AccessRole | null;
  /** 데이터를 볼 수 있는지 (관리자·승인된 계정) */
  canView: boolean;
  /** 이메일로 6자리 인증번호를 보낸다 — signup 을 주면 처음 쓰는 이메일도 계정을 만든다(회원가입), 없으면 가입된 이메일만 */
  sendEmailCode: (email: string, signup?: SignUpInfo) => Promise<{ error?: string }>;
  /** 인증번호로 로그인한다 — signup 이면 로그인 직후 관리자에게 열람 승인을 요청한다 */
  verifyEmailCode: (email: string, code: string, signup?: SignUpInfo) => Promise<{ error?: string }>;
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

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

/** 인증번호 보내기·확인 오류 → 화면 문구 (ad-insight 와 같은 문구) */
const codeErrorText = (message: string): string => {
  if (/signups not allowed|user not found/i.test(message)) return '가입된 이메일이 아닙니다. 아래 "회원가입 및 열람 요청"을 먼저 해 주세요.';
  if (/expired|invalid/i.test(message)) return '인증번호가 맞지 않거나 시간이 지났습니다. 다시 받아 주세요.';
  if (/rate|too many|seconds/i.test(message)) return '요청이 많아 잠시 막혔습니다. 1분 뒤 다시 시도해 주세요.';
  return '처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
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

  const sendEmailCode = async (email: string, signup?: SignUpInfo): Promise<{ error?: string }> => {
    const mail = toLoginEmail(email);
    if (!isEmail(mail)) return { error: '이메일 주소를 확인해 주세요.' };
    if (signup && (!signup.name.trim() || !signup.team.trim())) return { error: '이름과 소속을 입력해 주세요.' };
    const { error } = await supabase.auth.signInWithOtp({
      email: mail,
      options: {
        shouldCreateUser: !!signup,
        data: signup ? { name: signup.name.trim(), team: signup.team.trim() } : undefined,
        emailRedirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    });
    return error ? { error: codeErrorText(error.message) } : {};
  };

  const verifyEmailCode = async (email: string, code: string, signup?: SignUpInfo): Promise<{ error?: string }> => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return { error: '메일로 받은 6자리 인증번호를 입력해 주세요.' };
    const { data, error } = await supabase.auth.verifyOtp({ email: toLoginEmail(email), token, type: 'email' });
    if (error || !data.session) return { error: codeErrorText(error?.message || 'invalid') };
    if (!signup) return {};
    const req = await postAccessRequest(signup.name.trim(), signup.team.trim(), data.session.access_token).catch(() => ({ error: 'network' }));
    if (req.error) return { error: req.error === 'too_many' ? requestErrorText(req.error) : '로그인은 됐지만 열람 요청을 보내지 못했습니다. 잠시 뒤 다시 요청해 주세요.' };
    refreshRole();
    return {};
  };

  const requestAccess = async (name: string, team: string): Promise<{ error?: string }> => {
    if (!user?.email || !name.trim() || !team.trim()) return { error: '이름과 소속을 입력해 주세요.' };
    const req = await postAccessRequest(name.trim(), team.trim()).catch(() => ({ error: 'network' }));
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
        sendEmailCode,
        verifyEmailCode,
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
