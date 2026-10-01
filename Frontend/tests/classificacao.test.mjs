// Classificação por palavras-chave (modo sem IA) com frases de vida e de trabalho.
// `node --test "Frontend/tests/*.test.mjs"`
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.location = { hostname: 'localhost' };
globalThis.window = { addEventListener() {} };

const { guessCategory, getCategory } = await import('../js/categories.js');
const { decomposeTask } = await import('../js/api.js');

// [frase, categoria esperada]
const TRABALHO = [
  ['Reunião com o cliente sexta às 10h', 'reunioes'],
  ['Call de alinhamento com o time amanhã', 'reunioes'],
  ['1:1 com a gerente na quinta', 'reunioes'],
  ['Apresentação do projeto para a diretoria', 'reunioes'],
  ['Atualizar o currículo e o LinkedIn', 'carreira'],
  ['Entrevista de emprego na segunda', 'carreira'],
  ['Pedir aumento ao chefe', 'carreira'],
  ['Estudar para a prova de certificação', 'estudos'],
  ['Curso de inglês toda terça', 'estudos'],
  ['Entregar o TCC até dia 20', 'estudos'],
  ['Enviar o relatório mensal ao cliente', 'trabalho'],
  ['Responder e-mails pendentes', 'trabalho'],
  ['Fechar a proposta comercial', 'trabalho'],
  ['Revisar o contrato antes do prazo', 'trabalho'],
  ['Subir o deploy da sprint', 'trabalho'],
];
const VIDA = [
  ['Pagar o boleto do aluguel', 'financas'],
  ['Declarar o imposto de renda', 'financas'],
  ['Pagar a fatura do cartão', 'financas'],
  ['Consulta com o dentista dia 15', 'saude'],
  ['Marcar exame de sangue', 'saude'],
  ['Treino na academia às 7h', 'saude'],
  ['Reunião de pais na escola', 'familia'],
  ['Aniversário da minha mãe', 'familia'],
  ['Buscar as crianças na creche', 'familia'],
  ['Comprar pão e leite no mercado', 'casa'],
  ['Consertar a torneira da cozinha', 'casa'],
  ['Fazer a faxina do apartamento', 'casa'],
  ['Jantar com amigos no sábado', 'pessoal'],
  ['Planejar a viagem de férias', 'pessoal'],
  ['Ir ao cinema com a namorada', 'pessoal'],
];

describe('palpite de categoria (sem IA)', () => {
  it('acerta o grupo (trabalho / vida) em 100% das 30 frases', () => {
    for (const [frase] of TRABALHO) assert.equal(getCategory(guessCategory(frase)).group, 'trabalho', frase);
    for (const [frase] of VIDA) assert.equal(getCategory(guessCategory(frase)).group, 'vida', frase);
  });

  it('acerta a categoria exata em pelo menos 90% das frases', () => {
    const todas = [...TRABALHO, ...VIDA];
    const erros = todas.filter(([f, esperada]) => guessCategory(f) !== esperada)
      .map(([f, e]) => `${f} -> ${guessCategory(f)} (esperava ${e})`);
    const taxa = (todas.length - erros.length) / todas.length;
    assert.ok(taxa >= 0.9, `acerto ${(taxa * 100).toFixed(0)}%: ${erros.join(' | ')}`);
  });

  it('ignora acento e caixa; "aprovação" não vira prova', () => {
    assert.equal(guessCategory('REUNIÃO COM O CLIENTE'), 'reunioes');
    assert.equal(guessCategory('Pedir aprovação do orçamento'), 'casa');
  });

  it('sem nenhuma pista, usa a padrão', () => {
    assert.equal(guessCategory('algo qualquer'), 'casa');
    assert.equal(guessCategory(''), 'casa');
  });
});

describe('decomposeTask — sugestões de trabalho', () => {
  it('reunião: pauta, convite e ata, com lembrete na véspera', () => {
    const r = decomposeTask('Reunião com o cliente amanhã às 10h');
    assert.equal(r.category, 'reunioes');
    assert.deepEqual(r.subtasks, ['Preparar a pauta', 'Enviar o convite', 'Registrar a ata depois']);
    assert.equal(r.suggestion.action.category, 'reunioes');
    assert.ok(r.suggestion.action.dueDate, 'a véspera vira data estruturada');
  });

  it('entrega: revisar, pedir aprovação, enviar', () => {
    const r = decomposeTask('Entregar o relatório na sexta');
    assert.equal(r.category, 'trabalho');
    assert.deepEqual(r.subtasks, ['Revisar o material', 'Pedir aprovação', 'Enviar']);
  });

  it('as sugestões de vida continuam funcionando', () => {
    const r = decomposeTask('Consulta com o dentista dia 15');
    assert.equal(r.category, 'saude');
    assert.equal(r.suggestion.action.category, 'saude');
  });
});
