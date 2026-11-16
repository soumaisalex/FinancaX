import { useState } from 'react';
import { api, brl, centsToInput, toCents } from '../api.js';
import { catStyle } from '../icons.js';
import { Field, IconChip, Loading, Modal, useLoad } from '../ui.jsx';

function BudgetForm({ c, onClose, onSaved }) {
  const [v, setV] = useState(c.budget_cents ? centsToInput(c.budget_cents) : '');
  const [err, setErr] = useState('');
  async function save(amount) {
    try {
      await api(`/api/budgets/${c.category_id}`, { method: 'PUT', body: { amount_cents: amount } });
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }
  function submit(e) {
    e.preventDefault();
    const cents = toCents(v);
    if (!cents || cents <= 0) return setErr('Informe um valor válido.');
    save(cents);
  }
  return (
    <Modal title={`Orçamento: ${c.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Limite mensal (R$)">
          <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} placeholder="0,00" autoFocus />
        </Field>
        {err && <p className="error">{err}</p>}
        <button className="btn">Salvar</button>
        {c.budget_cents && <button type="button" className="link" onClick={() => save(null)}>Remover orçamento</button>}
      </form>
    </Modal>
  );
}

export default function Budgets({ month, rev }) {
  const q = useLoad(() => api(`/api/budgets?month=${month}`), [month, rev]);
  const [edit, setEdit] = useState(null);
  if (!q.data) return <Loading q={q} />;
  const { categories, uncategorized_cents } = q.data;
  const budgeted = categories.filter((c) => c.budget_cents);
  const total = budgeted.reduce((s, c) => s + c.budget_cents, 0);
  const spent = budgeted.reduce((s, c) => s + c.spent_cents, 0);
  const reserved = budgeted.reduce((s, c) => s + Math.max(0, c.budget_cents - c.spent_cents), 0);

  return (
    <>
      <section className="panel tint">
        <h3>Orçamentos do mês</h3>
        <div className="legend3">
          <div><small>Orçado</small><b>{brl(total)}</b></div>
          <div><small>Gasto nas categorias orçadas</small><b>{brl(spent)}</b></div>
          <div><small>Ainda reservado</small><b className="pos">{brl(reserved)}</b></div>
        </div>
        {uncategorized_cents > 0 && <p className="sub">Sem categoria neste mês: {brl(uncategorized_cents)}</p>}
      </section>

      <section className="panel">
        <ul className="plist">
          {categories.map((c) => {
            const st = catStyle(c.name);
            const has = !!c.budget_cents;
            const pct = has ? Math.min(100, (c.spent_cents / c.budget_cents) * 100) : 0;
            const over = has && c.spent_cents > c.budget_cents;
            return (
              <li key={c.category_id}>
                <IconChip Icon={st.Icon} color={st.color} size={34} />
                <div className="grow">
                  <div className="row between">
                    <span className="name">{c.name}</span>
                    <b className={over ? 'neg' : ''}>{brl(c.spent_cents)}{has && <small className="muted"> / {brl(c.budget_cents)}</small>}</b>
                  </div>
                  {has ? (
                    <>
                      <div className="thin lg"><i style={{ width: `${pct}%`, background: over ? 'var(--danger)' : st.color }} /></div>
                      <small className={over ? 'neg' : 'muted'}>
                        {over ? `Estourou ${brl(c.spent_cents - c.budget_cents)}` : `Restam ${brl(c.budget_cents - c.spent_cents)}`}
                      </small>
                    </>
                  ) : <small className="muted">Sem orçamento</small>}
                </div>
                <button className="link" onClick={() => setEdit(c)}>{has ? 'Editar' : 'Definir'}</button>
              </li>
            );
          })}
        </ul>
        {categories.length === 0 && <p className="muted">Cadastre categorias de despesa em Ajustes.</p>}
      </section>
      {edit && <BudgetForm c={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); q.reload(); }} />}
    </>
  );
}
