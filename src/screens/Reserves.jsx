import { PiggyBank } from 'lucide-react';
import { useState } from 'react';
import { api, brl, centsToInput, fmtDateFull, toCents } from '../api.js';
import { Field, IconChip, Loading, Modal, useLoad } from '../ui.jsx';

const GREEN = '#19b27b';

function ReserveForm({ reserve, onClose, onSaved }) {
  const [f, setF] = useState({
    name: reserve?.name || '',
    target: reserve?.target_cents ? centsToInput(reserve.target_cents) : '',
    date: reserve?.target_date || '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const target = f.target ? toCents(f.target) : null;
    if (f.target && (!target || target <= 0)) return setErr('Meta inválida.');
    const body = { name: f.name, target_cents: target ?? '', target_date: f.date || null };
    try {
      await api(reserve ? `/api/reserves/${reserve.id}` : '/api/reserves', { method: reserve ? 'PATCH' : 'POST', body });
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  async function remove() {
    if (!confirm(`Excluir "${reserve.name}" e todo o histórico?`)) return;
    await api(`/api/reserves/${reserve.id}`, { method: 'DELETE' });
    onSaved();
  }

  return (
    <Modal title={reserve ? 'Editar reserva' : 'Nova reserva'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nome"><input value={f.name} onChange={set('name')} required maxLength={60} /></Field>
        <div className="two">
          <Field label="Meta (R$, opcional)"><input inputMode="decimal" value={f.target} onChange={set('target')} placeholder="0,00" /></Field>
          <Field label="Prazo (opcional)"><input type="date" value={f.date} onChange={set('date')} /></Field>
        </div>
        {err && <p className="error">{err}</p>}
        <button className="btn">Salvar</button>
        {reserve && <button type="button" className="link" onClick={remove}>Excluir reserva</button>}
      </form>
    </Modal>
  );
}

function History({ id, onChange }) {
  const q = useLoad(() => api(`/api/reserves/${id}`), [id]);
  if (!q.data) return <Loading q={q} />;
  if (!q.data.entries.length) return <p className="muted">Sem movimentações.</p>;
  async function del(eid) {
    try {
      await api(`/api/reserves/${id}/entries/${eid}`, { method: 'DELETE' });
      q.reload();
      onChange();
    } catch (e) {
      alert(e.message);
    }
  }
  return (
    <ul className="list">
      {q.data.entries.map((e) => (
        <li key={e.id}>
          <span className="grow">
            {e.amount_cents > 0 ? 'Aporte' : 'Resgate'}
            <br /><small className="muted">{fmtDateFull(e.date)}{e.note ? ` · ${e.note}` : ''}</small>
          </span>
          <b className={e.amount_cents > 0 ? 'pos' : 'neg'}>{brl(e.amount_cents)}</b>
          <button className="link" onClick={() => del(e.id)}>Excluir</button>
        </li>
      ))}
    </ul>
  );
}

function Reserve({ r, onChange, onEdit }) {
  const [val, setVal] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState(false);
  const bal = r.balance_cents;
  const target = r.target_cents;
  const pct = target ? Math.min(100, Math.round((bal / target) * 100)) : 0;

  async function move(sign) {
    const c = toCents(val);
    if (!c || c <= 0) return setErr('Informe um valor.');
    setBusy(true);
    setErr('');
    try {
      await api(`/api/reserves/${r.id}/entries`, { method: 'POST', body: { amount_cents: sign * c } });
      setVal('');
      onChange();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <div className="row between">
        <div className="ph"><IconChip Icon={PiggyBank} color={r.color || GREEN} /><h3>{r.name}</h3></div>
        <button className="link" onClick={onEdit}>Editar</button>
      </div>
      <p className="big sm">{brl(bal)}</p>
      {target ? (
        <>
          <div className="thin lg"><i style={{ width: `${pct}%`, background: r.color || GREEN }} /></div>
          <p className="sub">
            {pct}% de {brl(target)}
            {bal < target ? ` · faltam ${brl(target - bal)}` : ' · meta atingida'}
            {r.target_date ? ` · prazo ${fmtDateFull(r.target_date)}` : ''}
          </p>
        </>
      ) : <p className="sub">Sem meta definida.</p>}
      <div className="row gap">
        <input inputMode="decimal" placeholder="Valor (R$)" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Valor" />
        <button className="btn sm" disabled={busy} onClick={() => move(1)}>Guardar</button>
        <button className="btn sm ghost" disabled={busy} onClick={() => move(-1)}>Resgatar</button>
      </div>
      {err && <p className="error">{err}</p>}
      <button className="link" onClick={() => setHist(!hist)}>{hist ? 'Ocultar histórico' : 'Ver histórico'}</button>
      {hist && <History id={r.id} onChange={onChange} />}
    </section>
  );
}

export default function Reserves() {
  const q = useLoad(() => api('/api/reserves'), []);
  const [form, setForm] = useState(null); // null | {} | reserva
  if (!q.data) return <Loading q={q} />;
  const list = q.data.reserves;
  const total = list.reduce((s, r) => s + r.balance_cents, 0);

  return (
    <>
      <div className="row between">
        <span>Total guardado: <b>{brl(total)}</b></span>
        <button className="btn" onClick={() => setForm({})}>Nova reserva</button>
      </div>
      {list.length === 0 && <section className="panel"><p className="muted">Nenhuma reserva ainda.</p></section>}
      {list.map((r) => <Reserve key={r.id} r={r} onChange={q.reload} onEdit={() => setForm(r)} />)}
      {form && <ReserveForm reserve={form.id ? form : null} onClose={() => setForm(null)} onSaved={() => { setForm(null); q.reload(); }} />}
    </>
  );
}
