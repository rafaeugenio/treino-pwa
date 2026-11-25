# Treino PWA: SDD das RAFA-180, RAFA-181, RAFA-182, RAFA-183 e RAFA-184

## Spec

Fonte: snapshot RAFA-176 de 23/11/2026 19:10, fornecido pelo Mochi.
[RAFA-176](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia) e [RAFA-180](https://linear.app/rafagg/issue/RAFA-180/01-criar-repo-github-pages-e-pwa-offline).
Requisitos originais copiados abaixo; D3 substitui a stack do requisito 7. Decisão do Rafael em 23/11/2026 21:32, registrada pelo Mochi na RAFA-176: o destino do requisito 8 passou do GitHub Pages para a Vercel, conta pessoal RafaGG, em projeto novo só deste app, servido na raiz /.
**Requisitos e escopo**

 1. Registrar atividades diárias: dia, o que praticou e quantas horas.
 2. Plano de calistenia de 28 dias, um treino por dia, 28 dias seguidos.
 3. Se num dia planejado ele registrar outra atividade (ex.: vôlei ou futebol no dia 2), o treino daquele dia desliza para o dia seguinte e o plano inteiro anda junto, sem quebrar a sequência.
 4. Horas por atividade, inclusive nas atividades substitutas.
 5. Opcional: ícones de dor ou desconforto (opções predefinidas) mais campo de texto livre (ex.: ombro deslocado), para revisar depois em consulta. Se não sentiu nada, nada fica marcado. Precisa de visão de histórico desses registros.
 6. Lembretes por notificação de PWA onde o iOS permitir (Web Push no iOS 16.4+ só com o app instalado na tela inicial; se não der, fallback explicado) e estatísticas.
 7. Stack: Toolcraft, Board UI e Dialkit, a mesma do protótipo TFD.
 8. Repo pessoal novo no GitHub, publicado no GitHub Pages (nunca Vercel), para abrir no Safari do iPhone e instalar na tela inicial: manifest, service worker, ícones apple-touch e funcionamento offline. Dados só no aparelho (localStorage ou IndexedDB), sem backend. Repo público é aceitável (não há dados sensíveis no código).
 9. Mobile-first: ícones e componentes dimensionados e dispostos primeiro para a tela do celular, com alvos de toque adequados e safe areas do iPhone.
10. UI muito limpa e minimalista: sem subtítulos, sem legendas grandes, sem textos de ajuda pequenos embaixo dos componentes. Mínimo de texto.
11. Usar componentes do Board UI em todas as telas, inclusive o dashboard, e não só os ícones: cards, stats, listas, forms, tabs, calendário, drawer, modal etc.

## Fora de escopo

Sem backend e sem sincronização na nuvem. Criar o projeto na Vercel, conectar o repo e fazer deploy ficam fora deste PR: o Mochi faz isso depois do merge. Sem dados sensíveis no repositório.

Complemento do Mane · Spec:

* Conta, login ou multiusuário.
* Notificação push e servidor de push (follow-up, ver D2).
* Exportar ou compartilhar relatório (PDF, e-mail) para o médico; a consulta usa a tela de histórico.
* Editor do plano pela UI: o conteúdo dos 28 treinos fica fixo no código nesta versão.
* Integração com Apple Saúde, Strava ou wearables.
* Otimização específica para Android ou desktop (precisa só não quebrar).
* Validação clínica do conteúdo dos treinos.


## Design

Base mobile de 390×844, tipografia de sistema, tokens neutros Board UI, safe areas e controles de pelo menos 44×44. Início mínimo com StatCards, Input e Button reais do CLI Board UI 0.5.9. Sem subtítulos nem textos de ajuda. As cinco telas completas seguem nas RAFA-181 a 186.

## Tarefas

- [x] Scaffold Vite + React 19 + TS + Tailwind 4, sem Storybook.
- [x] Board UI gerado por CLI pinado; avaliação Toolcraft.
- [x] Manifest, ícones próprios, SW e armazenamento local.
- [x] Testes unitários e PWA em dois motores.
- [x] vercel.json com fallback SPA e cache do SW, sem deploy.
- [ ] Revisão Bari no head exato e merge pelo responsável.
- [ ] Deploy na Vercel pelo Mochi depois do merge.

## Implementação

Configuração adaptada da referência somente leitura: plugin React, alias @/, compilação bundler ES2023, PostCSS Tailwind 4 e oxlint React/TS/Oxc. Removidos Storybook, shims Next e integrações que a base não usa. Estrutura components/, utils/, styles/ e src/lib/.

localStorage contém somente o último registro demonstrativo na chave versionada treino-pwa:registro:v1. Falhas de gravação geram erro visível. Nenhuma API de dados ou host externo. Esta prova não implementa o registro completo de atividades da RAFA-181.

vite-plugin-pwa/Workbox generateSW gera precache do shell versionado com base /. O SW fica em espera nas atualizações, sem skipWaiting automático ou recarga durante edição. O botão Board UI Atualizar (mínimo 44 px) aparece quando há uma versão em espera e aplica a atualização ao toque; caches antigos são limpos na ativação. Isso evita misturar assets durante uma sessão. Ao voltar ao primeiro plano (visibilitychange visível), o useRegisterSW do casco em src/app.tsx guarda a registration e um useEffect com cleanup chama registration.update(), no máximo a cada 60 s (performance.now()) e só online, para o Atualizar aparecer sem reabrir o app. Página oculta ou offline não busca o SW nem gasta o intervalo (RAFA-225; testes em tests/update-visibility.spec.ts). Manifest estático e ícones próprios incluem apple-touch 180, 192, 512 e maskable 512.

### Toolcraft

Starter gerado em diretório temporário com --no-skills. O npm interno falhou com `Class extends value undefined is not a constructor or null` (exit 1); os fontes ficaram disponíveis para avaliação. Conforme orientação do Mochi, setup adicional é opcional. Nenhuma parte incorporada:

| Parte | Decisão e motivo |
| --- | --- |
| Canvas | Editor visual não serve ao registro de treino. |
| Layers | Composição de mídia fora do escopo. |
| Timeline/keyframes | Animação de conteúdo não é necessária. |
| Export | Explicitamente fora do escopo. |
| Controles | Board UI já fornece os controles exigidos. |
| Ícones | Remix instalado pelo Board UI evita duplicar bibliotecas. |
| Utilitário cn | Inspecionado: clsx + twMerge; cx do Board UI já cobre com tipos compostos. |
| Harness de checks | Acoplado ao editor; usados Vitest e Playwright voltados a esta PWA. |

Dialkit ausente. D3 autoriza essa seleção sem forçar Toolcraft. O registro dos motivos fica neste SDD e no card RAFA-180, onde foi registrado pelo Mochi.

### Publicação na Vercel, somente após merge

O GitHub Pages saiu do plano. O script publicar-pages.mjs, seus testes e o npm script publicar:pages foram removidos porque só publicavam na branch gh-pages, que não será usada; a Vercel faz o build a partir do repo conectado. O app passou da base /treino-pwa/ para a raiz /, em vite.config.ts, no manifest (start_url e scope), nos ícones, no Playwright e nos testes.

vercel.json mínimo: um rewrite manda para /index.html só caminhos sem extensão e fora de /assets/, então sw.js, workbox-*.js, manifest.webmanifest, ícones e assets são servidos como arquivos. sw.js e manifest.webmanifest vão com `Cache-Control: public, max-age=0, must-revalidate`, para o navegador sempre buscar o SW novo e o aviso Atualizar aparecer; /assets/, com nomes versionados, vai com cache imutável de um ano. src/vercel.test.ts confere essas regras no Vitest.

Plano após o APROVADO do Bari no head exato e merge, executado pelo Mochi: criar projeto novo na conta pessoal RafaGG, conectar este repo, framework Vite detectado (build `npm run build`, saída dist), deploy de produção a partir de main. Depois, conferir no iPhone a instalação pelo Safari e a abertura offline. Nenhum projeto, conexão ou deploy foi feito neste PR.

## Gates

CAs são referenciados pelo contrato original, sem reescrita: [CA01, CA02, CA03, CA04, CA05, CA06, CA07 e CA08](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia). RAFA-180 cobre CA07 e prepara a base CA08; CA01–CA06 e todas as telas ficam nas próximas issues.

[Decisões D1, D2 e D3](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia): aplicam-se as decisões do card; D3 substitui requisito 7. A regra de parada do projeto continua no card; esta subentrega termina em PR pronto para revisão. Merge exige Bari APROVADO no head exato e check local. Publicação somente depois do merge.

`npm run check`: oxlint, tsc -b, Vitest, build e Playwright. HOME falso obrigatório nesta execução. WebKit iPhone 15 e Chromium mobile testam manifest, metas, layout, persistência, SW ativo/escopo e reabertura offline. Instalação real pelo menu do Safari e display-mode do app instalado exigem verificação posterior no iPhone. O teste confere display standalone no manifest, sem afirmar instalação real. O teste offline roda em perfil persistente, como o app instalado, e reabre a página depois de 20 s sem nenhuma página aberta.

## Resultado

Repo: https://github.com/rafaeugenio/treino-pwa. Vercel: projeto ainda não criado; a URL sai do primeiro deploy. Check e PR: resultados finais no relatório do autor e na seção Verification do PR. Instalação Safari: Compartilhar → Adicionar à Tela de Início; abrir uma vez conectado antes de usar offline. Apagar os dados do site remove o registro local.

### Rastreabilidade Board UI

Componentes existentes gerados com boardui@0.5.9. Esta entrega reutiliza Button de components/base/buttons/button, sem regenerar componentes. Comandos de validação: npm run check (wrapper rafa180-autor-env.cmd com HOME falso).

### Correções da revisão de publicação (F1 a F4)

Testes node incluem dist ausente, identidade ausente, hook de commit falho após cópia e check que suja checkout. Cada fixture criada era removida no fim. Script e testes saíram depois, com a troca para a Vercel (ver Publicação). O teste SW gera o segundo build com configuração temporária e transformIndexHtml, sem reescrever index.html versionado, e remove seus builds temporários ao final.

### Reabertura offline no WebKit

Na rodada F1 a F4 o check falhou uma vez no WebKit ao reabrir offline (`FetchEvent.respondWith: Load failed`). Causa: o contexto efêmero do Playwright WebKit esvazia o Cache Storage do precache quando o origin fica sem páginas por alguns segundos, com o SW ainda ativo; offline, o Workbox não acha index.html e recorre à rede. Uma sonda com 20 s sem páginas falha do mesmo jeito em main 2b1b069 e em 2a234e1, passa no Chromium e passa nos dois motores com perfil persistente. O defeito era do teste, anterior a este PR. Correção: tests/pwa.spec.ts usa launchPersistentContext com o perfil do projeto, confere zero páginas abertas e espera 20 s antes de reabrir offline.

## RAFA-181: casco mobile-first com Board UI

Issue: [RAFA-181](https://linear.app/rafagg/issue/RAFA-181/02-montar-o-casco-mobile-first-com-board-ui). Contrato: [CA08 da RAFA-176](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia), sem reescrita, mais a D3. O Spec da RAFA-181 ainda cita Dialkit; vale o CA08 e a D3, e o Dialkit continua fora.

### Design

- Seis telas na ordem do CA08: Início, Registro, Plano, Dor, Estatísticas e Lembretes (`src/screens.ts`).
- Navegação por `Tabs`, `TabList`, `Tab` e `TabPanel` do Board UI (react-aria), numa barra inferior fixa só com ícones Remix e nome acessível por `aria-label`. Seis rótulos não cabem em 390 px sem legenda pequena; o título h1 de cada tela nomeia a tela aberta.
- Cada tela tem só o título h1 e componentes Board UI: StatCards nas telas sem feature (valores zerados reais, sem dado inventado), Input e Button no Registro.
- A tela aberta fica no hash (`#registro` etc.), então recarregar mantém a tela. Início usa `/` sem hash.
- Safe areas: `main` usa `env(safe-area-inset-*)` nos quatro lados e reserva a altura da barra; a barra soma `env(safe-area-inset-bottom)` e as laterais.
- Alvos de toque: abas, botões e campos com no mínimo 44×44 px.
- A prova local do CA07 (formulário Registro) foi para a tela Registro; desde a RAFA-182 a lista da tela é `data-testid="atividades"` (o antigo `data-testid="record"` saiu). O botão Atualizar fica acima das telas, visível em qualquer uma. Com o casco, `src/main.tsx` só monta o app e o `useRegisterSW` (Atualizar e checagem do SW ao voltar ao primeiro plano da RAFA-225) vive em `src/app.tsx`.

### Peças Board UI

| Peça | Origem |
| --- | --- |
| `components/base/tabs/tabs.tsx` e `pill-tab.tsx` | Nova, `npx --yes boardui@0.5.9 add tabs --yes`; o CLI só escreve os dois arquivos e pulou os 5 existentes. `pill-tab.tsx` vem junto no item e não é usado. |
| StatCards, Button, Input, Chip, Tooltip, direction | Já existentes da RAFA-180, sem regenerar. |

Toolcraft: nenhuma parte nova entrou; a tabela da RAFA-180 acima continua valendo. Dialkit ausente.

### Fora desta entrega

CA01 a CA06 (registro completo, plano de 28 dias com deslize, dor, estatísticas reais e lembrete local) ficam nas RAFA-182 a 186. As telas desta entrega são placeholders.

### Tarefas

- [x] Seis telas navegáveis com Tabs Board UI em 390×844.
- [x] Prova CA07 movida para a tela Registro, testes ajustados.
- [x] `tests/casco.spec.ts`: percorre as seis telas nos dois motores conferindo Tabs/TabPanel react-aria, título, peça Board UI visível, nenhum texto de descrição sob o título, toque ≥ 44 px, ausência de rolagem horizontal, conteúdo acima da barra fixa e hash após recarregar; segundo teste confere `env(safe-area-inset-*)` nos quatro lados e a barra fixa.
- [x] `src/screens.test.ts`: hash para tela e as seis telas na ordem.
- [ ] Revisão Bari no head exato e merge pelo responsável.

### Gates

`npm run check` com HOME falso (`rafa181-autor-env.cmd`): oxlint, tsc -b, Vitest, build e Playwright em WebKit iPhone 15 e Chromium, viewport 390×844. Resultados e exit codes na seção Verification do PR. Anti-slop: PASSOU, com screenshots das seis telas em WebKit revisados localmente (não versionados). Safe area real com notch e home indicator exige conferência no iPhone; o Playwright não simula inset.

## RAFA-182: registro diário de atividades com horas

Issue: [RAFA-182](https://linear.app/rafagg/issue/RAFA-182/03-registrar-atividades-diarias-com-horas). Contrato: [CA01 da RAFA-176](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia), sem reescrita, mais os requisitos 1 e 4 do card mãe (dia, o que praticou e horas, inclusive nas atividades substitutas).

### Design

- Modelo em `src/lib/atividades.ts`: cada atividade tem `id`, `data` (dia local AAAA-MM-DD), `nome` livre (Vôlei, Futebol, treino do plano) e `horas` em (0, 24]. Lista JSON em `localStorage`, chave nova `treino-pwa:atividades:v1`.
- A chave `treino-pwa:registro:v1` da prova da RAFA-180 guardava um texto livre demonstrativo. Ela não é lida nem migrada, para não misturar formatos; o módulo `src/lib/storage.ts` saiu. Conteúdo corrompido ou fora do formato vira lista vazia, e falha de gravação mostra erro visível.
- Horas aceitam vírgula brasileira (`1,5`), ponto e inteiro; a lista mostra `1,5 h`.
- Tela Registro: Input Board UI de Data (`type="date"`, abre no dia de hoje), Atividade e Horas (`inputMode="decimal"`), Button Salvar e, abaixo, a lista das atividades do dia escolhido no campo Data, com nome e Chip Board UI das horas. Sem subtítulo nem texto de ajuda; a única mensagem é `Horas inválidas` no campo, quando necessário.
- Início conta as atividades salvas no StatCards. Estatísticas segue placeholder (CA05 é da RAFA-185).

### Fora desta entrega

Plano de 28 dias e deslize (CA02 e CA03, RAFA-183), dor (CA04), estatísticas reais (CA05) e lembretes (CA06). Editar ou apagar atividade não está no CA01 e não foi feito. Sem login, nuvem, integrações, export/import, backend, Dialkit ou deploy.

### Tarefas

- [x] Modelo local versionado com testes unitários (`src/lib/atividades.test.ts`): horas com vírgula, limites, dia local, persistência entre instâncias, formato antigo e corrompido ignorados, quota.
- [x] Tela Registro com data, nome, horas e lista do dia.
- [x] `tests/registro.spec.ts` (CA01): registra Vôlei 1,5 e Flexões no dia 24 e Futebol no dia 23, confere a lista de cada dia, fecha a página e reabre outra no mesmo contexto, e confere de novo; segundo teste confere o dia de hoje como padrão, a recusa de horas inválidas sem gravar e alvos de 44 px.
- [x] `tests/pwa.spec.ts` (CA07): a prova de persistência e reabertura offline passou a registrar Vôlei 1,5 em 24/11/2026 e a conferir essa atividade após recarregar, offline e depois de 20 s sem páginas.
- [x] Ajustes da revisão Bari r1 ([review 6049069913](https://github.com/rafaeugenio/treino-pwa/pull/6#pullrequestreview-6049069913)): horas que arredondam para 0 (ex.: `0,001`) passam a ser recusadas por `parseHoras` com `Horas inválidas` no campo; nome só com espaços mostra `Informe a atividade` no campo Atividade. Nos dois casos nada é gravado e o alerta de dispositivo não aparece (testes unitário e Playwright).
- [ ] Revisão Bari no head exato e merge pelo responsável.

### Gates

`npm run check` com HOME falso (`rafa182-autor-env.cmd`): oxlint, tsc -b, Vitest, build e Playwright em WebKit iPhone 15 e Chromium, viewport 390×844. Resultados e exit codes na seção Verification do PR.

## RAFA-183: plano de 28 dias e deslize

Issue: [RAFA-183](https://linear.app/rafagg/issue/RAFA-183/04-implementar-o-plano-de-28-dias-e-o-deslize). Contrato: [CA02 e CA03 da RAFA-176](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia), sem reescrita, com a D1 confirmada pelo Rafael em 23/11/2026 18:31 (dia previsto sem nenhum registro também desliza).

### Design

- Modelo em `src/lib/plano.ts`, chave nova `treino-pwa:plano:v1` com `{ inicio, feitos }`: o dia D de início e, em ordem, o dia em que cada treino foi marcado como feito. A chave `treino-pwa:atividades:v1` não é migrada nem reaproveitada para o estado do plano.
- Conteúdo dos 28 treinos: lista fixa no código com os nomes `Treino 1` a `Treino 28`. Não há programa clínico no repositório, no SDD nem nos cards, e o app não inventa rotina de exercícios. Conteúdo oficial, quando existir, substitui a lista `TREINOS`.
- Agenda derivada, sem job: o próximo treino pendente fica no dia seguinte ao último feito (ou em D). Se esse dia já passou no calendário local do aparelho sem o treino marcado, ele desliza para hoje e os seguintes andam junto, um por dia. Assim nenhum treino é pulado ou repetido e a data final anda um dia por dia deslizado. Atividade substituta (ex.: Futebol 2 h, pela tela Registro) não conta como treino e fica no histórico da RAFA-182 com as horas.
- "O dia termina" é avaliado ao abrir o app e ao voltar ao primeiro plano (`visibilitychange`), pelo dia local; não há backend.
- Marcar feito grava o plano e registra a atividade `Treino N` no dia, com as horas, em `treino-pwa:atividades:v1` (o modelo da RAFA-182 já previa o treino do plano como nome). Se gravar a atividade falhar, o plano volta ao estado anterior e aparece o alerta de dispositivo.
- Plano salvo corrompido ou fora do formato é lido como não iniciado, no mesmo padrão da RAFA-182 (nada é apagado na leitura); `ler()` marca esse estado como inválido e a UI segue o CA03-B3 abaixo.
- Tela Plano: sem plano, Input Board UI `Início` (`type="date"`, abre em hoje) e Button `Iniciar`; com plano, StatCards `Feitos N de 28` e a lista dos 28 (`data-testid="plano"`) com nome, Chip `Feito` e Chip da data; a linha de hoje tem `aria-current="date"`.
- Tela Início: StatCards `Atividades` e `Hoje` (treino previsto ou `—`, com `de 28` ou `Feito`) e, quando há treino pendente hoje, Input `Horas` e Button `Feito`.
- Validação no campo, com `aria-invalid` e mensagem ligada por `aria-describedby`: `Horas inválidas` (mesma regra do CA01, inclusive `0,001`) e `Informe a data`. O alerta de dispositivo fica só para falha de gravação.

### Casos de borda (CA03-B1, B2 e B3)

Contrato: [seção "Casos de borda" do card da RAFA-183](https://linear.app/rafagg/issue/RAFA-183/04-implementar-o-plano-de-28-dias-e-o-deslize) (Mane · Spec, 24/11/2026 21:50), sem reescrita. O B3 também resolve o P2 da revisão Codex do head `7275159` (plano inválido bloqueava o início pela UI).

- CA03-B1: com plano válido, a tela Plano mostra só o progresso e a lista; não há campo de data nem botão de reiniciar. Comportamento já existente, agora coberto por teste.
- CA03-B2: no toque em Feito, `src/app.tsx` lê o dia do aparelho naquele instante e relê o plano salvo, atualiza a tela (`flushSync`) com o treino previsto para esse dia, já deslizado, e só então grava o treino desse dia na data nova. Sem treino pendente no dia (plano encerrado, ou treino já marcado em outra aba), o Feito some e nada é gravado, sem alerta.
- CA03-B3: `ler()` distingue plano ausente, válido e inválido. Com conteúdo inválido, Início e Plano mostram o Button `Recomeçar plano` (no Plano, no lugar de `Iniciar`), que abre `Confirmar` e `Cancelar`. No estado de confirmação, o título `Recomeçar plano?` (h2) ocupa o lugar do botão, o foco vai para `Cancelar` e `Confirmar` fica por último; assim o segundo gesto de um toque duplo, dblclick ou Enter repetido nunca cai no `Confirmar` (ajuste da [review Bari 6050114781](https://github.com/rafaeugenio/treino-pwa/pull/7#pullrequestreview-6050114781)). Cancelar devolve o foco ao `Recomeçar plano`. Confirmar chama `recomecar()`: guarda o conteúdo inválido em `treino-pwa:plano:v1:backup:<instante ISO>` (uma chave por recomeço; se a chave já existir, usa o sufixo `-2`, `-3` e assim por diante, sem sobrescrever) e só depois grava o plano novo começando hoje. Se o backup falhar, nada muda e aparece o alerta de dispositivo, que fica só para falha real de gravação. `iniciar()` continua recusando qualquer chave existente.

### Fora desta entrega

Editor do plano pela UI, validação clínica, reiniciar ou trocar a data D de um plano já iniciado (a única exceção é o plano salvo corrompido, CA03-B3), CA04 (dor), CA05 (estatísticas reais), CA06 (lembretes), login, nuvem, integrações, export/import, backend, Dialkit e deploy.

### Tarefas

- [x] `src/lib/plano.ts` e `src/lib/plano.test.ts`: sequência 1 a 28 em dias consecutivos, marcar feito com horas, deslize por substituta e por dia sem registro, data final, plano futuro, plano concluído, guardas e formato salvo inválido.
- [x] Telas Início e Plano em `src/app.tsx`.
- [x] `tests/plano.spec.ts` (WebKit iPhone 15 e Chromium, 390×844, relógio do Playwright): CA02 completo, CA03 com Futebol 2 h no dia previsto, CA03 com dois dias sem registro, troca de dia ao voltar ao primeiro plano, início futuro e erros no campo (`0,001` e data vazia).
- [x] CA03-B1, B2 e B3: `ler` e `recomecar` com testes unitários; testes Playwright do plano iniciado sem opções de reinício, do Feito cruzando a meia-noite com relógio falso, do plano encerrado antes do toque, da releitura do plano marcado em outra aba e do Recomeçar plano (abertura, confirmação e backup).
- [x] Ajustes da [review Bari 6050114781](https://github.com/rafaeugenio/treino-pwa/pull/7#pullrequestreview-6050114781): dblclick, dois toques rápidos e Enter duplo no `Recomeçar plano` não confirmam nem gravam; Cancelar devolve o foco ao `Recomeçar plano`; título `Recomeçar plano?` na confirmação; backup com sufixo quando a chave já existe; `marcarFeito` propaga o erro original se desfazer o plano também falhar. Cada item com teste próprio (Playwright nos dois motores ou Vitest).
- [x] Seção RAFA-181 corrigida: a menção a `data-testid="record"` passou a `data-testid="atividades"`.
- [ ] Revisão Bari no head exato e merge pelo responsável.

### Gates

`npm run check` com HOME falso (`rafa183-autor-env.cmd`): oxlint, tsc -b, Vitest, build e Playwright em WebKit iPhone 15 e Chromium, viewport 390×844. Prova de vermelho de cada guarda nova, resultados e exit codes na seção Verification do PR.

## RAFA-184: dor ou desconforto do dia e histórico

Issue: [RAFA-184](https://linear.app/rafagg/issue/RAFA-184/05-registrar-dor-ou-desconforto-e-o-historico). Contrato: [CA04-1 a CA04-4 do card da RAFA-184](https://linear.app/rafagg/issue/RAFA-184/05-registrar-dor-ou-desconforto-e-o-historico), sem reescrita, com as decisões do Mane · Spec de 24/11/2026 22:05. Cobre o [CA04 da RAFA-176](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia).

**Ícones: P1, aguardando o Rafael.** A lista em uso é a proposta do card: Dor muscular, Dor articular, Dor nas costas, Cãibra, Falta de ar ou tontura e Outro. Ela fica fixa num único lugar, `ICONES` em `src/lib/dor.ts` (id, nome e ícone Remix), e pode ser trocada sem mexer nos CAs. O merge do PR depende da confirmação do conjunto pelo Rafael, além do Bari APROVADO no head exato e do check local.

### Design

- Modelo em `src/lib/dor.ts`, chave nova `treino-pwa:dor:v1`: lista JSON de anotações `{ id, data, icones, texto }`. A anotação é do dia (AAAA-MM-DD local), não de uma atividade; um dia pode ter várias, e o dia não precisa ter atividade. `treino-pwa:atividades:v1` e `treino-pwa:plano:v1` não são lidas, migradas nem alteradas.
- `icones` guarda os ids da lista, na ordem dela. Id fora da lista atual (por troca futura do conjunto) continua salvo e aparece no histórico pelo próprio id.
- Anotação sem ícone e sem texto (texto só com espaços conta como vazio) não é gravada (CA04-2). Data vazia ou fora do calendário é recusada.
- Conteúdo salvo que não é lista é lido como histórico vazio e não é sobrescrito: ao salvar, aparece o alerta de dispositivo e nada muda. Itens da lista que não podem ser lidos ficam guardados como estão quando uma anotação nova entra. Nenhum dado é descartado.
- Tela Dor: Input `Data` (`type="date"`, abre em hoje, erro `Informe a data` no campo), grupo `Ícones` com um Button Board UI por ícone (`aria-pressed`, toque alterna), Input `Texto` e Button `Salvar`. Depois de salvar, ícones e texto voltam ao vazio e a data fica. Abaixo, o histórico (`data-testid="historico"`): só os dias com dor, do mais recente ao mais antigo, cada um com a data `dd/mm/aaaa` e, por anotação, Chips dos ícones e o texto. Sem dor salva, `Nenhuma dor`.
- CA04-2 na UI: `Salvar` sem ícone e sem texto não grava e mostra `Marque ou escreva a dor` no campo Texto, com `aria-invalid` e `aria-describedby` ligado ao FieldError. Marcar um ícone ou digitar tira o erro. O alerta de dispositivo fica só para falha real de gravação.
- Tela Registro sem mudança. O StatCards placeholder da tela Dor saiu.
- Follow-up Bari: no `Recomeçar plano`, o `Cancelar` ganhou `aria-describedby="recomecar-titulo"`, sem mudar o fluxo da confirmação.

### Fora desta entrega

Editar ou apagar anotação, vínculo com atividade, exportar ou compartilhar relatório (PDF, e-mail), export/import JSON, Apple Saúde, Strava e wearables, o app de lesões da RAFA-178, CA05 (RAFA-185) e CA06 (RAFA-186).

### Tarefas

- [x] `src/lib/dor.ts` e `src/lib/dor.test.ts`: lista fixa, gravação por dia só com ícones ou só com texto, leitura por outra instância, CA04-2, data inválida, duas anotações no mesmo dia, ordem do histórico, conteúdo ilegível não sobrescrito, itens ilegíveis preservados e quota.
- [x] Tela Dor em `src/app.tsx`.
- [x] `tests/dor.spec.ts` (WebKit iPhone 15 e Chromium, 390×844, relógio do Playwright): CA04-1 com hoje por padrão, sem atividade no dia e reabertura; CA04-1 em data escolhida com atividade; CA04-3; CA04-4; CA04-2 (nada marcado, texto só com espaços, ícone marcado e desmarcado); data vazia; dblclick, dois toques com 150 ms e Enter duplo no Salvar gravando uma anotação só; conteúdo ilegível não sobrescrito; alvos de 44 px e sem rolagem horizontal.
- [x] `tests/plano.spec.ts`: o Cancelar do `Recomeçar plano` é descrito pelo título.
- [ ] Confirmação do conjunto de ícones pelo Rafael (P1).
- [ ] Revisão Bari no head exato e merge pelo responsável.

### Gates

`npm run check` com HOME falso (`rafa184-autor-env.cmd`): oxlint, tsc -b, Vitest, build e Playwright em WebKit iPhone 15 e Chromium, viewport 390×844. Prova de vermelho de cada guarda nova, resultados e exit codes na seção Verification do PR.
