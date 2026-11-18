import { useState, type ReactNode } from 'react';
import { Clock, Lock, ShieldOff, TriangleAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { Skeleton } from './Skeleton';

const GATE_TITLE = '방문 & 전환 대시보드';

/** 접속 화면 한 장 — 가운데 카드 (ad-insight 접속 화면과 같은 모양) */
function GateCard({ icon, title, desc, children }: { icon: ReactNode; title: string; desc: ReactNode; children?: ReactNode }) {
  return (
    <div className="access-gate">
      <section className="card gate-card" role="main" aria-labelledby="access-gate-title">
        <div className="gate-icon">{icon}</div>
        <h2 id="access-gate-title">{title}</h2>
        <p>{desc}</p>
        {children}
      </section>
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

function LoginForm() {
  const { loginWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await loginWithPassword(email, password);
    setBusy(false);
    if (res.error) setError(res.error);
  };
  return (
    <form className="gate-form" onSubmit={submit}>
      <GateInput name="username" autoComplete="username" placeholder="이메일" value={email} onChange={setEmail} err={!!error} autoFocus />
      <GateInput type="password" name="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={setPassword} err={!!error} />
      {error && <GateError message={error} />}
      <GateSubmit busy={busy} busyText="확인 중...">로그인</GateSubmit>
    </form>
  );
}

/** 회원가입 — 가입 후 관리자에게 승인 요청을 보낸다 (ad-insight 와 같은 계정·명단) */
function SignUpForm({ onSent }: { onSent: (needsEmailConfirm: boolean) => void }) {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError('');
    if (password !== password2) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    const res = await signUp({ name, team, email, password });
    setBusy(false);
    if (res.error) setError(res.error);
    else onSent(!!res.needsEmailConfirm);
  };
  const err = !!error;
  return (
    <form className="gate-form" onSubmit={submit}>
      <GateInput name="name" autoComplete="name" placeholder="이름" value={name} onChange={setName} err={err} />
      <GateInput name="team" autoComplete="organization" placeholder="소속 (회사·팀)" value={team} onChange={setTeam} err={err} />
      <GateInput type="email" name="email" autoComplete="email" placeholder="이메일" value={email} onChange={setEmail} err={err} />
      <GateInput type="password" name="new-password" autoComplete="new-password" placeholder="비밀번호 (6자 이상)" value={password} onChange={setPassword} err={err} />
      <GateInput type="password" name="new-password2" autoComplete="new-password" placeholder="비밀번호 확인" value={password2} onChange={setPassword2} err={err} />
      {error && <GateError message={error} />}
      <GateSubmit busy={busy} busyText="보내는 중...">회원가입 및 열람 요청</GateSubmit>
    </form>
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
  const [sent, setSent] = useState<null | { confirm: boolean }>(null);

  // 권한을 다시 확인하는 동안에도 이미 보고 있던 화면은 그대로 둔다
  if (canView) return <>{children}</>;

  if (loading) {
    return (
      <GateCard icon={<Lock size={20} aria-hidden="true" />} title={GATE_TITLE} desc="접속 권한을 확인하고 있습니다.">
        <Skeleton width="100%" height="2.625rem" />
      </GateCard>
    );
  }

  if (!user) {
    if (sent) {
      return (
        <GateCard
          icon={<Clock size={20} aria-hidden="true" />}
          title="회원가입 및 열람 요청을 보냈습니다"
          desc={sent.confirm ? '받은 메일의 인증 링크를 누른 뒤 로그인해 주세요. 관리자가 승인하면 데이터를 볼 수 있습니다.' : '관리자가 승인하면 로그인해서 데이터를 볼 수 있습니다.'}
        >
          <Button variant="primary" className="btn-gate" onClick={() => { setSent(null); setMode('login'); }}>
            로그인 화면으로
          </Button>
        </GateCard>
      );
    }
    const login = mode === 'login';
    return (
      <GateCard
        icon={<Lock size={20} aria-hidden="true" />}
        title={login ? GATE_TITLE : '회원가입 및 열람 요청'}
        desc={login ? '승인된 계정만 볼 수 있습니다. 광고 인사이트 계정으로 로그인하세요.' : '가입과 함께 관리자에게 열람 승인을 요청합니다. 승인되면 광고 인사이트와 함께 볼 수 있습니다.'}
      >
        {login ? <LoginForm /> : <SignUpForm onSent={(confirm) => setSent({ confirm })} />}
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
