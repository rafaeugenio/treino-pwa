# Treino PWA: SDD da RAFA-180

## Spec

Fonte: snapshot RAFA-176 de 23/11/2026 19:10, fornecido pelo Mochi.
[RAFA-176](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia) e [RAFA-180](https://linear.app/rafagg/issue/RAFA-180/01-criar-repo-github-pages-e-pwa-offline).
Requisitos originais copiados abaixo; D3 substitui a stack do requisito 7.
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

Sem backend, sem sincronização na nuvem e sem publicação na Vercel (Vercel exige OK à parte e não entra neste trabalho). Sem dados sensíveis no repositório.

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
- [x] Script de publicação preparado, sem execução.
- [ ] Revisão Bari no head exato e merge pelo responsável.
- [ ] Publicação posterior ao merge.

## Implementação

Configuração adaptada da referência somente leitura: plugin React, alias @/, compilação bundler ES2023, PostCSS Tailwind 4 e oxlint React/TS/Oxc. Removidos Storybook, shims Next e integrações que a base não usa. Estrutura components/, utils/, styles/ e src/lib/.

localStorage contém somente o último registro demonstrativo na chave versionada treino-pwa:registro:v1. Falhas de gravação geram erro visível. Nenhuma API de dados ou host externo. Esta prova não implementa o registro completo de atividades da RAFA-181.

vite-plugin-pwa/Workbox generateSW gera precache do shell versionado com base /treino-pwa/. O SW fica em espera nas atualizações, sem skipWaiting automático ou recarga durante edição. O botão Board UI Atualizar (mínimo 44 px) aparece quando há uma versão em espera e aplica a atualização ao toque; caches antigos são limpos na ativação. Isso evita misturar assets durante uma sessão. Manifest estático e ícones próprios incluem apple-touch 180, 192, 512 e maskable 512.

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

### Publicação do Pages, somente após merge

Somente após o APROVADO do Bari neste PR e merge: executar `npm run publicar:pages` com HOME falso e o mesmo node/npm do processo. Após `git fetch origin`, o script exige branch main, checkout limpo e SHAs main = origin/main. Valida previamente a identidade efetiva (`git var GIT_AUTHOR_IDENT` e `GIT_COMMITTER_IDENT`); com HOME falso, configure sua identidade git local antes, sem depender do HOME habitual. Executa `npm run check`, aborta se falhar e reconfere o checkout limpo antes do build; compila com base /treino-pwa/, publica dist e .nojekyll por push normal. Rejeições abortam. Em finally limpa somente o conteúdo da worktree exclusiva que criou, restaura um commit conhecido no índice/disco e desanexa a branch antes de remover a worktree sem --force. Só apaga a ref publicacao-pages-* se existir (branch órfã ainda sem commit não tem ref). Cada etapa de limpeza é independente; falhas informam o caminho sem mascarar o erro original. Testes exercitam apenas origins bare locais em rafa180-pub-sandbox; nenhuma publicação real foi executada.

Depois configurar no GitHub: Settings → Pages → Deploy from a branch → gh-pages → / (root). URL planejada: https://rafaeugenio.github.io/treino-pwa/. Nenhuma publicação ou configuração realizada neste PR. Actions sem cota; nenhum workflow criado.

## Gates

CAs são referenciados pelo contrato original, sem reescrita: [CA01, CA02, CA03, CA04, CA05, CA06, CA07 e CA08](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia). RAFA-180 cobre CA07 e prepara a base CA08; CA01–CA06 e todas as telas ficam nas próximas issues.

[Decisões D1, D2 e D3](https://linear.app/rafagg/issue/RAFA-176/criar-pwa-pessoal-de-treino-e-calistenia): aplicam-se as decisões do card; D3 substitui requisito 7. A regra de parada do projeto continua no card; esta subentrega termina em PR pronto para revisão. Merge exige Bari APROVADO no head exato e check local. Publicação somente depois do merge.

`npm run check`: oxlint, tsc -b, Vitest, build e Playwright. HOME falso obrigatório nesta execução. WebKit iPhone 15 e Chromium mobile testam manifest, metas, layout, persistência, SW ativo/escopo e reabertura offline. Instalação real pelo menu do Safari e display-mode do app instalado exigem verificação posterior no iPhone. O teste confere display standalone no manifest, sem afirmar instalação real. O teste offline roda em perfil persistente, como o app instalado, e reabre a página depois de 20 s sem nenhuma página aberta.

## Resultado

Repo: https://github.com/rafaeugenio/treino-pwa. Pages: URL planejada acima, ainda não publicada. Check e PR: resultados finais no relatório do autor e na seção Verification do PR. Instalação Safari: Compartilhar → Adicionar à Tela de Início; abrir uma vez conectado antes de usar offline. Apagar os dados do site remove o registro local.

### Rastreabilidade Board UI

Componentes existentes gerados com boardui@0.5.9. Esta entrega reutiliza Button de components/base/buttons/button, sem regenerar componentes. Comandos de validação: npm run check (wrapper rafa180-autor-env.cmd com HOME falso).

### Correções da revisão de publicação (F1 a F4)

Testes node incluem dist ausente, identidade ausente, hook de commit falho após cópia e check que suja checkout. Cada fixture criada é removida no fim. O sandbox padrão usa tmpdir(); nesta máquina, execute com $env:RAFA_PAGES_TEST_SANDBOX='C:\dev\Geral\tmp-harness\rafa180-pub-sandbox' antes do wrapper HOME falso. O teste SW gera o segundo build com configuração temporária e transformIndexHtml, sem reescrever index.html versionado, e remove seus builds temporários ao final.

### Reabertura offline no WebKit

Na rodada F1 a F4 o check falhou uma vez no WebKit ao reabrir offline (`FetchEvent.respondWith: Load failed`). Causa: o contexto efêmero do Playwright WebKit esvazia o Cache Storage do precache quando o origin fica sem páginas por alguns segundos, com o SW ainda ativo; offline, o Workbox não acha index.html e recorre à rede. Uma sonda com 20 s sem páginas falha do mesmo jeito em main 2b1b069 e em 2a234e1, passa no Chromium e passa nos dois motores com perfil persistente. O defeito era do teste, anterior a este PR. Correção: tests/pwa.spec.ts usa launchPersistentContext com o perfil do projeto, confere zero páginas abertas e espera 20 s antes de reabrir offline.
