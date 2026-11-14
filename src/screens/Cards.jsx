import { useState } from 'react';
import { api, brl, centsToInput, fmtDate, toCents } from '../api.js';
import { Field, Loading, Modal, useLoad } from '../ui.jsx';

function CardForm({ card, onClose, onSaved }) {
  const [f, setF] = useState({
    name: card?.name || '',
    limit: card ? centsToInput(card.limit_cents) : '',
    closing_day: card?.closing_day || 1,
    due_day: card?.due_day || 10,
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const limit = f.limit ? toCents(f.limit) : 0;
    if (limit === null || limit < 0) return setErr('Limite inválido.');
    const body = { name: f.name, limit_cents: limit, closing_day: Number(f.closing_day), due_day: Number(f.due_day) };
    try {
      await api(card ? `/api/cards/${card.id}` : '/api/cards', { method: card ? 'PATCH' : 'POST', body });
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }
  async function remove() {
    if (!confirm('Excluir este cartão? Com compras registradas, ele será apenas arquivado.')) return;
    await api(`/api/cards/${card.id}`, { method: 'DELETE' });
    onSaved();
  }

  return (
    <Modal title={card ? 'Editar cartão' : 'Novo cartão'} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nome"><input value={f.name} onChange={set('name')} required maxLength={80} /></Field>
        <Field label="Limite (R$)"><input inputMode="decimal" value={f.limit} onChange={set('limit')} placeholder="0,00" /></Field>
        <div className="two">
          <Field label="Dia do fechamento"><input type="number" min="1" max="31" value={f.closing_day} onChange={set('closing_day')} required /></Field>
          <Field label="Dia do vencimento"><input type="number" min="1" max="31" value={f.due_day} onChange={set('due_day')} required /></Field>
        </div>
        <p className="muted">Compras feitas no dia do fechamento ou depois entram na fatura seguinte.</p>
        {err && <p className="error">{err}</p>}
        <button className="btn">Salvar</button>
        {card && <button type="button" className="link" onClick={remove}>Excluir cartão</button>}
      </form>
    </Modal>
  );
}

function InvoiceItems({ invoiceId }) {
  const q = useLoad(() => api(`/api/transactions?invoice_id=${invoiceId}`), [invoiceId]);
  if (!q.data) return <Loading q={q} />;
  if (!q.data.length) return <p className="muted">Sem compras nesta fatura.</p>;
  return (
    <ul className="list">
      {q.data.map((t) => (
        <li key={t.id}>
          <span className="grow">
            {t.description}
            {t.installment_total > 1 && <small> {t.installment_no}/{t.installment_total}</small>}
            <br /><small className="muted">{fmtDate(t.date)}{t.category_name ? ` · ${t.category_name}` : ''}</small>
          </span>
          <b>{brl(t.amount_cents)}</b>
        </li>
      ))}
    </ul>
  );
}

export default function Cards({ month }) {
  const o = useLoad(() => api(`/api/overview?month=${month}`), [month]);
  const accounts = useLoad(() => api('/api/accounts'), []);
  const [form, setForm] = useState(null); // null | {} | card
  const [open, setOpen] = useState(null);
  const [payAcc, setPayAcc] = useState('');
  if (!o.data) return <Loading q={o} />;

  async function pay(c) {
    const account_id = payAcc || accounts.data?.[0]?.id;
    if (!account_id) return alert('Cadastre uma conta em Ajustes para pagar a fatura.');
    await api(`/api/invoices/${c.invoice_id}/pay`, { method: 'POST', body: { paid: true, account_id } });
    o.reload();
    accounts.reload();
  }
  async function unpay(c) {
    await api(`/api/invoices/${c.invoice_id}/pay`, { method: 'POST', body: { paid: false } });
    o.reload();
    accounts.reload();
  }

  return (
    <>
      <div className="row between">
        <span />
        <button className="btn" onClick={() => setForm({})}>Novo cartão</button>
      </div>
      {o.data.cards.length === 0 && <section className="panel"><p className="muted">Nenhum cartão cadastrado.</p></section>}
      {o.data.cards.map((c) => (
        <section className="panel" key={c.id}>
          <div className="row between">
            <h3>{c.name}</h3>
            <button className="link" onClick={() => setForm(c)}>Editar</button>
          </div>
          <p className="muted">
            Fecha dia {c.closing_day} · vence dia {c.due_day} · limite disponível {brl(c.available_cents)}
          </p>
          <div className="row between">
            <div>
              <small className="muted">Fatura · vence {fmtDate(c.due_date)}</small>
              <p className="big sm">{brl(c.total_cents)}</p>
            </div>
            <span className={`badge ${c.paid_at ? 'ok' : ''}`}>{c.paid_at ? 'Paga' : 'Aberta'}</span>
          </div>
          {c.invoice_id && (
            <div className="row gap">
              <button className="link" onClick={() => setOpen(open === c.id ? null : c.id)}>
                {open === c.id ? 'Ocultar compras' : 'Ver compras'}
              </button>
              {c.paid_at ? (
                <button className="link" onClick={() => unpay(c)}>Desfazer pagamento</button>
              ) : (
                <>
                  <select value={payAcc} onChange={(e) => setPayAcc(e.target.value)} aria-label="Conta do pagamento">
                    {accounts.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <button className="btn sm" onClick={() => pay(c)}>Pagar fatura</button>
                </>
              )}
            </div>
          )}
          {open === c.id && c.invoice_id && <InvoiceItems invoiceId={c.invoice_id} />}
        </section>
      ))}
      {form && <CardForm card={form.id ? form : null} onClose={() => setForm(null)} onSaved={() => { setForm(null); o.reload(); }} />}
    </>
  );
}
