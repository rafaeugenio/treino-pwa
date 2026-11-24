# Treino PWA: SDD da RAFA-180 e RAFA-181

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

vite-plugin-pwa/Workbox generateSW gera precache do shell versionado com base /. O SW fica em espera nas atualizações, sem skipWaiting automático ou recarga durante edição. O botão Board UI Atualizar (mínimo 44 px) aparece quando há uma versão em espera e aplica a atualização ao toque; caches antigos são limpos na ativação. Isso evita misturar assets durante uma sessão. Manifest estático e ícones próprios incluem apple-touch 180, 192, 512 e maskable 512.

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
- A prova local do CA07 (formulário Registro, `data-testid="record"`) foi para a tela Registro. O botão Atualizar fica acima das telas, visível em qualquer uma.

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
