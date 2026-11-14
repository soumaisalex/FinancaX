import { api, brl, fmtDate } from '../api.js';
import { Loading, useLoad } from '../ui.jsx';

export default function Overview({ month, go }) {
  const o = useLoad(() => api(`/api/overview?month=${month}`), [month]);
  const acc = useLoad(() => api('/api/accounts'), []);
  const d = o.data;
  if (!d) return <Loading q={o} />;

  const income = d.salary_cents + d.extra_income_cents;
  const w = (v) => `${income > 0 ? Math.max(0, Math.min(100, (v / income) * 100)) : 0}%`;
  const free = income > 0 ? Math.round((d.forecast_cents / income) * 100) : null;

  async function toggle(b) {
    await api(`/api/transactions/${b.id}`, { method: 'PATCH', body: { paid: !b.paid } });
    o.reload();
    acc.reload();
  }

  return (
    <div className="grid">
      <section className="panel wide">
        <h3>Saldo previsto</h3>
        <p className={`big ${d.forecast_cents < 0 ? 'neg' : ''}`}>{brl(d.forecast_cents)}</p>
        {free !== null && <p className="muted">{free}% da renda do mês livre depois de todas as contas e faturas</p>}
        {income === 0 && <p className="muted">Defina seu salário em Ajustes ou lance uma receita para ver o saldo.</p>}
        <div className="bar" aria-hidden="true">
          <i style={{ width: w(d.expenses_cents), background: 'var(--accent)' }} />
          <i style={{ width: w(d.invoices_cents), background: '#f59e0b' }} />
        </div>
        <dl className="sum">
          <dt>Renda (salário + receitas)</dt>
          <dd>{brl(income)}</dd>
          <dt>Contas do mês</dt>
          <dd>− {brl(d.expenses_cents)}</dd>
          <dt>Faturas de cartão</dt>
          <dd>− {brl(d.invoices_cents)}</dd>
        </dl>
      </section>

      <section className="panel">
        <h3>Contas a pagar</h3>
        <p className="muted">
          {brl(d.pending_cents)} pendentes · {d.bills.filter((b) => !b.paid).length} de {d.bills.length}
        </p>
        {d.bills.length === 0 && <p className="muted">Nenhuma conta neste mês.</p>}
        <ul className="list">
          {d.bills.map((b) => (
            <li key={b.id} className={b.paid ? 'done' : ''}>
              <input type="checkbox" checked={b.paid} onChange={() => toggle(b)} aria-label={`Pagar ${b.description}`} />
              <span className="grow">
                {b.description} <small className="muted">{fmtDate(b.date)}</small>
              </span>
              <b>{brl(b.amount_cents)}</b>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Cartões</h3>
        {d.cards.length === 0 && <p className="muted">Nenhum cartão cadastrado.</p>}
        <ul className="list">
          {d.cards.map((c) => (
            <li key={c.id}>
              <span className="grow">
                {c.name}
                <small className="muted"> vence {fmtDate(c.due_date)}</small>
              </span>
              <b>{brl(c.total_cents)}</b>
              <span className={`badge ${c.paid_at ? 'ok' : ''}`}>{c.paid_at ? 'Paga' : 'Aberta'}</span>
            </li>
          ))}
        </ul>
        <button className="link" onClick={() => go('cards')}>
          Ver faturas
        </button>
      </section>

      <section className="panel">
        <h3>Contas</h3>
        {acc.data?.length === 0 && <p className="muted">Cadastre suas contas em Ajustes.</p>}
        <ul className="list">
          {acc.data?.map((a) => (
            <li key={a.id}>
              <span className="grow">{a.name}</span>
              <b className={a.balance_cents < 0 ? 'neg' : ''}>{brl(a.balance_cents)}</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
