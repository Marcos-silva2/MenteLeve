// Mensagens de erro (ui.friendlyError) e classificação dos erros de rede (api.js):
// `node --test "Frontend/tests/*.test.mjs"`. Cada tipo de falha precisa de uma
// frase própria — conexão, servidor, autenticação e validação.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

globalThis.location = { hostname: 'localhost' };
globalThis.window = { addEventListener() {} };

const api = await import('../js/api.js');
const { friendlyError } = await import('../js/ui.js');

const status = (n, retryAfter = null) => new api.ApiError(n, retryAfter);
const health = { ok: true, status: 200, json: async () => ({}) };

describe('classificação dos erros (api.js)', () => {
  it('falha do fetch na chamada vira NetworkError', async () => {
    // /health responde (o app se considera online); a chamada em si cai.
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/health')) return health;
      throw new TypeError('Failed to fetch');
    };
    await assert.rejects(api.apiLogin('a@b.c', 'senha123'), (e) => e instanceof api.NetworkError && e.kind === 'network');
  });

  it('resposta 4xx/5xx vira ApiError com status e Retry-After', async () => {
    globalThis.fetch = async (url) => (
      String(url).endsWith('/health')
        ? health
        : { ok: false, status: 429, headers: { get: (h) => (h === 'Retry-After' ? '120' : null) }, json: async () => ({}) }
    );
    await assert.rejects(api.apiLogin('a@b.c', 'senha123'), (e) => e instanceof api.ApiError && e.status === 429 && e.retryAfter === 120);
  });

  it('401 no login vira AuthError (credencial errada, não sessão expirada)', async () => {
    globalThis.fetch = async (url) => (
      String(url).endsWith('/health')
        ? health
        : { ok: false, status: 401, headers: { get: () => null }, json: async () => ({}) }
    );
    await assert.rejects(api.apiLogin('a@b.c', 'errada'), (e) => e instanceof api.AuthError && e.status === 401);
  });

  it('5xx é do tipo servidor; 4xx, cliente', () => {
    assert.equal(status(503).kind, 'server');
    assert.equal(status(422).kind, 'client');
  });
});

describe('friendlyError — uma frase por tipo de falha', () => {
  const frases = {
    conexao: friendlyError(new api.NetworkError()),
    conexaoAuth: friendlyError(new api.NetworkError(), 'auth'),
    servidor: friendlyError(status(503)),
    sessao: friendlyError(new api.AuthError()),
    senhaErrada: friendlyError(new api.AuthError(), 'auth'),
    validacao: friendlyError(status(422)),
    tentativas: friendlyError(status(429)),
  };

  it('são todas diferentes entre si (a usuária sabe o que fazer em cada uma)', () => {
    assert.equal(new Set(Object.values(frases)).size, Object.keys(frases).length);
  });

  it('conexão tranquiliza: nada se perde', () => {
    assert.match(frases.conexao, /salvas/);
  });

  it('servidor indisponível não culpa a usuária', () => {
    assert.match(frases.servidor, /indisponível/);
    assert.doesNotMatch(frases.servidor, /você (errou|digitou)/i);
  });

  it('401 no login pede para conferir os dados', () => {
    assert.match(frases.senhaErrada, /não conferem/);
  });

  it('429 informa a espera em minutos quando o servidor diz', () => {
    assert.match(friendlyError(status(429, 600)), /10 min/);
    assert.match(friendlyError(status(429, 30)), /1 min/);
  });

  it('nunca repassa texto do servidor (vai para innerHTML)', () => {
    const e = status(422);
    e.detail = '<img src=x onerror=alert(1)>';
    assert.doesNotMatch(friendlyError(e), /</);
  });

  it('erro desconhecido cai numa frase genérica e gentil', () => {
    assert.match(friendlyError(new Error('boom')), /Tente de novo/);
    assert.match(friendlyError(undefined), /Tente de novo/);
  });
});
