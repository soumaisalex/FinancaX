import { useState } from 'react';
import { api, brl } from '../api.js';
import { Loading, Seg, useLoad } from '../ui.jsx';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const label = (m) => `${MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const short = (c) => (c / 100).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const td = { padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' };

export default function CashFlow() {
  const [n, setN] = useState(6);
  const q = useLoad(() => api(`/api/cashflow?months=${n}`), [n]);
  if (!q.data) return <Loading q={q} />;
  const { opening_cents, months } = q.data;
  const max = Math.max(1, ...months.map((m) => Math.abs(m.closing_cents)));
  const low = months.reduce((a, b) => (b.closing_cents < a.closing_cents ? b : a));

  return (
    <>
      <section className="panel">
        <div className="row between">
          <h3>Projeção de saldo</h3>
          <Seg value={n} onChange={setN} options={[[3, '3m'], [6, '6m'], [12, '12m'], [24, '24m']]} />
        </div>
        <div className="legend3">
          <div><small>Saldo atual nas contas</small><b>{brl(opening_cents)}</b></div>
          <div>
            <small>Menor saldo previsto ({label(low.month)})</small>
            <b className={low.closing_cents < 0 ? 'neg' : ''}>{brl(low.closing_cents)}</b>
          </div>
          <div><small>Saldo em {label(months[months.length - 1].month)}</small><b>{brl(months[months.length - 1].closing_cents)}</b></div>
        </div>
        <div className="hist">
          {months.map((m, i) => (
            <div className="hcol" key={m.month}>
              <span className="hval">{short(m.closing_cents)}</span>
              <div className="hbar">
                <i style={{ height: Math.max(4, Math.round((Math.abs(m.closing_cents) / max) * 120)), background: m.closing_cents < 0 ? 'var(--danger)' : 'var(--pos)' }} />
              </div>
              <span className={`hm ${i === 0 ? 'now' : ''}`}>{label(m.month)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr className="muted">
              {['Mês', 'Salário', 'Receitas', 'Despesas', 'Faturas', 'Saldo do mês', 'Saldo final'].map((h, i) => (
                <th key={h} style={{ ...td, textAlign: i ? 'right' : 'left', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ ...td, textAlign: 'left' }}>{label(m.month)}</td>
                <td style={td}>{brl(m.salary_cents)}</td>
                <td style={td}>{brl(m.income_cents)}</td>
                <td style={td}>{brl(m.expense_cents)}</td>
                <td style={td}>{brl(m.invoices_cents)}</td>
                <td style={td} className={m.net_cents < 0 ? 'neg' : ''}>{brl(m.net_cents)}</td>
                <td style={td}><b className={m.closing_cents < 0 ? 'neg' : ''}>{brl(m.closing_cents)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="sub">Considera só o que ainda não foi pago (atrasados entram no mês atual). Faturas entram no mês do vencimento.</p>
      </section>
    </>
  );
}
