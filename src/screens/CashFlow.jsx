import { useEffect, useState } from 'react';
import { req, brl } from '../lib/req.js';

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const label = (m) => `${MES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const card = { background: 'var(--card, rgba(127,127,127,.08))', borderRadius: 16, padding: 16 };

export default function CashFlow() {
  const [n, setN] = useState(6);
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    setD(null);
    req('GET', `/api/cashflow?months=${n}`).then(setD).catch((e) => setErr(e.message));
  }, [n]);

  if (err) return <div style={{ color: '#ef4444' }}>{err}</div>;
  if (!d) return <p>Carregando…</p>;

  const vals = d.months.map((m) => m.closing_cents);
  const max = Math.max(1, ...vals.map(Math.abs));
  const low = d.months.reduce((a, b) => (b.closing_cents < a.closing_cents ? b : a));

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Fluxo de caixa</h2>
        <select value={n} onChange={(e) => setN(Number(e.target.value))}
          style={{ padding: 8, borderRadius: 8, background: 'transparent', color: 'inherit', border: '1px solid rgba(127,127,127,.35)' }}>
          {[3, 6, 12, 24].map((k) => <option key={k} value={k}>{k} meses</option>)}
        </select>
      </div>

      <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><small style={{ opacity: .7 }}>Saldo atual nas contas</small><div style={{ fontSize: 22, fontWeight: 700 }}>{brl(d.opening_cents)}</div></div>
        <div><small style={{ opacity: .7 }}>Menor saldo previsto</small>
          <div style={{ fontSize: 22, fontWeight: 700, color: low.closing_cents < 0 ? '#ef4444' : undefined }}>
            {brl(low.closing_cents)} <small style={{ opacity: .7, fontWeight: 400 }}>({label(low.month)})</small>
          </div>
        </div>
      </div>

      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 6, height: 160, overflowX: 'auto' }}>
        {d.months.map((m) => {
          const h = Math.max(4, Math.round((Math.abs(m.closing_cents) / max) * 60));
          const neg = m.closing_cents < 0;
          return (
            <div key={m.month} style={{ flex: 1, minWidth: 36, textAlign: 'center' }}>
              <div style={{ height: 64, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                {!neg && <div style={{ width: '60%', height: h, background: '#10b981', borderRadius: 6 }} />}
              </div>
              <div style={{ borderTop: '1px solid rgba(127,127,127,.4)' }} />
              <div style={{ height: 64, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
                {neg && <div style={{ width: '60%', height: h, background: '#ef4444', borderRadius: 6 }} />}
              </div>
              <small style={{ opacity: .7 }}>{label(m.month)}</small>
            </div>
          );
        })}
      </div>

      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ textAlign: 'right', opacity: .7 }}>
              {['Mês', 'Salário', 'Receitas', 'Despesas', 'Faturas', 'Saldo do mês', 'Saldo final'].map((h, i) => (
                <th key={h} style={{ padding: '6px 8px', textAlign: i ? 'right' : 'left', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.months.map((m) => (
              <tr key={m.month} style={{ borderTop: '1px solid rgba(127,127,127,.2)', textAlign: 'right' }}>
                <td style={{ padding: '6px 8px', textAlign: 'left' }}>{label(m.month)}</td>
                <td style={{ padding: '6px 8px' }}>{brl(m.salary_cents)}</td>
                <td style={{ padding: '6px 8px' }}>{brl(m.income_cents)}</td>
                <td style={{ padding: '6px 8px' }}>{brl(m.expense_cents)}</td>
                <td style={{ padding: '6px 8px' }}>{brl(m.invoices_cents)}</td>
                <td style={{ padding: '6px 8px', color: m.net_cents < 0 ? '#ef4444' : undefined }}>{brl(m.net_cents)}</td>
                <td style={{ padding: '6px 8px', fontWeight: 700, color: m.closing_cents < 0 ? '#ef4444' : undefined }}>{brl(m.closing_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <small style={{ opacity: .7 }}>Projeção com itens ainda não pagos; faturas entram no mês do vencimento.</small>
      </div>
    </div>
  );
}
