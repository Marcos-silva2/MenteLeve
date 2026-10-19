/* ============================================================
   knowledge.js — Conteúdo da aba Conhecimento
   Textos curtos, escritos para o app, sobre saúde mental, gestão de tempo e
   agenda. Cada artigo cita as fontes de onde vêm os dados (estudos revisados
   por pares e documentos da OMS/OIT/ONU). Só dados que as fontes sustentam.
   Conteúdo estático: nada aqui vem de usuário, mas a view escapa mesmo assim.
   ============================================================ */

export const TOPICS = [
  { id: 'mente', label: 'Saúde mental' },
  { id: 'tempo', label: 'Gestão de tempo' },
  { id: 'agenda', label: 'Agenda e vida' },
];

export const ARTICLES = [
  {
    id: 'burnout',
    topic: 'mente',
    emoji: '🔥',
    title: 'Burnout não é frescura: é um fenômeno do trabalho',
    summary: 'Desde 2022 a OMS descreve o burnout na CID-11 como resultado de estresse crônico no trabalho que não foi bem gerenciado.',
    minutes: 3,
    body: [
      'A Organização Mundial da Saúde incluiu o burnout na 11ª revisão da Classificação Internacional de Doenças (CID-11, código QD85), em vigor desde janeiro de 2022. Ele não é classificado como doença, e sim como um fenômeno ocupacional: algo que nasce do contexto de trabalho.',
      'A definição tem três dimensões: sensação de esgotamento de energia; distanciamento mental do trabalho, com negativismo ou cinismo; e queda da eficácia profissional. Ou seja, não é só "cansaço" — é a combinação de exaustão, desligamento e a impressão de que nada do que se faz rende.',
      'O ponto central da definição é a palavra "gerenciado": o burnout aparece quando o estresse é crônico e não há recuperação suficiente. Por isso, a prevenção passa tanto pela organização (carga, prazos, apoio) quanto pelos hábitos de quem trabalha — pausas, limites de horário e descanso de verdade.',
    ],
    practice: 'Observe a sua semana no cartão "Equilíbrio" da Home. Semanas seguidas com quase tudo em Trabalho são um sinal para reservar blocos de descanso na agenda, como se fossem compromissos.',
    sources: [
      { label: 'OMS — Burn-out an "occupational phenomenon": International Classification of Diseases (2019)', url: 'https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases' },
      { label: 'OMS — CID-11 (Classificação Internacional de Doenças, 11ª revisão), código QD85', url: 'https://icd.who.int/' },
      { label: 'Maslach, C.; Leiter, M. P. (2016). Understanding the burnout experience. World Psychiatry, 15(2), 103–111.', url: 'https://doi.org/10.1002/wps.20311' },
    ],
  },
  {
    id: 'trabalho-saude-mental',
    topic: 'mente',
    emoji: '🌍',
    title: 'Saúde mental no trabalho: o tamanho do problema',
    summary: 'A OMS estima 12 bilhões de dias de trabalho perdidos por ano por depressão e ansiedade.',
    minutes: 3,
    body: [
      'Em 2022, a OMS e a Organização Internacional do Trabalho (OIT) publicaram diretrizes sobre saúde mental no trabalho. Segundo esses documentos, cerca de 12 bilhões de dias de trabalho são perdidos todos os anos no mundo por depressão e ansiedade, com custo estimado de quase 1 trilhão de dólares em produtividade.',
      'As diretrizes apontam como riscos psicossociais a carga excessiva, jornadas longas e inflexíveis, falta de controle sobre o próprio trabalho e a falta de limites claros entre trabalho e vida pessoal.',
      'A saúde mental também está na Agenda 2030 da ONU: o Objetivo de Desenvolvimento Sustentável 3 (Saúde e Bem-Estar) inclui a meta 3.4, de promover a saúde mental e o bem-estar.',
    ],
    practice: 'Ter controle sobre o próprio tempo é um fator de proteção. Separar o que é Trabalho e o que é Pessoal na agenda ajuda a ver — e defender — o espaço da vida fora do expediente.',
    sources: [
      { label: 'OMS (2022). WHO guidelines on mental health at work.', url: 'https://www.who.int/publications/i/item/9789240053052' },
      { label: 'OMS/OIT (2022). Mental health at work: policy brief.', url: 'https://www.who.int/publications/i/item/9789240057944' },
      { label: 'ONU Brasil — Objetivo 3: Saúde e Bem-Estar', url: 'https://brasil.un.org/pt-br/sdgs/3' },
    ],
  },
  {
    id: 'jornadas-longas',
    topic: 'agenda',
    emoji: '⏳',
    title: 'Jornadas longas fazem mal ao coração',
    summary: 'Trabalhar 55 horas ou mais por semana está associado a maior risco de AVC e de doença cardíaca, segundo a OMS e a OIT.',
    minutes: 3,
    body: [
      'Um estudo conjunto da OMS e da OIT, publicado em 2021 na revista Environment International, estimou que jornadas longas causaram cerca de 745 mil mortes por AVC e doença isquêmica do coração em 2016 — um aumento de 29% em relação a 2000.',
      'Comparado a quem trabalha de 35 a 40 horas semanais, trabalhar 55 horas ou mais foi associado a um risco estimado 35% maior de AVC e 17% maior de morrer por doença isquêmica do coração.',
      'Os caminhos são tanto biológicos (estresse crônico) quanto comportamentais: menos sono, menos atividade física, alimentação pior. As horas extras "só desta semana" tendem a virar rotina quando não aparecem em lugar nenhum.',
    ],
    practice: 'Defina o horário de término do expediente na agenda. Se uma tarefa de trabalho cair depois dele com frequência, é um dado concreto para negociar prazos — não uma falha sua.',
    sources: [
      { label: 'Pega, F. et al. (2021). Global, regional, and national burdens of ischemic heart disease and stroke attributable to exposure to long working hours… Environment International, 154, 106595.', url: 'https://doi.org/10.1016/j.envint.2021.106595' },
      { label: 'OMS/OIT (2021). Long working hours increasing deaths from heart disease and stroke.', url: 'https://www.who.int/news/item/17-05-2021-long-working-hours-increasing-deaths-from-heart-disease-and-stroke-who-ilo' },
    ],
  },
  {
    id: 'gestao-tempo-funciona',
    topic: 'tempo',
    emoji: '🧭',
    title: 'Gestão de tempo funciona — e mais para o bem-estar',
    summary: 'Uma meta-análise com 158 estudos achou que gestão de tempo melhora o bem-estar mais do que o desempenho.',
    minutes: 3,
    body: [
      'Em 2021, Aeon, Faber e Panaccio reuniram 158 estudos (mais de 53 mil participantes) numa meta-análise publicada na PLOS ONE. A conclusão: gestão de tempo tem relação positiva e moderada com desempenho no trabalho, nos estudos e com o bem-estar.',
      'O resultado que mais chama atenção é que a relação com o bem-estar — satisfação com a vida, menos ansiedade e estresse — foi mais forte do que com o desempenho. Organizar o tempo parece servir, antes de tudo, para viver melhor.',
      'Os autores também notam que a associação ficou mais forte nos estudos mais recentes, numa época em que o trabalho é menos estruturado e cada pessoa precisa montar a própria rotina.',
    ],
    practice: 'O objetivo da agenda não é encaixar mais coisas no dia, e sim saber o que importa e quando. Marque como importantes só as tarefas que realmente são.',
    sources: [
      { label: 'Aeon, B.; Faber, A.; Panaccio, A. (2021). Does time management work? A meta-analysis. PLOS ONE, 16(1), e0245066.', url: 'https://doi.org/10.1371/journal.pone.0245066' },
    ],
  },
  {
    id: 'anotar-alivia',
    topic: 'tempo',
    emoji: '📝',
    title: 'Anotar alivia a cabeça (de verdade)',
    summary: 'Tarefas pendentes ficam "martelando" na mente — e fazer um plano concreto basta para reduzir esse efeito.',
    minutes: 3,
    body: [
      'O chamado efeito Zeigarnik descreve que lembramos mais de tarefas interrompidas ou inacabadas do que das concluídas. Na prática, é o que acontece quando uma pendência volta à cabeça na hora de dormir.',
      'Masicampo e Baumeister (2011) mostraram que não é preciso terminar a tarefa para acalmar a mente: em seus experimentos, os participantes que fizeram um plano específico de quando e como realizá-la deixaram de ter pensamentos intrusivos sobre ela e se saíram melhor em outras atividades.',
      'É a ideia por trás de "esvaziar a cabeça" num sistema confiável: o cérebro só solta a pendência quando sabe que ela está guardada em algum lugar e tem um próximo passo.',
    ],
    practice: 'Quando algo vier à cabeça, registre na hora — pela Bruna ou pelo botão +. Colocar data e horário é o "plano específico" que o estudo descreve.',
    sources: [
      { label: 'Masicampo, E. J.; Baumeister, R. F. (2011). Consider it done! Plan making can eliminate the cognitive effects of unfulfilled goals. Journal of Personality and Social Psychology, 101(4), 667–683.', url: 'https://doi.org/10.1037/a0024192' },
      { label: 'Scullin, M. K. et al. (2018). The effects of bedtime writing on difficulty falling asleep. Journal of Experimental Psychology: General, 147(1), 139–146.', url: 'https://doi.org/10.1037/xge0000374' },
    ],
  },
  {
    id: 'quando-onde',
    topic: 'tempo',
    emoji: '🎯',
    title: '"Quando e onde": o truque que faz planos saírem do papel',
    summary: 'Definir quando e onde você vai fazer algo aumenta bastante a chance de fazer — é a "intenção de implementação".',
    minutes: 2,
    body: [
      'Intenções de implementação são planos no formato "quando a situação X acontecer, eu vou fazer Y". O psicólogo Peter Gollwitzer estudou esse formato por décadas.',
      'Uma meta-análise de Gollwitzer e Sheeran (2006), com 94 estudos e mais de 8 mil participantes, encontrou um efeito de tamanho médio a grande (d = 0,65) sobre o alcance de metas, em comparação a apenas ter a intenção ("quero fazer").',
      'O motivo: a decisão já foi tomada antes. Quando o momento chega, não é preciso negociar consigo mesmo — a situação vira o gatilho.',
    ],
    practice: 'Em vez de "fazer exercício", crie "Caminhada — terça, 7h". Tarefas com data e horário viram lembretes no momento certo.',
    sources: [
      { label: 'Gollwitzer, P. M.; Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. Advances in Experimental Social Psychology, 38, 69–119.', url: 'https://doi.org/10.1016/S0065-2601(06)38002-1' },
    ],
  },
  {
    id: 'falacia-planejamento',
    topic: 'tempo',
    emoji: '📏',
    title: 'Por que tudo demora mais do que o previsto',
    summary: 'A "falácia do planejamento": subestimamos o tempo das nossas tarefas mesmo sabendo que já atrasamos antes.',
    minutes: 2,
    body: [
      'Kahneman e Tversky chamaram de falácia do planejamento a tendência de subestimar quanto tempo uma tarefa vai levar. Buehler, Griffin e Ross (1994) testaram isso com estudantes: a maioria entregou o trabalho de conclusão depois da própria estimativa — inclusive da estimativa "no pior caso".',
      'O erro acontece porque imaginamos o cenário ideal da tarefa e ignoramos o histórico: as interrupções, os imprevistos, as vezes que atrasamos antes.',
      'Uma correção simples é olhar para quanto tempo tarefas parecidas levaram de fato e deixar uma margem entre um compromisso e outro.',
    ],
    practice: 'Ao criar uma tarefa, preencha o horário de término. A agenda avisa quando dois horários se sobrepõem — e um intervalo entre eles é a sua margem para o imprevisto.',
    sources: [
      { label: 'Buehler, R.; Griffin, D.; Ross, M. (1994). Exploring the "planning fallacy": Why people underestimate their task completion times. Journal of Personality and Social Psychology, 67(3), 366–381.', url: 'https://doi.org/10.1037/0022-3514.67.3.366' },
    ],
  },
  {
    id: 'interrupcoes',
    topic: 'tempo',
    emoji: '🔔',
    title: 'Interrupções: mais rápido, porém mais estressado',
    summary: 'Quem é interrompido compensa trabalhando mais rápido — ao custo de mais estresse, frustração e pressão.',
    minutes: 2,
    body: [
      'Gloria Mark e colegas, da Universidade da Califórnia em Irvine, interromperam participantes durante uma tarefa de e-mails. Surpreendentemente, eles terminaram o trabalho mais rápido do que quem não foi interrompido, sem perder qualidade.',
      'Mas o preço apareceu nas medidas de bem-estar: quem foi interrompido relatou mais estresse, frustração, pressão de tempo e esforço. Compensamos a interrupção acelerando, e o corpo paga a conta.',
      'Blocos de foco sem notificações e horários definidos para conferir mensagens reduzem as trocas de contexto.',
    ],
    practice: 'Reserve na agenda blocos de foco para o trabalho mais difícil e deixe tarefas rápidas (responder e-mails, pagar contas) agrupadas num só horário.',
    sources: [
      { label: 'Mark, G.; Gudith, D.; Klocke, U. (2008). The cost of interrupted work: More speed and stress. Proceedings of CHI 2008, 107–110. ACM.', url: 'https://doi.org/10.1145/1357054.1357072' },
    ],
  },
  {
    id: 'pausas',
    topic: 'agenda',
    emoji: '☕',
    title: 'Micropausas: 10 minutos que mudam o dia',
    summary: 'Pausas curtas durante o trabalho aumentam o vigor e reduzem a fadiga, segundo uma meta-análise de 2022.',
    minutes: 2,
    body: [
      'Albulescu e colegas (2022) reuniram 22 estudos sobre micropausas — intervalos de até 10 minutos — numa meta-análise publicada na PLOS ONE.',
      'As pausas curtas aumentaram a sensação de vigor e reduziram a fadiga de forma consistente. O efeito sobre o desempenho dependeu do tipo de tarefa: foi maior em tarefas rotineiras ou criativas do que em tarefas cognitivas muito exigentes, que pedem pausas mais longas.',
      'Ou seja, pausa não é tempo perdido: é parte do trabalho, e a duração deve combinar com o esforço da tarefa.',
    ],
    practice: 'Em dias cheios, deixe 10 a 15 minutos livres entre compromissos. Se quiser, crie a pausa como tarefa, para ela não ser engolida pelo resto.',
    sources: [
      { label: 'Albulescu, P. et al. (2022). "Give me a break!" A systematic review and meta-analysis on the efficacy of micro-breaks for increasing well-being and performance. PLOS ONE, 17(8), e0272460.', url: 'https://doi.org/10.1371/journal.pone.0272460' },
    ],
  },
  {
    id: 'desligar',
    topic: 'agenda',
    emoji: '🌙',
    title: 'Desligar do trabalho também é produtividade',
    summary: 'Desligar-se mentalmente do trabalho no tempo livre é uma das experiências de recuperação mais importantes.',
    minutes: 3,
    body: [
      'A psicóloga Sabine Sonnentag estuda como as pessoas se recuperam do trabalho. Com Charlotte Fritz (2007), ela descreveu quatro experiências de recuperação: desligamento psicológico (não pensar no trabalho), relaxamento, atividades que dão sensação de domínio (aprender algo novo, um hobby) e controle sobre o próprio tempo livre.',
      'Em diversos estudos, o desligamento psicológico se associou a menos exaustão e a mais bem-estar no dia seguinte. Não basta estar fora do escritório: o que conta é a cabeça também sair.',
      'Checar mensagens do trabalho à noite e nos fins de semana mantém a mente "ligada" e atrapalha essa recuperação.',
    ],
    practice: 'Coloque compromissos Pessoais — academia, encontro, hobby — na agenda com o mesmo peso dos de Trabalho. O que está agendado tem mais chance de acontecer.',
    sources: [
      { label: 'Sonnentag, S.; Fritz, C. (2007). The Recovery Experience Questionnaire. Journal of Occupational Health Psychology, 12(3), 204–221.', url: 'https://doi.org/10.1037/1076-8998.12.3.204' },
      { label: 'Sonnentag, S. (2012). Psychological detachment from work during leisure time: The benefits of mentally disengaging from work. Current Directions in Psychological Science, 21(2), 114–118.', url: 'https://doi.org/10.1177/0963721411434979' },
    ],
  },
  {
    id: 'sono',
    topic: 'mente',
    emoji: '😴',
    title: 'Sono: o compromisso que não dá para remarcar',
    summary: 'Adultos precisam de 7 a 9 horas por noite. Dormir menos afeta humor, atenção e saúde.',
    minutes: 2,
    body: [
      'O painel de especialistas da National Sleep Foundation (2015) recomenda de 7 a 9 horas de sono por noite para adultos de 18 a 64 anos, e de 7 a 8 horas a partir dos 65.',
      'A Academia Americana de Medicina do Sono e a Sociedade de Pesquisa do Sono chegaram a uma recomendação parecida: 7 horas ou mais, com regularidade. Dormir menos que isso com frequência se associa a pior humor, menor atenção, mais erros e mais risco de doenças crônicas.',
      'Agendas que avançam noite adentro costumam pagar a conta no sono. O horário de dormir também merece um lugar na rotina.',
    ],
    practice: 'Evite tarefas de trabalho tarde da noite. Se o dia estourou, mover a tarefa para amanhã cedo costuma render mais do que fazê-la cansado.',
    sources: [
      { label: 'Hirshkowitz, M. et al. (2015). National Sleep Foundation\'s sleep time duration recommendations. Sleep Health, 1(1), 40–43.', url: 'https://doi.org/10.1016/j.sleh.2014.12.010' },
      { label: 'Watson, N. F. et al. (2015). Recommended amount of sleep for a healthy adult: A joint consensus statement of the AASM and SRS. Sleep, 38(6), 843–844.', url: 'https://doi.org/10.5665/sleep.4716' },
    ],
  },
  {
    id: 'atividade-fisica',
    topic: 'agenda',
    emoji: '🏃',
    title: 'Movimento na agenda: 150 minutos por semana',
    summary: 'A OMS recomenda de 150 a 300 minutos de atividade moderada por semana — e atividade física reduz sintomas de depressão.',
    minutes: 2,
    body: [
      'As diretrizes da OMS de 2020 recomendam que adultos façam de 150 a 300 minutos de atividade física moderada por semana (ou 75 a 150 de atividade vigorosa), além de reduzir o tempo sentado. Qualquer quantidade é melhor que nenhuma.',
      'Os benefícios vão além do corpo. Uma grande revisão de meta-análises publicada no British Journal of Sports Medicine em 2023 concluiu que a atividade física reduz de forma significativa sintomas de depressão, ansiedade e sofrimento psicológico em adultos.',
      '150 minutos por semana são, por exemplo, 30 minutos em 5 dias — cabem melhor quando têm horário marcado.',
    ],
    practice: 'Crie uma tarefa recorrente de atividade física (ex.: "Caminhada" toda segunda, quarta e sexta) na categoria Saúde.',
    sources: [
      { label: 'OMS (2020). WHO guidelines on physical activity and sedentary behaviour.', url: 'https://www.who.int/publications/i/item/9789240015128' },
      { label: 'Singh, B. et al. (2023). Effectiveness of physical activity interventions for improving depression, anxiety and distress: an overview of systematic reviews. British Journal of Sports Medicine, 57(18), 1203–1209.', url: 'https://doi.org/10.1136/bjsports-2022-106195' },
    ],
  },
];

/** Artigos de um tema ('tudo' devolve todos). */
export function articlesByTopic(topic = 'tudo') {
  return topic === 'tudo' ? ARTICLES : ARTICLES.filter((a) => a.topic === topic);
}

export function findArticle(id) {
  return ARTICLES.find((a) => a.id === id) || null;
}
