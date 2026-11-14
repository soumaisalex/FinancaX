import { useEffect, useState } from 'react';
import { api, monthLabel, monthNow, shiftMonth } from './api.js';
import Cards from './screens/Cards.jsx';
import Overview from './screens/Overview.jsx';
import Settings from './screens/Settings.jsx';
import Transactions from './screens/Transactions.jsx';

const APP_NAME = 'Finanças';
const NAV = [
  { id: 'home', label: 'Visão geral' },
  { id: 'tx', label: 'Lançamentos' },
  { id: 'cards', label: 'Cartões' },
  { id: 'settings', label: 'Ajustes' },
];

function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
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
            <label className="field">
              Nome
              <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label className="field">
            Email
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </label>
          <label className="field">
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
      </div>
    </main>
  );
}

function Shell({ user }) {
  const [tab, setTab] = useState('home');
  const [month, setMonth] = useState(monthNow());

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/';
  }

  const screen = {
    home: <Overview month={month} go={setTab} />,
    tx: <Transactions month={month} />,
    cards: <Cards month={month} />,
    settings: <Settings user={user} />,
  }[tab];

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
          <span>{user.name}</span>
          <button className="link" onClick={logout}>
            Sair
          </button>
        </div>
      </aside>

      <main className="main">
        {tab !== 'settings' && (
          <div className="monthbar">
            <button aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </button>
            <h2>{monthLabel(month)}</h2>
            <button aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}>
              ›
            </button>
          </div>
        )}
        {screen}
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
