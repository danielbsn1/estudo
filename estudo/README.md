# Diário de Estudos

App estático (HTML/CSS/JS puro, sem build) para cadastrar campos de estudo, cronometrar sessões de foco e registrar o que você estudou. Os dados ficam salvos no `localStorage` do navegador — não há backend.

## Rodar localmente

Abra `index.html` direto no navegador, ou sirva a pasta:

```bash
npx serve .
```

## Deploy na Vercel

Sem necessidade de build. Duas opções:

**CLI** (mais rápido, sem precisar de repositório git):

```bash
cd estudo
npx vercel
```

Confirme o diretório atual, escolha "Other" como framework (ou deixe detectar automaticamente) e aceite as opções padrão — a Vercel serve os arquivos estáticos como estão.

**Dashboard**: suba esta pasta para um repositório no GitHub e importe em vercel.com/new. Framework Preset: "Other". Nenhuma variável de ambiente ou comando de build é necessário.
