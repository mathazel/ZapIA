# WhatsApp Bot

## Introduction

O projeto "WhatsApp Bot" foi criado para automatizar interações no WhatsApp usando inteligência artificial. O bot utiliza a API da OpenAI para gerar respostas naturais e conversacionais, podendo ser usado tanto em conversas privadas quanto em grupos.

## Getting Started

1. Ajustar as variáveis de ambiente no arquivo `.env`:

   - BOT_NAME: Nome que o bot utilizará
   - OPENAI_API_KEY: Sua chave da API da OpenAI
   - BOT_NUMBER: Número do WhatsApp do bot
   - CONVERSATION_HISTORY_PATH="\data"

2. Instalar dependências e iniciar:
```bash
npm install
node index.js
```

3. Escanear o QR Code que aparecerá no terminal com seu WhatsApp

## Contribute

Esse projeto foi feito para simplificar interações via WhatsApp usando IA. A escolha das tecnologias (Node.js, Baileys, OpenAI) foi feita visando simplicidade e eficiência na implementação.

## Comandos

- `/limpar` - Limpa histórico
- `/ajuda` - Lista comandos

## Licença

MIT