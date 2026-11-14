import { useState } from 'react';
import { api, brl, centsToInput, toCents } from '../api.js';
import { Field, Loading, Modal, useLoad } from '../ui.jsx';

const TYPES = { checking: 'Conta corrente', savings: 'Poupança', cash: 'Dinheiro', wallet: 'Carteira digital' };

function Salary({ user }) {
  const [v, setV] = useState(centsToInput(user.monthly_income_cents));
  const [msg, setMsg] = useState('');
  async function save(e) {
    e.preventDefault();
    const c = toCents(v);
    if (c === null || c < 0) return setMsg('Valor inválido.');
    await api('/api/me', { method: 'PATCH', body: { monthly_income_cents: c } });
    setMsg('Salvo.');
  }
  return (
    <section className="panel">
      <h3>Salário mensal</h3>
      <form className="row gap" onSubmit={save}>
        <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} aria-label="Salário mensal" />
        <button className="btn sm">Salvar</button>
        {msg && <span className="muted">{msg}</span>}
      </form>
    </section>
  );
}

function AccountForm({ account, onClose, onSaved }) {
  const [f, setF] = useState({
    name: account?.name || '', type: account?.type || 'checking',
    initial: account ? centsToInput(account.initial_balance_cents) : '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    const initial = f.initial ? toCents(f.initial) : 0;
    if (initial === null) return setErr('Saldo inválido.');
    const body = { name: f.name, type: f.type, initial_balance_cents: initial };
    try {
      await api(account ? `/api/accounts/${account.id}` : '/api/accounts', { method: account ? 'PATCH' : 'POST', body });
      onSaved();
    } catch (e2) { setErr(e2.message); }
  }
  async function remove() {
    if (!confirm('Excluir esta conta? Com movimentações, ela será apenas arquivada.')) return;
    await api(`/api/accounts/${account.id}`, { method: 'DELETE' });
    onSaved();
  }
  return (
    <Modal title={account ? 'Editar conta' : 'Nova conta'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nome"><input value={f.name} onChange={set('name')} required maxLength={80} /></Field>
        <Field label="Tipo">
          <select value={f.type} onChange={set('type')}>
            {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Saldo inicial (R$)"><input inputMode="decimal" value={f.initial} onChange={set('initial')} placeholder="0,00" /></Field>
        {err && <p className="error">{err}</p>}
        <button className="btn">Salvar</button>
        {account && <button type="button" className="link" onClick={remove}>Excluir conta</button>}
      </form>
    </Modal>
  );
}

function Accounts() {
  const q = useLoad(() => api('/api/accounts'), []);
  const [form, setForm] = useState(null);
  return (
    <section className="panel">
      <div className="row between">
        <h3>Contas</h3>
        <button className="btn sm" onClick={() => setForm({})}>Nova conta</button>
      </div>
      <Loading q={q} />
      <ul className="list">
        {q.data?.map((a) => (
          <li key={a.id}>
            <span className="grow">{a.name} <small className="muted">{TYPES[a.type]}</small></span>
            <b>{brl(a.balance_cents)}</b>
            <button className="link" onClick={() => setForm(a)}>Editar</button>
          </li>
        ))}
      </ul>
      {form && <AccountForm account={form.id ? form : null} onClose={() => setForm(null)} onSaved={() => { setForm(null); q.reload(); }} />}
    </section>
  );
}

function Categories() {
  const q = useLoad(() => api('/api/categories'), []);
  const [name, setName] = useState('');
  const [kind, setKind] = useState('expense');
  const [err, setErr] = useState('');
  async function add(e) {
    e.preventDefault();
    setErr('');
    try {
      await api('/api/categories', { method: 'POST', body: { name, kind } });
      setName('');
      q.reload();
    } catch (e2) { setErr(e2.message); }
  }
  async function remove(c) {
    if (!confirm(`Excluir "${c.name}"? Os lançamentos ficam sem categoria.`)) return;
    await api(`/api/categories/${c.id}`, { method: 'DELETE' });
    q.reload();
  }
  return (
    <section className="panel">
      <h3>Categorias</h3>
      <Loading q={q} />
      {[['expense', 'Despesas'], ['income', 'Receitas']].map(([k, label]) => (
        <div key={k}>
          <p className="muted">{label}</p>
          <div className="chips">
            {q.data?.filter((c) => c.kind === k).map((c) => (
              <span className="chip" key={c.id}>
                {c.name}
                <button aria-label={`Excluir ${c.name}`} onClick={() => remove(c)}>×</button>
              </span>
            ))}
          </div>
        </div>
      ))}
      <form className="row gap" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" required maxLength={40} aria-label="Nome da categoria" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo">
          <option value="expense">Despesa</option>
          <option value="income">Receita</option>
        </select>
        <button className="btn sm">Adicionar</button>
      </form>
      {err && <p className="error">{err}</p>}
    </section>
  );
}

function Password() {
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState('');
  async function submit(e) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/me/password', { method: 'POST', body: { current_password: f.current, new_password: f.next } });
      setF({ current: '', next: '' });
      setMsg('Senha alterada. Os outros dispositivos foram desconectados.');
    } catch (e2) { setMsg(e2.message); }
  }
  return (
    <section className="panel">
      <h3>Alterar senha</h3>
      <form className="form" onSubmit={submit}>
        <Field label="Senha atual"><input type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} required /></Field>
        <Field label="Nova senha (mín. 8 caracteres)"><input type="password" autoComplete="new-password" minLength={8} maxLength={128} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} required /></Field>
        <button className="btn sm">Alterar senha</button>
        {msg && <p className="muted">{msg}</p>}
      </form>
    </section>
  );
}

export default function Settings({ user }) {
  return (
    <div className="stack">
      <h2>Ajustes</h2>
      <Salary user={user} />
      <Accounts />
      <Categories />
      <Password />
    </div>
  );
}
