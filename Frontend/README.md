# MenteLeve — Frontend (PWA)

App de gestão de carga mental. Frontend em **HTML/CSS/JS Vanilla + Tailwind (CDN)**, sem build, instalável como PWA.

## Como rodar

O app usa ES Modules e Service Worker, então precisa ser servido por HTTP (não abrir o `index.html` direto via `file://`).

```bash
# dentro da pasta Frontend
python -m http.server 5500
```

Depois acesse **http://127.0.0.1:5500** no navegador (ative o modo dispositivo móvel no DevTools para a experiência completa).

## Estrutura

```
Frontend/
├── index.html              # shell + config do Tailwind (cores Bordeaux Pink)
├── manifest.json           # PWA
├── sw.js                   # service worker (cache offline)
├── assets/                 # ícones do PWA
├── css/styles.css          # tokens, animações, moldura de device
└── js/
    ├── app.js              # bootstrap + mini-router (deep-link por hash)
    ├── store.js            # estado + localStorage + dados de exemplo
    ├── api.js              # comunicação com o backend (mock de IA enquanto não há backend)
    ├── ui.js               # helpers: DOM, ícones SVG, toast, navbar
    ├── components/
    │   └── taskSheet.js    # Bottom Sheet de nova tarefa + modal "Aha Moment" da IA
    └── views/
        ├── onboarding.js   # Tela 1 — carrossel 3 slides
        ├── login.js        # Tela 2 — autenticação (MVP: email no localStorage)
        ├── home.js         # Tela 3 — dashboard "Minha Mente"
        ├── agenda.js       # Tela 5 — calendário + timeline
        ├── connections.js  # Tela 6 — rede de apoio (estático)
        ├── paywall.js      # Tela 7 — premium (assinatura simulada)
        └── profile.js      # perfil / conta
```

## Integração com o backend

Em `js/api.js`, ajuste `API_BASE` para a URL do backend (local: `http://localhost:8000`; produção: URL do Render).
Enquanto o backend não responde em `/health`, a quebra de tarefas pela IA usa um **mock local** (heurística por palavra-chave), para o frontend funcionar de forma independente.

Endpoints esperados do backend:
- `GET  /health` — ping
- `POST /tasks/smart` — recebe `{ text }`, retorna `{ title, category, due, subtasks, suggestion }`

## Notas do MVP
- Login social (Apple/Google) é **simulado** — sem OAuth real ainda.
- Conexões e Paywall têm visual completo, mas as ações são simuladas (toast/assinatura fake).
- Estado persiste em `localStorage` (chave `menteleve.state.v1`).
