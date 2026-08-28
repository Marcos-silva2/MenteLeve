# MenteLeve — Frontend (PWA)

App de gestão de carga mental. Frontend em **HTML/CSS/JS Vanilla + Tailwind (CDN)**, sem build, instalável como PWA.

## Como rodar

O app usa ES Modules e Service Worker, então precisa ser servido por HTTP (não abrir o `index.html` direto via `file://`).

```bash
# dentro da pasta Frontend
python -m http.server 5500
```

Depois acesse **http://127.0.0.1:5500** no navegador (ative o modo dispositivo móvel no DevTools para a experiência completa).

`API_BASE` (em `js/api.js`) detecta o ambiente sozinho: `localhost` em dev, Render em produção.

## Estrutura

```
Frontend/
├── index.html              # shell + config do Tailwind (cores Bordeaux Pink)
├── manifest.json           # PWA
├── sw.js                   # service worker (precache + cache offline)
├── assets/                 # ilustrações (WebP) + ícones do PWA (PNG)
├── css/styles.css          # tokens, layout responsivo, animações
└── js/
    ├── app.js              # bootstrap + mini-router (deep-link por hash)
    ├── store.js            # estado + localStorage + sincronização
    ├── api.js              # cliente REST (JWT) + heurística local de fallback
    ├── dates.js            # prazo estruturado: resolução e exibição de datas
    ├── sound.js            # feedback sonoro sintetizado (Web Audio)
    ├── ui.js               # helpers: DOM, ícones SVG, toast, navbar
    ├── components/
    │   └── taskSheet.js    # Bottom Sheet de nova tarefa + modal "Aha Moment" da IA
    └── views/
        ├── onboarding.js   # carrossel de 3 slides
        ├── login.js        # entrar (e-mail + senha)
        ├── register.js     # criar conta
        ├── home.js         # dashboard "Minha Mente"
        ├── agenda.js       # calendário mensal + ciclo menstrual (local)
        ├── chat.js         # Bruna (IA)
        ├── connections.js  # rede de apoio (estático)
        ├── paywall.js      # premium (assinatura simulada)
        └── profile.js      # perfil / conta
```

## Autenticação

E-mail + senha, com token **JWT**. O token fica no `localStorage` e vai em
`Authorization: Bearer` a cada chamada. No boot, `store.restoreSession()` revalida o
token em `/auth/me`; se o backend responder **401**, a sessão é limpa e o app volta
para o login (ver `api.onSessionExpired`).

## Datas das tarefas

O prazo é **estruturado**: `dueDate` (`AAAA-MM-DD`) + `dueTime` (`HH:MM`). O texto
amigável ("Hoje", "Amanhã • 10:00") é **derivado na exibição** por `dates.js::formatDue`
— nunca armazenado.

> Guardar o rótulo criava duas fontes de verdade: uma tarefa salva como "Amanhã"
> continuava exibindo "Amanhã" para sempre e **andava um dia no calendário a cada dia
> que passava**, sem nunca ficar atrasada. O campo `due` (texto livre) só permanece
> como fallback de exibição para tarefas criadas antes dessa mudança.

Cuidado ao mexer: `new Date('2026-08-27')` é interpretado como meia-noite **UTC** e
volta um dia no Brasil. Use `dates.js::dateFromKey` / `keyOf`, nunca o construtor direto.

## Modo offline

O app é *local-first*. Sem backend, `store.login()` entra em modo local com tarefas de
demonstração, e `dates.js::resolveDue` resolve as datas no próprio cliente — senão quem
está sem conexão não veria as tarefas no calendário (não existe fila de sincronização).

Ao sincronizar, o store faz **upsert por id** (`store.upsertTasks`), nunca substitui a
lista inteira: isso apagaria tarefas criadas offline e rebaixaria a prioridade, que o
backend não persiste.

## Som

`js/sound.js` **sintetiza** os sons pela Web Audio API — não há arquivos de áudio.
Motivo: o precache do PWA é enxuto (~125 KB); anexar `.mp3` andaria para trás.
Sintetizar custa zero byte e não pode dar 404 no modo offline.

O `AudioContext` nasce suspenso até um gesto da usuária (política de autoplay), então é
criado preguiçosamente e retomado com `resume()`. **Falha de áudio nunca pode derrubar
a ação que o disparou** — tudo é tolerante a erro.

Ligado por padrão; desligável no Perfil. A preferência (`soundEnabled`) é do **aparelho**,
não da conta: sobrevive ao logout, assim como os dados do ciclo.

## Imagens

Ilustrações e logo em **WebP**, dimensionadas para o tamanho real de exibição. Os ícones
do `manifest.json` continuam **PNG** (compatibilidade entre plataformas).

O `icon-512.png` está **fora do precache** do Service Worker de propósito — só o manifest
o usa, na instalação. Ao adicionar um arquivo novo, lembre de incluí-lo em `ASSETS`
(`sw.js`) **e incrementar o `CACHE`**, senão o modo offline fica sem ele.

## Notas

- Login social (Apple/Google) está **desabilitado** com aviso "em breve" — não há OAuth real.
- Conexões e Paywall têm visual completo, mas as ações são simuladas.
- O **calendário menstrual é 100% local** (`localStorage`), nunca vai ao backend — e
  sobrevive à expiração da sessão, por não pertencer à conta.
- Estado persiste em `localStorage` (chave `menteleve.state.v1`).
- No **servidor**, o título das tarefas é criptografado (AES-256-GCM). No **aparelho**
  ele fica em texto puro no `localStorage` — é o que faz o modo offline funcionar. A
  criptografia protege o banco, não o dispositivo de quem já está com a sessão aberta.
  Por isso `store.clearSession()` limpa as tarefas ao sair da conta.
