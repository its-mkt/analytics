import { useEffect, useState, type ReactNode } from 'react';
import { ChartNoAxesCombined, Clock, Layers, Lock, MailCheck, ShieldCheck, ShieldOff, TriangleAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { MonthViewSkeleton } from './DashboardSkeleton';

const GATE_TITLE = '방문 & 전환 대시보드';

/** 접속 화면 왼쪽 서비스 소개 (ad-insight 와 같은 구성, 휴대폰에서는 제목·한 줄 소개만) */
function GateBrand() {
  return (
    <aside className="access-gate-brand">
      <span className="gate-brand-mark" aria-hidden="true">
        <ChartNoAxesCombined size={20} />
      </span>
      <p className="gate-brand-name">{GATE_TITLE}</p>
      <p className="gate-brand-lead">아이티켓·온코어 방문과 전환 흐름을 한 화면에서 봅니다.</p>
      <ul className="gate-brand-points">
        <li>
          <ShieldCheck size={16} aria-hidden="true" />
          관리자가 승인한 계정만 열람
        </li>
        <li>
          <MailCheck size={16} aria-hidden="true" />
          이메일 인증을 거친 실제 계정만 가입
        </li>
        <li>
          <Layers size={16} aria-hidden="true" />
          한 계정으로 광고 인사이트·애널리틱스
        </li>
      </ul>
      <p className="gate-brand-foot">계정·권한 문의는 마케팅팀으로 연락해 주세요.</p>
    </aside>
  );
}

/** 접속 화면 한 장 — 왼쪽 서비스 소개 + 오른쪽 카드 (ad-insight 접속 화면과 같은 모양) */
function GateCard({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: ReactNode; children?: ReactNode }) {
  return (
    <div className="access-gate">
      <div className="access-gate-shell">
        <GateBrand />
        <section className="card gate-card" role="main" aria-labelledby="access-gate-title">
          <div className="gate-icon">{icon}</div>
          <h2 id="access-gate-title">{title}</h2>
          <p>{desc}</p>
          {children}
        </section>
      </div>
    </div>
  );
}

/** 입력칸 아래 오류 한 줄 */
function GateError({ message }: { message: string }) {
  return (
    <div className="gate-error" role="alert">
      <TriangleAlert size={12} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

/** 접속 화면 입력칸 */
function GateInput(props: { type?: string; name: string; autoComplete: string; placeholder: string; value: string; onChange: (v: string) => void; err: boolean; autoFocus?: boolean }) {
  const { onChange, err, ...rest } = props;
  return <input className={`gate-input${err ? ' err' : ''}`} type="text" {...rest} onChange={(e) => onChange(e.target.value)} />;
}

/** 폼 제출 버튼 — 입력칸과 같은 높이 */
function GateSubmit({ busy, busyText, children }: { busy: boolean; busyText: string; children: ReactNode }) {
  return (
    <Button type="submit" variant="primary" className="btn-gate" disabled={busy}>
      {busy ? busyText : children}
    </Button>
  );
}

/** 인증번호를 다시 보낼 수 있을 때까지 기다리는 초 (Supabase 기본 제한과 같다) */
const RESEND_SEC = 60;

/**
 * 이메일 인증번호 폼 (ad-insight 의 EmailCodeForm 과 같은 흐름) — 로그인은 비밀번호로 하고, 인증번호는 메일 주인 확인에만 쓴다 (2026-11-18 사용자 결정).
 * signup: 이름·소속·이메일·비밀번호 → 인증번호 → 가입 및 열람 요청 · reset: 이메일 → 인증번호·새 비밀번호 → 바꾸고 로그인
 */
function EmailCodeForm({ mode, initialEmail = '', onDone }: { mode: 'signup' | 'reset'; initialEmail?: string; onDone?: (email: string) => void }) {
  const { sendEmailCode, verifyEmailCode, resetPasswordWithCode } = useAuth();
  const signup = mode === 'signup';
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [wait, setWait] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const info = signup ? { name, team, password } : undefined;
  const send = async () => {
    setError('');
    if (signup && password !== password2) return setError('비밀번호 확인이 일치하지 않습니다.');
    setBusy(true);
    const res = await sendEmailCode(email, info);
    setBusy(false);
    if (res.error) return setError(res.error);
    setSentTo(email.trim());
    setCode('');
    setWait(RESEND_SEC);
  };
  const verify = async (value = code) => {
    setError('');
    if (!signup && password !== password2) return setError('새 비밀번호 확인이 일치하지 않습니다.');
    setBusy(true);
    const res = signup ? await verifyEmailCode(sentTo, value, info) : await resetPasswordWithCode(sentTo, value, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else onDone?.(sentTo);
  };
  const err = !!error;
  const passwordFields = (label: string) => (
    <>
      <GateInput type="password" name="new-password" autoComplete="new-password" placeholder={`${label} (6자 이상)`} value={password} onChange={setPassword} err={err} />
      <GateInput type="password" name="new-password2" autoComplete="new-password" placeholder={`${label} 확인`} value={password2} onChange={setPassword2} err={err} />
    </>
  );

  if (!sentTo) {
    return (
      <form className="gate-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {signup && (
          <>
            <GateInput name="name" autoComplete="name" placeholder="이름" value={name} onChange={setName} err={err} />
            <GateInput name="team" autoComplete="organization" placeholder="소속 (회사·팀)" value={team} onChange={setTeam} err={err} />
          </>
        )}
        <GateInput type="email" name="email" autoComplete="email" placeholder="이메일" value={email} onChange={setEmail} err={err} autoFocus={!signup} />
        {signup && passwordFields('비밀번호')}
        {error && <GateError message={error} />}
        <GateSubmit busy={busy} busyText="보내는 중...">{signup ? '이메일 인증번호 받기' : '인증번호 받기'}</GateSubmit>
      </form>
    );
  }
  return (
    <form className="gate-form" onSubmit={(e) => { e.preventDefault(); void verify(); }}>
      <p className="gate-code-sent">
        <strong>{sentTo}</strong> 로 보낸 6자리 인증번호를 입력해 주세요. 메일이 없으면 스팸함도 확인해 주세요.
      </p>
      <input
        className={`gate-input gate-code${err ? ' err' : ''}`}
        name="one-time-code"
        autoComplete="one-time-code"
        inputMode="numeric"
        maxLength={6}
        placeholder="인증번호 6자리"
        value={code}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 6);
          setCode(v);
          // 회원가입은 6자리를 다 넣으면(붙여넣기 포함) 바로 확인한다 (비밀번호 찾기는 새 비밀번호를 함께 받는다)
          if (signup && v.length === 6 && !busy) void verify(v);
        }}
        autoFocus
      />
      {!signup && passwordFields('새 비밀번호')}
      {error && <GateError message={error} />}
      <GateSubmit busy={busy} busyText="확인 중...">{signup ? '회원가입 및 열람 요청' : '비밀번호 바꾸고 로그인'}</GateSubmit>
      <div className="gate-code-actions">
        <button type="button" className="gate-link" disabled={wait > 0 || busy} onClick={() => void send()}>
          {wait > 0 ? `다시 보내기 (${wait}초)` : '인증번호 다시 보내기'}
        </button>
        <button type="button" className="gate-link" onClick={() => { setSentTo(''); setError(''); }}>
          이메일 바꾸기
        </button>
      </div>
    </form>
  );
}

/** 비밀번호 로그인 폼 — 브라우저에 저장한 비밀번호가 자동으로 채워진다 */
function PasswordLoginForm({ initialEmail = '', onDone }: { initialEmail?: string; onDone?: (email: string) => void }) {
  const { loginWithPassword } = useAuth();
  const [loginId, setLoginId] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await loginWithPassword(loginId, password);
    setBusy(false);
    if (res.error) setError(res.error);
    else onDone?.(loginId.trim());
  };
  return (
    <form className="gate-form" onSubmit={submit}>
      <GateInput name="username" autoComplete="username" placeholder="이메일" value={loginId} onChange={setLoginId} err={!!error} autoFocus={!initialEmail} />
      <GateInput type="password" name="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={setPassword} err={!!error} autoFocus={!!initialEmail} />
      {error && <GateError message={error} />}
      <GateSubmit busy={busy} busyText="확인 중...">로그인</GateSubmit>
    </form>
  );
}

/** 이 브라우저에서 지난번 로그인한 이메일 — ad-insight 와 같은 키라 두 화면이 함께 기억한다 (편의용, 읽지 못해도 빈 칸으로 시작) */
const LOGIN_PREF_KEY = 'adi_login_pref';
function readLastEmail(): string {
  try {
    const v = JSON.parse(localStorage.getItem(LOGIN_PREF_KEY) || '{}');
    return typeof v.email === 'string' ? v.email : '';
  } catch {
    return '';
  }
}
function saveLastEmail(email: string) {
  try {
    localStorage.setItem(LOGIN_PREF_KEY, JSON.stringify({ email }));
  } catch {
    // 저장하지 못해도 로그인에는 영향 없다
  }
}

/** 로그인 — 이메일·비밀번호로만 (ad-insight 와 같은 흐름), 잊으면 '비밀번호를 잊으셨나요?'에서 메일 인증번호로 새로 정한다 */
function LoginForm() {
  const [lastEmail] = useState(readLastEmail);
  const [resetting, setResetting] = useState(false);
  return (
    <>
      {resetting ? (
        <EmailCodeForm key="reset" mode="reset" initialEmail={lastEmail} onDone={saveLastEmail} />
      ) : (
        <PasswordLoginForm key="password" initialEmail={lastEmail} onDone={saveLastEmail} />
      )}
      <p className="gate-method">
        <button type="button" className="gate-link" onClick={() => setResetting(!resetting)}>
          {resetting ? '로그인으로 돌아가기' : '비밀번호를 잊으셨나요?'}
        </button>
      </p>
    </>
  );
}

/** 로그인한 계정으로 승인을 (다시) 요청 — 요청 기록이 없거나 거절·해제된 경우 */
function RequestAgainForm() {
  const { user, requestAccess } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [team, setTeam] = useState(user?.team || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await requestAccess(name, team);
    setBusy(false);
    if (res.error) setError(res.error);
  };
  return (
    <form className="gate-form" onSubmit={submit}>
      <GateInput name="name" autoComplete="name" placeholder="이름" value={name} onChange={setName} err={!!error} />
      <GateInput name="team" autoComplete="organization" placeholder="소속 (회사·팀)" value={team} onChange={setTeam} err={!!error} />
      {error && <GateError message={error} />}
      <GateSubmit busy={busy} busyText="보내는 중...">승인 요청 보내기</GateSubmit>
    </form>
  );
}

/** 계정 표시 + 다시 확인·로그아웃 */
function GateActions({ recheck }: { recheck?: boolean }) {
  const { logout, refreshRole, user } = useAuth();
  return (
    <div className="gate-actions">
      {user?.email && <span className="gate-account">{user.email}</span>}
      {recheck && <Button onClick={refreshRole}>승인 여부 다시 확인</Button>}
      <Button onClick={() => void logout()}>로그아웃</Button>
    </div>
  );
}

/**
 * 접속 관문 — 관리자 또는 승인된 계정만 대시보드(children)를 연다. 그 밖에는 대시보드를 그리지 않아 데이터 요청도 나가지 않는다.
 * 계정·승인은 ad-insight 와 공유한다 (2026-11-18 사용자 결정). 가입 요청 승인은 ad-insight 관리자 화면에서 한다.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const { loading, user, role, canView, refreshRole } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // 권한을 다시 확인하는 동안에도 이미 보고 있던 화면은 그대로 둔다
  if (canView) return <>{children}</>;

  // 권한 확인 중 — 잠금 카드 대신 대시보드 모양 로딩 (ad-insight 접속 화면과 같은 방식)
  if (loading) {
    return (
      <div className="site-loading access-loading">
        <div className="access-loading-bar" aria-hidden="true" />
        <p className="access-loading-status" role="status">
          <Lock size={14} aria-hidden="true" />
          접속 권한을 확인하고 있습니다
        </p>
        <MonthViewSkeleton tab="overview" hasEstimate />
      </div>
    );
  }

  if (!user) {
    const login = mode === 'login';
    return (
      <GateCard
        icon={<Lock size={20} aria-hidden="true" />}
        title={login ? GATE_TITLE : '회원가입 및 열람 요청'}
        desc={login ? '승인된 계정만 볼 수 있습니다. 광고 인사이트와 같은 계정으로 로그인합니다.' : '이메일 인증번호로 가입과 함께 관리자에게 열람 승인을 요청합니다. 승인되면 광고 인사이트와 함께 볼 수 있습니다.'}
      >
        {login ? <LoginForm /> : <EmailCodeForm key="signup" mode="signup" />}
        <p className="gate-switch">
          {login ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}{' '}
          <button type="button" className="gate-link" onClick={() => setMode(login ? 'signup' : 'login')}>
            {login ? '회원가입' : '로그인'}
          </button>
        </p>
      </GateCard>
    );
  }

  if (role === 'pending') {
    return (
      <GateCard icon={<Clock size={20} aria-hidden="true" />} title="승인을 기다리고 있습니다" desc="관리자가 가입 요청을 확인하고 있습니다. 승인되면 바로 볼 수 있습니다.">
        <GateActions recheck />
      </GateCard>
    );
  }

  if (role === null) {
    return (
      <GateCard icon={<ShieldOff size={20} aria-hidden="true" />} title="권한을 확인하지 못했습니다" desc="잠시 뒤 다시 시도해 주세요.">
        <Button variant="primary" className="btn-gate" onClick={refreshRole}>
          다시 시도
        </Button>
        <GateActions />
      </GateCard>
    );
  }

  // 요청 기록 없음(none)·거절(rejected)·해제(revoked)
  return (
    <GateCard
      icon={<ShieldOff size={20} aria-hidden="true" />}
      title={role === 'none' ? '승인 요청이 필요합니다' : '열람 권한이 없습니다'}
      desc={role === 'none' ? '이름과 소속을 적어 관리자에게 승인을 요청해 주세요.' : '관리자가 열람 권한을 승인하지 않았거나 해제했습니다. 필요하면 다시 요청해 주세요.'}
    >
      <RequestAgainForm />
      <GateActions />
    </GateCard>
  );
}
