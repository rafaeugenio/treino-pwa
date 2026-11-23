# Treino

PWA pessoal com dados somente neste dispositivo.

```sh
npm ci
npm run dev
npm run check
```

O check inclui build e Playwright; instale os navegadores com `npx playwright install webkit chromium`. Abra `/treino-pwa/` no servidor local. No ambiente do autor todos os comandos npm usam o wrapper de HOME falso indicado no relatório.

No Safari do iPhone: Compartilhar → Adicionar à Tela de Início. Abra uma vez conectado para preparar o uso offline. Limpar os dados do site apaga os registros.

Após merge aprovado: `npm run publicar:pages`. Em Settings → Pages configure `gh-pages` / raiz. O script cria commit de build e faz push normal; não foi executado nesta entrega.

[SDD](docs/sdd/2026-11-23-treino-pwa/README.md). URL planejada: https://rafaeugenio.github.io/treino-pwa/.
