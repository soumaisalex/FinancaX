import { useEffect, useState } from 'react';
import { api, brl } from './api.js';

const APP_NAME = 'Finanças';
const NAV = [
  { id: 'home', label: 'Visão geral' },
  { id: 'flow', label: 'Fluxo de caixa' },
  { id: 'cards', label: 'Cartões' },
  { id: 'reserve', label: 'Reserva' },
];
const ERRORS = {
  cancelado: 'Login cancelado. Tente de novo.',
  estado: 'A sessão de login expirou. Tente de novo.',
  email: 'Sua conta Google precisa ter email verificado.',
  token: 'Não foi possível validar o login com o Google.',
  codigo: 'Não foi possível concluir o login.',
};

function Login() {
  const erro = new URLSearchParams(location.search).get('erro');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState(erro ? ERRORS[erro] || 'Não foi possível entrar.' : '');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isLogin = mode === 'login';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await api(`/api/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body: form });
      location.href = '/';
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="panel login-box">
        <h1>{APP_NAME}</h1>
        <div className="tabs" role="tablist">
          <button type="button" className={isLogin ? 'on' : ''} onClick={() => setMode('login')}>
            Entrar
          </button>
          <button type="button" className={!isLogin ? 'on' : ''} onClick={() => setMode('register')}>
            Criar conta
          </button>
        </div>
        <form onSubmit={submit} className="form">
          {!isLogin && (
            <label>
              Nome
              <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              minLength={isLogin ? undefined : 8}
              maxLength={128}
            />
          </label>
          {msg && <p className="error">{msg}</p>}
          <button className="btn" disabled={busy}>
            {isLogin ? 'Entrar' : 'Criar conta'}
          </button>
        </form>
        <p className="sep">ou</p>
        <a className="btn ghost" href="/api/auth/google">
          Continuar com Google
        </a>
      </div>
    </main>
  );
}

function Shell({ user }) {
  const [tab, setTab] = useState('home');

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/';
  }

  return (
    <div className="shell">
      <aside className="side">
        <strong className="brand">{APP_NAME}</strong>
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={tab === n.id ? 'on' : ''} onClick={() => setTab(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="me">
          {user.avatar_url && <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" />}
          <span>{user.name}</span>
          <button className="link" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="panel">
          <h2>{NAV.find((n) => n.id === tab).label}</h2>
          <p>
            Olá, {user.name.split(' ')[0]}. Salário cadastrado: {brl(user.monthly_income_cents)}.
          </p>
        </div>
      </main>

      <nav className="bottom">
        {NAV.map((n) => (
          <button key={n.id} className={tab === n.id ? 'on' : ''} onClick={() => setTab(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    api('/api/me')
      .then((user) => setState({ status: 'in', user }))
      .catch((e) => setState({ status: e.status === 401 ? 'out' : 'error', user: null }));
  }, []);

  if (state.status === 'loading') return null;
  if (state.status === 'error') return <p className="error pad">Erro ao carregar. Recarregue a página.</p>;
  if (state.status === 'out') return <Login />;
  return <Shell user={state.user} />;
}
