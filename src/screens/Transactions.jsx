import { useState } from 'react';
import { api, brl, fmtDate, toCents, today } from '../api.js';
import { Field, Loading, Modal, useLoad } from '../ui.jsx';

function TxForm({ month, onClose, onSaved }) {
  const lists = useLoad(
    () => Promise.all([api('/api/categories'), api('/api/accounts'), api('/api/cards')]),
    []
  );
  const [f, setF] = useState({
    kind: 'expense', description: '', amount: '',
    date: today().startsWith(month) ? today() : `${month}-01`,
    category_id: '', source: '', installments: 1, repeat: false, paid: false,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const [cats, accounts, cards] = lists.data || [[], [], []];
  const isCard = f.source.startsWith('c:');

  async function submit(e) {
    e.preventDefault();
    const cents = toCents(f.amount);
    if (!cents || cents <= 0) return setErr('Informe um valor válido.');
    setBusy(true);
    setErr('');
    try {
      await api('/api/transactions', {
        method: 'POST',
        body: {
          kind: f.kind, description: f.description, amount_cents: cents, date: f.date,
          category_id: f.category_id || null,
          account_id: f.source.startsWith('a:') ? f.source.slice(2) : null,
          card_id: isCard ? f.source.slice(2) : null,
          installments: f.kind === 'expense' ? Number(f.installments) || 1 : 1,
          repeat: f.repeat ? 'monthly' : null,
          paid: f.paid && !isCard,
        },
      });
      onSaved();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Novo lançamento" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="tabs">
          {[['expense', 'Despesa'], ['income', 'Receita']].map(([k, l]) => (
            <button type="button" key={k} className={f.kind === k ? 'on' : ''}
              onClick={() => setF({ ...f, kind: k, category_id: '', source: isCard && k === 'income' ? '' : f.source })}>
              {l}
            </button>
          ))}
        </div>
        <Field label="Descrição">
          <input value={f.description} onChange={set('description')} required maxLength={120} />
        </Field>
        <div className="two">
          <Field label={f.installments > 1 ? 'Valor total (R$)' : 'Valor (R$)'}>
            <input inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0,00" required />
          </Field>
          <Field label="Data">
            <input type="date" value={f.date} onChange={set('date')} required />
          </Field>
        </div>
        <Field label="Categoria">
          <select value={f.category_id} onChange={set('category_id')}>
            <option value="">Sem categoria</option>
            {cats.filter((c) => c.kind === f.kind).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label={f.kind === 'expense' ? 'Pago com' : 'Recebido em'}>
          <select value={f.source} onChange={set('source')}>
            <option value="">Sem conta</option>
            {accounts.map((a) => <option key={a.id} value={`a:${a.id}`}>Conta: {a.name}</option>)}
            {f.kind === 'expense' && cards.map((c) => <option key={c.id} value={`c:${c.id}`}>Cartão: {c.name}</option>)}
          </select>
        </Field>
        {f.kind === 'expense' && (
          <Field label="Parcelas">
            <input type="number" min="1" max="60" value={f.installments} onChange={set('installments')} />
          </Field>
        )}
        {Number(f.installments) <= 1 && (
          <label className="check">
            <input type="checkbox" checked={f.repeat} onChange={set('repeat')} /> Repetir todo mês
          </label>
        )}
        {!isCard && Number(f.installments) <= 1 && !f.repeat && (
          <label className="check">
            <input type="checkbox" checked={f.paid} onChange={set('paid')} /> {f.kind === 'expense' ? 'Já foi pago' : 'Já foi recebido'}
          </label>
        )}
        {err && <p className="error">{err}</p>}
        <button className="btn" disabled={busy || !lists.data}>Salvar</button>
      </form>
    </Modal>
  );
}

export default function Transactions({ month }) {
  const q = useLoad(() => api(`/api/transactions?month=${month}`), [month]);
  const [adding, setAdding] = useState(false);
  const rows = q.data;
  if (!rows) return <Loading q={q} />;

  const sum = (kind) => rows.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount_cents, 0);

  async function toggle(t) {
    await api(`/api/transactions/${t.id}`, { method: 'PATCH', body: { paid: !t.paid } });
    q.reload();
  }
  async function remove(t) {
    let scope = '';
    if (t.recurrence_id) {
      if (!confirm('Encerrar esta recorrência a partir deste mês? Os lançamentos daqui para frente serão removidos.')) return;
      scope = '?scope=future';
    } else if (t.installment_total > 1) {
      if (confirm(`Excluir TODAS as ${t.installment_total} parcelas?\n(Cancelar para escolher só esta parcela)`)) scope = '?scope=group';
      else if (!confirm('Excluir somente esta parcela?')) return;
    } else if (!confirm('Excluir este lançamento?')) return;
    await api(`/api/transactions/${t.id}${scope}`, { method: 'DELETE' });
    q.reload();
  }

  return (
    <>
      <div className="row between">
        <p className="muted">
          Receitas <b className="pos">{brl(sum('income'))}</b> · Despesas <b>{brl(sum('expense'))}</b>
        </p>
        <button className="btn" onClick={() => setAdding(true)}>Novo lançamento</button>
      </div>
      <section className="panel">
        {rows.length === 0 && <p className="muted">Nenhum lançamento neste mês.</p>}
        <ul className="list">
          {rows.map((t) => (
            <li key={t.id} className={t.paid ? 'done' : ''}>
              {t.card_id ? <span className="chk" /> : (
                <input type="checkbox" checked={t.paid} onChange={() => toggle(t)}
                  aria-label={t.kind === 'expense' ? 'Marcar como pago' : 'Marcar como recebido'} />
              )}
              <span className="grow">
                {t.description}
                {t.installment_total > 1 && <small> {t.installment_no}/{t.installment_total}</small>}
                {t.recurrence_id && <small> · mensal</small>}
                <br />
                <small className="muted">
                  {fmtDate(t.date)}{t.category_name ? ` · ${t.category_name}` : ''}
                  {t.card_name ? ` · ${t.card_name}` : t.account_name ? ` · ${t.account_name}` : ''}
                </small>
              </span>
              <b className={t.kind === 'income' ? 'pos' : ''}>{t.kind === 'income' ? '+' : '−'} {brl(t.amount_cents)}</b>
              <button className="link" onClick={() => remove(t)}>Excluir</button>
            </li>
          ))}
        </ul>
      </section>
      {adding && <TxForm month={month} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); q.reload(); }} />}
    </>
  );
}
