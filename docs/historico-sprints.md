# 🗺️ Histórico de Sprints — MenteLeve

> Resumo de **todas** as sprints registradas em `docs/`, em ordem cronológica.
> Escrito para ser entendido por quem não é da área técnica: os termos técnicos foram
> mantidos, mas explicados. Para o retrato de hoje, veja
> [`estado-atual.md`](estado-atual.md).

**O que é uma "sprint"?** Um ciclo curto de trabalho com um objetivo fechado. Em vez de
construir tudo de uma vez, o projeto avança em etapas, e cada etapa termina com algo
funcionando.

---

## A história em um parágrafo

O MenteLeve nasceu como um protótipo para provar que a ideia
funcionava. Deu certo — mas nasceu com atalhos. Os meses seguintes foram gastos
trocando cada atalho por algo sólido: o banco de dados que perdia tudo virou um banco
de verdade; o login que confiava em qualquer um virou login com senha; a assistente que
só conversava passou a agir; e o conteúdo das usuárias, que estava legível para
qualquer um com acesso ao banco, passou a ser criptografado.

---

## As três séries de sprints

| Série | Documento | Quando | Situação |
|---|---|---|---|
| **A.** MVP em 3 dias | [`sprint_menteleve_mvp.md`](sprint_menteleve_mvp.md) | início | ✅ entregue — plano hoje obsoleto |
| **B.** Migração para a nuvem | [`Roadmap.md`](Roadmap.md) | 27/08/2026 | ✅ concluída |
| **C.** Evolução do produto (1 a 5) | [`roadmap-sprints-menteleve.md`](roadmap-sprints-menteleve.md) | 27–28/08/2026 | ✅ concluídas |

---

# Série A — O MVP em 3 dias

📄 [`sprint_menteleve_mvp.md`](sprint_menteleve_mvp.md) · **documento histórico — as instruções técnicas de lá não valem mais**

**MVP**: a menor versão do app que já dá para
colocar na mão de alguém e aprender com o uso.

O objetivo era provar uma coisa só — que a IA transformando uma frase solta ("festa do
Léo") numa lista de tarefas realmente encanta. Tudo que não servisse a isso ficou de
fora ou virou fachada.

| Dia | O que foi feito |
|---|---|
| **1 — O Cérebro** | O servidor: onde os dados ficam e onde a IA é consultada |
| **2 — O Corpo** | As telas que a usuária vê, conversando com o servidor do dia 1 |
| **3 — A Alma** | Boas-vindas, animações, e as telas "de vitrine" (Conexões e Paywall) |

### Os atalhos assumidos — e por que foram trocados depois

| Atalho do MVP | Problema | Virou |
|---|---|---|
| Banco **SQLite** em disco comum | Os dados sumiam a cada atualização do app | **PostgreSQL** no Supabase |
| Hospedagem no **GitHub Pages** | Limitado para o que o app precisava | **Vercel** |
| Login guardando só o e-mail no navegador | Não havia senha nem verificação | Login com senha e **JWT** |

Fachadas criadas de propósito no dia 3: **Conexões** e **Paywall** têm o visual pronto,
mas os botões só mostram um aviso. A ideia era medir o interesse antes de investir em
construir de verdade.

---

# Série B — Migração para a nuvem

📄 [`Roadmap.md`](Roadmap.md) · 27/08/2026

### O problema que forçou a migração

O banco de dados era um arquivo guardado junto com o programa, no servidor do **Render**
(a empresa que hospeda o backend). No plano gratuito, esse espaço é **temporário**: toda
vez que uma atualização era publicada, o arquivo era descartado.

Na prática: **toda tarefa cadastrada sumia a cada nova versão do app.**

A solução foi separar as coisas. O banco passou a morar no **Supabase** (um serviço
especializado em bancos **PostgreSQL**), que não é apagado quando o app é atualizado.

### Sprint 1 — Preparar o novo banco ✅

Criar o projeto no Supabase e traduzir a estrutura das tabelas — o SQLite e o PostgreSQL
usam dialetos um pouco diferentes. O resultado ficou salvo em
[`supabase_schema.sql`](../Backend/supabase_schema.sql).

### Sprint 2 — Conectar o app ao novo banco ✅

Trocar o "tradutor" que o programa usa para falar com o banco (o driver `psycopg`) e
testar cadastro, leitura, edição e exclusão direto contra o Supabase.

> **Um bug apareceu aqui.** Quando uma tarefa-mãe é excluída, as subtarefas dela também
> devem sumir. O SQLite não fazia isso sozinho, então o código apagava na mão. O
> PostgreSQL **já faz sozinho** — e as duas coisas juntas tentavam apagar a mesma linha
> duas vezes. A correção foi fazer o SQLite se comportar igual ao PostgreSQL, para o app
> funcionar do mesmo jeito nos dois.

### Sprint 3 — Colocar no ar ✅

Frontend publicado na **Vercel**, backend apontando para o novo banco, permissões de
acesso entre os dois ajustadas (**CORS**) e fluxo testado de ponta a ponta.

> **A armadilha que custou tempo:** o Supabase oferece dois endereços de conexão. O mais
> óbvio, chamado *Direct connection*, só funciona em redes com **IPv6** — e o Render não
> tem. O erro parecia "banco não existe", quando na verdade era "não consigo chegar até
> ele". É preciso usar o endereço do **Session pooler**.

### Duas decisões tomadas nesta série

**O backend continua no Render**, mesmo com o incômodo do plano gratuito: depois de
~15 minutos sem uso, o servidor "dorme" e a primeira visita seguinte demora ~30 a 50
segundos. Em vez de trocar de empresa, foi configurado um serviço gratuito que "cutuca"
o app a cada 10 minutos para mantê-lo acordado.

**As políticas de RLS do Supabase não são usadas** — e não adiantariam. RLS é um recurso
que protege o banco quando o *aplicativo do celular* fala diretamente com ele. Aqui não
é o caso: o celular fala com o nosso backend, e só o backend fala com o banco. A
proteção está nesse caminho.

---

# Série C — Evolução do produto

📄 [`roadmap-sprints-menteleve.md`](roadmap-sprints-menteleve.md) · 27–28/08/2026

## 🔒 Sprint 1 — Segurança e autenticação ✅

**O que mudou para a usuária:** passou a existir cadastro com senha de verdade.

**O que havia antes:** o app dizia ao servidor quem era a usuária mandando um número
(`X-User-Id`), e o servidor simplesmente acreditava.

> **Isso era uma falha crítica.** Qualquer pessoa com conhecimento básico podia trocar
> esse número por `1` e ler, editar ou apagar os dados de outra usuária. Não havia
> nenhuma verificação.

**O que passou a existir:**

- Senhas guardadas com **bcrypt** — uma técnica de mão única. O que fica salvo não é a
  senha, e sim um embaralhamento dela do qual **não é possível voltar atrás**. Nem quem
  administra o sistema consegue ler a senha de alguém.
- **JWT** — um crachá digital assinado que o servidor entrega no login. Ele não pode ser
  falsificado nem alterado sem que o servidor perceba. Vale 30 dias.
- Se o crachá expira, o app percebe e volta sozinho para a tela de login.

Confirmado também que o **calendário menstrual nunca sai do aparelho** — ele não é
enviado ao servidor em momento algum. E passou a sobreviver ao fim da sessão, já que não
pertence à conta e sim ao celular.

**Ficou para depois:** login com Google e Apple. Os botões existem, desabilitados, com o
aviso "em breve".

**Falha anotada, não corrigida:** existe um endereço (`POST /auth/me/premium`) que
permite a qualquer usuária logada se dar o Premium sozinha. Hoje é inofensivo, porque
não existe cobrança real — mas **precisa ser fechado antes de existir**.

---

## 🧠 Sprint 2 — Tarefas melhores e a Bruna agindo ✅

### Parte A — As datas

O pedido era "melhorar a leitura de datas pela IA". Investigando, **o problema não era a
IA.**

O app guardava a data como **texto** — literalmente a palavra "Amanhã". Toda vez que o
calendário precisava posicionar a tarefa, ele reinterpretava essa palavra.

**O efeito era estranho e real:** uma tarefa marcada para "Amanhã" **andava um dia para
frente todo dia**. Ela nunca chegava, nunca atrasava, ficava eternamente no dia seguinte.

A correção foi guardar a data como data (`2026-09-10`) e o horário como horário, e
montar o texto amigável só na hora de mostrar na tela.

**Dois bugs corrigidos junto:** o da tarefa que andava, e o atalho "Esta semana", que
nunca aparecia no calendário.

> **Uma armadilha de fuso horário evitada:** o servidor do Render funciona no horário de
> Londres (UTC). Entre 21h e meia-noite no Brasil, para ele já é o dia seguinte — então
> "amanhã" viraria dois dias depois. A solução foi o celular informar a data local em
> vez de o servidor deduzir.

**Ficou para depois:** tarefas que se repetem ("toda semana"). O motivo é honesto — a IA
até entendia o pedido, mas não havia onde guardar essa informação, então ela virava
lixo. Foi removida do pedido feito à IA até existir o campo adequado.

### Parte B — A Bruna passou a agir

Antes, a Bruna só conversava. Agora ela **cria e conclui tarefas** durante a conversa —
"marca o mercado como feito" funciona de verdade. Isso usa um recurso chamado
**function calling**, em que a IA, além de responder, pode acionar funções do sistema.

**Excluir tarefas ficou de fora de propósito:** é uma ação sem volta, e a identificação
é por aproximação de texto. O risco de apagar a coisa errada não compensava.

> **Uma decisão de projeto que evita um erro clássico:** a IA **nunca escolhe o número
> de identificação** de uma tarefa. Ela diz o título com as palavras da usuária, e o
> servidor procura entre as tarefas *daquela pessoa*. Assim a IA não tem como "inventar"
> um número e mexer na tarefa errada. Se houver mais de uma parecida, ela **pergunta**
> em vez de escolher.

**Três problemas antigos vieram à tona e foram corrigidos** — sem eles, o recurso novo
já nasceria quebrado:

1. **A Bruna travava depois de umas 20 mensagens.** O app mandava a conversa inteira a
   cada resposta, e acima de certo tamanho o servidor recusava. A partir dali ela só
   repetia frases prontas, para sempre.
2. **Sincronizar apagava tarefas criadas sem internet** e rebaixava a prioridade
   escolhida.
3. **A conversa sobrevivia ao logout** — num celular compartilhado, a próxima pessoa
   herdava o histórico da anterior.

**Como foi testado:** 7 situações diferentes, todas corretas — ela cria quando pedem
para criar, conclui quando dizem que terminaram, e **não faz nada** quando a pessoa só
está desabafando.

### Adendo — Groq como reserva da IA

A conta gratuita do **Gemini** (a IA do Google) permite cerca de 20 pedidos por minuto.
Ao passar disso, ela recusa — e a Bruna caía numa resposta genérica.

Pior: **a recusa não aparecia em lugar nenhum**. A usuária via "estou com um probleminha
para pensar" e não havia como descobrir o motivo.

Agora existe uma reserva: se o Gemini falhar, o pedido vai automaticamente para o
**Groq**, outro serviço de IA gratuito. Se os dois falharem, aí sim aparece a mensagem
gentil.

> **Duas horas economizadas para quem vier depois:** o Groq recusava tudo com um erro
> que parecia "chave inválida", mas era o Cloudflare bloqueando por falta de
> identificação do programa (o `User-Agent`). E os modelos de IA disponíveis **mudam de
> conta para conta** — é preciso consultar quais existem antes de escolher um.

---

## 📱 Sprint 3 — Telas e imagens ✅

**O problema no tablet.** O app limitava a largura do conteúdo só em telas grandes.
Entre o celular e o notebook — ou seja, tablets e celulares deitados — não havia limite
nenhum: o conteúdo **esticava de ponta a ponta**, com os cartões larguíssimos e o texto
perdido na esquerda.

A correção ficou inteira no arquivo de estilos. **Nenhuma tela precisou ser mexida.**

**O ganho de verdade foi o peso das imagens.** Várias eram muito maiores do que o tamanho
em que apareciam — a logo `ML.png` tinha 812 pixels de largura para ser exibida com 36.

| Imagem | Antes | Depois |
|---|---|---|
| `mulher-onboard` | 585 KB | **47 KB** |
| `isotipo` | 113 KB | **27 KB** |
| `ML` | 98 KB | **7 KB** |

Convertidas para **WebP** (formato mais eficiente) e redimensionadas ao uso real. O
pacote que o app baixa para funcionar offline caiu de **1,2 MB para ~125 KB** — cerca de
**dez vezes mais leve**, o que importa muito em internet de celular.

**Uma tarefa que se revelou desnecessária:** "padronizar as cores". A conferência mostrou
que as cores espalhadas pelo código **já eram exatamente** as da paleta oficial. As
únicas diferentes eram as do logotipo do Google, que devem ser aquelas mesmo.

**Como foi conferido:** 24 fotos automáticas das telas por rodada, em três larguras
diferentes, comparadas antes e depois. Tablet corrigido, e celular e computador
**idênticos** — nenhuma tela quebrou sem querer.

---

## 🎵 Sprint 4 — Som e controle de qualidade ✅

**Som sem arquivos de som.** O app agora toca um sinal ao concluir uma tarefa, ao receber
resposta da Bruna e ao tocar nos botões principais — mas **não existe nenhum arquivo de
áudio no projeto**. Os sons são gerados na hora pelo próprio navegador (**Web Audio
API**).

O motivo é direto: o peso do app tinha acabado de cair para ~125 KB na sprint anterior.
Anexar arquivos `.mp3` seria andar para trás. Gerar o som **não pesa nada** e nunca
falha por falta de conexão.

Junto veio o **interruptor no Perfil** para desligar os sons — o primeiro item daquele
menu que realmente faz alguma coisa.

> Curiosamente, já existia um som de conclusão no app. O que não existia era **qualquer
> forma de desligá-lo**. Essa era a lacuna real.

### Três defeitos sérios no modo offline

O **Service Worker** é a peça que guarda o app no celular para funcionar sem internet.
Ele tinha três problemas — e o primeiro era grave:

**Ele guardava a lista de arquivos de uma vez só, sem tolerar falhas.** Se **um único**
arquivo da lista estivesse com o nome errado, a operação inteira era cancelada e o app
ficava **sem modo offline nenhum** — sem nenhum aviso. Como a lista é escrita à mão, um
erro de digitação bastava.

Comprovado na prática, colocando um caminho inválido de propósito:

| | App salvo no celular? | Arquivos guardados |
|---|---|---|
| Código antigo | **não** | **0** |
| Corrigido | sim | 24 |

Os outros dois: páginas de erro estavam sendo guardadas e depois exibidas offline como se
fossem conteúdo válido; e havia uma falha que travava o app ao pedir um arquivo que não
estava guardado, sem internet.

**Varredura final:** nenhum erro e nenhuma falha de carregamento nas 9 telas, tanto na
máquina local quanto no site publicado.

---

## 🔐 Sprint 5 — Criptografia do conteúdo ✅

Esta sprint não estava no plano. Ela nasceu de uma pergunta durante uma revisão de
segurança.

**A situação:** o app já impedia que uma usuária visse as tarefas de outra. Mas essa
proteção valia apenas para quem entrava **pela porta da frente**, isto é, pelo app.

Dentro do banco de dados, tudo estava em **texto puro** — legível. Quem tivesse a senha
do banco, ou uma cópia dele, lia a rotina inteira de todas as usuárias: nomes de médicos,
escola dos filhos, finanças.

### A escolha entre duas criptografias

**A que foi feita:** o servidor embaralha o conteúdo antes de gravar, com uma chave que
fica guardada **fora do banco**. Uma cópia do banco, sozinha, não serve para nada.

**A que foi descartada** (criptografia "ponta a ponta", em que nem o servidor consegue
ler): teria dois custos altos demais.

1. **Mataria a Bruna.** O servidor precisa ler os títulos para encontrar a tarefa que a
   usuária mencionou. Sem isso, ela não consegue mais criar nem concluir nada.
2. **Esquecer a senha significaria perder tudo**, sem recuperação possível.

### Como funciona

A técnica é o **AES-256-GCM**, um padrão que faz duas coisas: esconde o conteúdo e
**detecta se alguém alterou** o valor gravado.

Cada gravação usa um embaralhamento diferente — então a mesma tarefa escrita duas vezes
fica com aparências distintas no banco. Assim, nem *quais tarefas se repetem* é possível
descobrir.

**Fica escondido:** o título das tarefas e o nome da usuária.
**Fica visível de propósito:** o e-mail (é por ele que o login procura a conta), a data,
a categoria e se a tarefa está concluída — são esses campos que fazem o calendário
funcionar.

Em resumo: **o banco mostra *quando*, não *o quê*.**

> **Um bug que a própria criptografia ia criar.** Existia uma proteção contra tarefa
> duplicada, que comparava títulos. Com o conteúdo embaralhado, essa comparação **nunca
> mais daria certo** — e a proteção morreria **em silêncio**, sem erro nenhum, só
> voltando a duplicar tarefas. Foi encontrada e corrigida antes de ir ao ar.

**Como foi testado:** 87 verificações, nenhuma falha. A que prova tudo: criar uma tarefa
pelo app e olhar o banco direto mostra

```
v1:CRUGya26Yykck3yFP9_xdRkz2A9bx0I3vMynUrvy4_6MaFGoqNv8S6K0s82bEui3...
```

enquanto o app exibe o título normal. Confirmado também no site publicado.

> ⚠️ **O preço dessa proteção:** se a chave (`ENCRYPTION_KEY`) for perdida, os dados
> gravados **não voltam**. Não é uma questão de permissão — é matemática. Ninguém
> consegue recuperar, nem quem fez o sistema.

---

# O que essas sprints ensinaram

Quatro padrões se repetiram, e valem para as próximas:

**1. O problema quase nunca era o descrito.** "Melhorar a leitura de datas" era, na
verdade, a data estar guardada como texto. "Padronizar as cores" não precisava de nada —
já estavam certas. "Adicionar som" descobriu que o som já existia; faltava **desligar**.

**2. Cada sprint desenterrou defeitos antigos.** A Bruna travando após 20 mensagens, as
tarefas offline sendo apagadas, o modo offline quebrado — todos já estavam lá antes da
sprint que os encontrou. Mexer numa área costuma revelar o que estava escondido nela.

**3. Os defeitos mais perigosos foram os silenciosos.** Nenhum dos piores problemas
mostrava mensagem de erro: a IA recusando pedidos sem avisar, o modo offline falhando
sem sinal, a proteção contra duplicatas que teria parado de funcionar sem ninguém notar.
Um erro visível é um erro fácil.

**4. O que ficou de fora está anotado com o motivo** — recorrência de tarefas, login
social, a falha do Premium, o limite de tentativas de senha. Some da versão, mas não da
documentação.
