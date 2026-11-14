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
  return (
    <main className="login">
      <div className="panel login-box">
        <h1>{APP_NAME}</h1>
        <p>Organize suas contas, cartões e faturas em um só lugar.</p>
        {erro && <p className="error">{ERRORS[erro] || 'Não foi possível entrar.'}</p>}
        <a className="btn" href="/api/auth/google">
          Entrar com Google
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
