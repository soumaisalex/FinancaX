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
