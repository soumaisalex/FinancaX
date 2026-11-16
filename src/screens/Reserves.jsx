import { useEffect, useState } from 'react';
import { PiggyBank, Plus, Trash2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { req, brl, toCents } from '../lib/req.js';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const card = { background: 'var(--card, rgba(127,127,127,.08))', borderRadius: 16, padding: 16 };
const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(127,127,127,.35)', background: 'transparent', color: 'inherit', font: 'inherit' };
const btn = { ...input, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };

function Reserve({ r, onChange }) {
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const bal = Number(r.balance_cents), goal = r.goal_cents == null ? null : Number(r.goal_cents);
  const pct = goal ? Math.min(100, Math.round((bal / goal) * 100)) : null;
  const color = r.color || COLORS[0];

  async function move(sign) {
    const c = toCents(val);
    if (!c || c <= 0) return setErr('Informe um valor');
    setBusy(true); setErr('');
    try { await req('POST', `/api/reserves/${r.id}/entries`, { amount_cents: sign * c }); setVal(''); await onChange(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Excluir "${r.name}" e todo o histórico?`)) return;
    try { await req('DELETE', `/api/reserves/${r.id}`); await onChange(); } catch (e) { setErr(e.message); }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ background: color + '33', color, borderRadius: 12, padding: 8, display: 'grid' }}><PiggyBank size={20} /></span>
        <strong style={{ flex: 1 }}>{r.name}</strong>
        <button onClick={remove} style={{ ...btn, border: 'none', padding: 4 }} aria-label="Excluir"><Trash2 size={16} /></button>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, margin: '10px 0 2px' }}>{brl(bal)}</div>
      {goal ? (
        <>
          <div style={{ height: 8, borderRadius: 8, background: 'rgba(127,127,127,.2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color }} />
          </div>
          <small style={{ opacity: .7 }}>
            {pct}% de {brl(goal)}{bal < goal ? ` · faltam ${brl(goal - bal)}` : ' · meta atingida'}
            {r.target_date ? ` · até ${r.target_date.split('-').reverse().join('/')}` : ''}
          </small>
        </>
      ) : <small style={{ opacity: .7 }}>Sem meta definida</small>}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 90 }} inputMode="decimal" placeholder="Valor" value={val} onChange={(e) => setVal(e.target.value)} />
        <button style={btn} disabled={busy} onClick={() => move(1)}><ArrowDownToLine size={16} />Guardar</button>
        <button style={btn} disabled={busy} onClick={() => move(-1)}><ArrowUpFromLine size={16} />Resgatar</button>
      </div>
      {err && <small style={{ color: '#ef4444' }}>{err}</small>}
    </div>
  );
}

export default function Reserves() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState({ name: '', goal: '', date: '', color: COLORS[0] });
  const [err, setErr] = useState('');

  const load = () => req('GET', '/api/reserves').then((d) => setList(d.reserves)).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  async function create(e) {
    e.preventDefault(); setErr('');
    const goal = form.goal ? toCents(form.goal) : null;
    if (form.goal && !goal) return setErr('Meta inválida');
    try {
      await req('POST', '/api/reserves', { name: form.name, goal_cents: goal, target_date: form.date || null, color: form.color });
      setForm({ name: '', goal: '', date: '', color: COLORS[0] }); await load();
    } catch (e2) { setErr(e2.message); }
  }

  const total = (list || []).reduce((s, r) => s + Number(r.balance_cents), 0);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2 style={{ margin: 0 }}>Reservas</h2>
        <span>Total guardado: <strong>{brl(total)}</strong></span>
      </div>

      <form onSubmit={create} style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...input, flex: 2, minWidth: 140 }} required maxLength={60} placeholder="Nome (ex.: Viagem)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input style={{ ...input, flex: 1, minWidth: 100 }} inputMode="decimal" placeholder="Meta (opcional)" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
        <input style={input} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        <span style={{ display: 'flex', gap: 4 }}>
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => setForm({ ...form, color: c })} aria-label={c}
              style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid currentColor' : '2px solid transparent' }} />
          ))}
        </span>
        <button style={btn}><Plus size={16} />Criar</button>
      </form>
      {err && <div style={{ color: '#ef4444' }}>{err}</div>}

      {list === null ? <p>Carregando…</p> : list.length === 0 ? <p style={{ opacity: .7 }}>Nenhuma reserva ainda.</p> : (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {list.map((r) => <Reserve key={r.id} r={r} onChange={load} />)}
        </div>
      )}
    </div>
  );
}
