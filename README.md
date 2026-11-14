# Finanças

React + Vite · Cloudflare Pages (Functions) · Neon Postgres · login Google.

## Setup
1. Neon: crie o projeto e copie a connection string.
2. Google Cloud Console → APIs e serviços → Credenciais → ID do cliente OAuth (Aplicativo da Web).
   - URIs de redirecionamento: `http://localhost:8788/api/auth/google/callback` e `https://SEU-DOMINIO/api/auth/google/callback`
   - Tela de consentimento: publique em **Produção** (escopos: openid, email, profile).
3. `cp .dev.vars.example .dev.vars` e preencha (`SESSION_SECRET`: `openssl rand -base64 32`).
4. `npm install && npm run migrate && npm run dev` → abra http://localhost:8788
5. Deploy: repositório no GitHub → Cloudflare Pages (build `npm run build`, saída `dist`).
   Em Settings → Variables and Secrets, defina as 4 variáveis de `.dev.vars`.

## Regras
- Valores em centavos (inteiro).
- `functions/api/_middleware.js` valida a sessão e injeta `data.userId`. Toda query de domínio deve filtrar por `user_id = data.userId`; nunca aceitar `user_id` do body.

## Cadastro próprio (email + senha)
- Rode `npm run migrate` (aplica `002_password_auth.sql`).
- Hash PBKDF2-SHA256 (100k iterações, limite do Workers). Se aparecer erro 1102 (CPU) no plano gratuito, reduza com a variável opcional `PBKDF2_ITER` (ex.: 50000); hashes antigos continuam válidos.
- Limite de tentativas: 5 falhas por email / 30 por IP a cada 15 min; cadastro: 10 por IP.
- Sem verificação de email nem "esqueci a senha" por enquanto (exigem envio de email). Se o mesmo email entrar depois pelo Google, a conta é vinculada, a senha não verificada é removida e sessões antigas caem.

## Fase 2
- `npm run migrate` aplica `003_recurrence_unique.sql`.
- Fatura: compra no dia do fechamento (ou depois) cai na fatura seguinte; vencimento no mesmo mês se `due_day > closing_day`, senão no mês seguinte.
- Parcelas: o valor total é dividido (centavos sobrando vão na 1ª) e cada parcela cai no mês/fatura seguinte.
- Recorrências são geradas ao abrir o mês (sem cron).
- Saldo previsto = salário + receitas − despesas em conta − faturas do mês.
