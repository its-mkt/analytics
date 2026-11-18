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

/** 회원가입 2단계(정보 입력)에서 받는 값 — 이메일 인증을 마친 뒤 계정에 정한다 */
export interface SignUpInfo {
  name: string;
  team: string;
  /** 로그인에 쓸 비밀번호 */
  password: string;
}

/** 회원가입 2단계 진행 중 표시 (sessionStorage, ad-insight 와 같은 키) */
const SIGNUP_STEP_KEY = 'adi_signup_step';

interface AuthContextType {
  user: AuthUser | null;
  /** 저장된 로그인과 열람 권한을 확인하는 중 */
  loading: boolean;
  /** 열람 권한 — 확인 전이거나 확인에 실패하면 null */
  role: AccessRole | null;
  /** 데이터를 볼 수 있는지 (관리자·승인된 계정) */
  canView: boolean;
  /** 이메일로 6자리 인증번호를 보낸다 — signup 이면 처음 쓰는 이메일도 계정을 만든다(회원가입 1단계), 아니면 가입된 이메일만(비밀번호 찾기) */
  sendEmailCode: (email: string, signup?: boolean) => Promise<{ error?: string }>;
  /** 회원가입 1단계 — 인증번호를 확인한다. 확인되면 로그인된 채로 2단계(정보 입력)로 넘어간다 (signupInProgress) */
  verifyEmailCode: (email: string, code: string) => Promise<{ error?: string }>;
  /** 회원가입 2단계 — 이름·소속·비밀번호를 정하고 관리자에게 열람 승인을 요청한다 */
  completeSignup: (info: SignUpInfo) => Promise<{ error?: string }>;
  /** 회원가입 도중(인증은 됐고 정보 입력 전) — 접속 화면이 승인 요청 화면으로 넘어가지 않고 가입 폼을 유지한다 */
  signupInProgress: boolean;
  /** 회원가입을 그만둔다 (인증으로 로그인된 상태도 정리) */
  cancelSignup: () => Promise<void>;
  /** 비밀번호 찾기 — 메일 인증번호를 확인한 뒤 새 비밀번호로 바꾸고 로그인한다 */
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<{ error?: string }>;
  /** 이메일(gmail 은 아이디만)·비밀번호로 로그인한다 */
  loginWithPassword: (loginId: string, password: string) => Promise<{ error?: string }>;
  /** 로그인한 계정으로 승인을 (다시) 요청한다 — 요청 기록이 없거나 거절·해제된 경우 */
  requestAccess: (name: string, team: string) => Promise<{ error?: string }>;
  /** 열람 권한을 다시 확인한다 (승인됐는지 볼 때) */
  refreshRole: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * 계정별 마지막 열람 권한 — ad-insight 와 같은 키(같은 주소 its.itket.com)라 한쪽에서 확인되면 다른 쪽도 바로 열린다.
 * 볼 수 있는 권한(관리자·승인)만 12시간 기억한다
 */
const ROLE_CACHE_KEY = 'adi_access_role';
const ROLE_CACHE_MS = 12 * 3600 * 1000;
const readRoleCache = (uid: string): AccessRole | null => {
  try {
    const c = JSON.parse(localStorage.getItem(ROLE_CACHE_KEY) || 'null') as { uid: string; role: AccessRole; at: number } | null;
    return c && c.uid === uid && Date.now() - c.at < ROLE_CACHE_MS && canViewRole(c.role) ? c.role : null;
  } catch {
    return null;
  }
};
const writeRoleCache = (uid: string, role: AccessRole | null) => {
  try {
    if (role && canViewRole(role)) localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ uid, role, at: Date.now() }));
    else localStorage.removeItem(ROLE_CACHE_KEY);
  } catch {
    // 저장 공간을 못 쓰면 매번 확인한다
  }
};

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

/** 비밀번호 정하기(updateUser) 오류 → 화면 문구 */
const passwordErrorText = (message: string): string => {
  if (/different from the old|same/i.test(message)) return '지금 쓰는 비밀번호와 다른 비밀번호로 정해 주세요.';
  if (/weak|short|at least|characters/i.test(message)) return '비밀번호가 너무 쉽거나 짧습니다. 6자 이상으로 다시 정해 주세요.';
  return '비밀번호를 정하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
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
  // 회원가입 도중 표시 — 2단계(정보 입력)에서 새로 고침해도 이어서 하도록 이 탭(sessionStorage)에 남긴다
  const [signupInProgress, setSignupInProgressState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SIGNUP_STEP_KEY) === '1';
    } catch {
      return false;
    }
  });
  const setSignupInProgress = useCallback((on: boolean) => {
    setSignupInProgressState(on);
    try {
      if (on) sessionStorage.setItem(SIGNUP_STEP_KEY, '1');
      else sessionStorage.removeItem(SIGNUP_STEP_KEY);
    } catch {
      // 저장하지 못하면 새로 고침 때 승인 요청 화면으로 간다
    }
  }, []);
  const refreshRole = useCallback(() => setRoleTick((n) => n + 1), []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setUser(session?.user ? toAuthUser(session.user) : null))
      .catch(() => setUser(null))
      .finally(() => setSessionLoading(false));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // 로그아웃·세션 만료면 남은 가입 도중 표시를 지운다 (비로그인에게 2단계 폼이 보이지 않게)
      if (event === 'SIGNED_OUT') setSignupInProgress(false);
      setUser(session?.user ? toAuthUser(session.user) : null);
      setSessionLoading(false);
    });
    window.addEventListener(ACCESS_CHANGED_EVENT, refreshRole);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener(ACCESS_CHANGED_EVENT, refreshRole);
    };
  }, [refreshRole, setSignupInProgress]);

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
    // 최근에 받은 권한이 있으면 바로 열고 뒤에서 다시 확인한다 (웹앱 확인 2~4초). 데이터는 웹앱이 토큰으로 따로 막는다
    const remembered = readRoleCache(userId);
    if (remembered) {
      setRole(remembered);
      setRoleLoading(false);
    } else setRoleLoading(true);
    currentAccessToken()
      .then(fetchAccessRole)
      .then((next) => {
        if (!alive) return;
        // 만료된 로그인은 지우고 로그인 화면으로 (인증 콜백 안에서 Supabase 를 다시 부르면 멈출 수 있어 setTimeout)
        if (next === 'invalid') setTimeout(() => supabase.auth.signOut(), 0);
        // 확인에 실패(null)했는데 기억한 권한이 있으면 그대로 둔다 — 웹앱 일시 장애로 잠기지 않게
        if (next === null && remembered) return;
        setRole(next);
        writeRoleCache(userId, next);
      })
      .finally(() => alive && setRoleLoading(false));
    return () => {
      alive = false;
    };
  }, [sessionLoading, userId, roleTick]);

  const sendEmailCode = async (email: string, signup = false): Promise<{ error?: string }> => {
    const mail = toLoginEmail(email);
    if (!isEmail(mail)) return { error: '이메일 주소를 확인해 주세요.' };
    const { error } = await supabase.auth.signInWithOtp({
      email: mail,
      options: { shouldCreateUser: signup, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    return error ? { error: codeErrorText(error.message) } : {};
  };

  const loginWithPassword = async (loginId: string, password: string): Promise<{ error?: string }> => {
    if (!loginId.trim() || !password) return { error: '이메일과 비밀번호를 입력해 주세요.' };
    const { error } = await supabase.auth.signInWithPassword({ email: toLoginEmail(loginId), password });
    if (error) {
      console.error('Login error:', error.message);
      if (/rate|too many/i.test(error.message)) return { error: '요청이 많아 잠시 막혔습니다. 1분 뒤 다시 시도해 주세요.' };
      return { error: '이메일 또는 비밀번호가 맞지 않습니다. 잊으셨으면 "비밀번호를 잊으셨나요?"에서 새로 정해 주세요.' };
    }
    return {};
  };

  const verifyEmailCode = async (email: string, code: string): Promise<{ error?: string }> => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return { error: '메일로 받은 6자리 인증번호를 입력해 주세요.' };
    // 인증되면 곧바로 로그인 상태가 되므로, 그 전에 '가입 도중'으로 표시해 접속 화면이 가입 폼을 그대로 두게 한다
    setSignupInProgress(true);
    const { data, error } = await supabase.auth.verifyOtp({ email: toLoginEmail(email), token, type: 'email' });
    if (error || !data.session) {
      setSignupInProgress(false);
      return { error: codeErrorText(error?.message || 'invalid') };
    }
    return {};
  };

  const completeSignup = async ({ name, team, password }: SignUpInfo): Promise<{ error?: string }> => {
    if (!name.trim() || !team.trim()) return { error: '이름과 소속을 입력해 주세요.' };
    if (password.length < 6) return { error: '비밀번호는 6자 이상으로 정해 주세요.' };
    // 인증으로 로그인된 세션에 비밀번호·이름·소속을 정한다 — 다음부터 비밀번호로 로그인한다
    const pw = await supabase.auth.updateUser({ password, data: { name: name.trim(), team: team.trim() } });
    if (pw.error) {
      console.error('Set password error:', pw.error.message);
      return { error: passwordErrorText(pw.error.message) };
    }
    const req = await postAccessRequest(name.trim(), team.trim()).catch(() => ({ error: 'network' }));
    if (req.error) return { error: req.error === 'too_many' ? requestErrorText(req.error) : '열람 요청을 보내지 못했습니다. 잠시 뒤 다시 시도해 주세요.' };
    setSignupInProgress(false);
    refreshRole();
    return {};
  };

  const cancelSignup = async () => {
    setSignupInProgress(false);
    await supabase.auth.signOut();
  };

  const resetPasswordWithCode = async (email: string, code: string, newPassword: string): Promise<{ error?: string }> => {
    const token = code.replace(/\D/g, '');
    if (token.length < 6) return { error: '메일로 받은 6자리 인증번호를 입력해 주세요.' };
    if (newPassword.length < 6) return { error: '새 비밀번호는 6자 이상으로 정해 주세요.' };
    const { data, error } = await supabase.auth.verifyOtp({ email: toLoginEmail(email), token, type: 'email' });
    if (error || !data.session) {
      console.error('Verify code error:', error?.message);
      return { error: codeErrorText(error?.message || 'invalid') };
    }
    const pw = await supabase.auth.updateUser({ password: newPassword });
    if (pw.error) {
      console.error('Reset password error:', pw.error.message);
      return { error: passwordErrorText(pw.error.message) + ' (로그인은 됐습니다)' };
    }
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
    setSignupInProgress(false);
    writeRoleCache('', null);
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
        completeSignup,
        signupInProgress: signupInProgress && !!user,
        cancelSignup,
        resetPasswordWithCode,
        loginWithPassword,
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
