# ZapIA

Este projeto implementa um bot para WhatsApp que utiliza a API da OpenAI para gerar respostas naturais e a API do OpenWeather para fornecer informações sobre o clima. O bot é projetado para se comportar como uma pessoa real, mantendo conversas fluidas e respondendo a consultas de maneira amigável e contextual.

## Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Requisitos](#requisitos)
- [Configuração](#configuração)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Funciona](#como-funciona)
- [Comandos Disponíveis](#comandos-disponíveis)
- [Tratamento de Erros](#tratamento-de-erros)
- [Manutenção e Backup](#manutenção-e-backup)

## Visão Geral

Este bot utiliza a biblioteca `@whiskeysockets/baileys` para se conectar ao WhatsApp, a API da OpenAI para processar e responder mensagens, e a API do OpenWeather para fornecer informações meteorológicas quando solicitado. O bot mantém um histórico de conversas para cada usuário, permitindo respostas contextuais e naturais.

## Funcionalidades

- **Conversação Natural**: Responde como uma pessoa real utilizando a API da OpenAI
- **Consulta de Clima**: Fornece informações meteorológicas para cidades especificadas
- **Gerenciamento de Conversas**: Armazena histórico de conversas para manter contexto
- **Comandos Úteis**: Suporta comandos como `/limpar` e `/ajuda`
- **Suporte a Grupos**: Responde quando mencionado ou em resposta a mensagens anteriores
- **Reconexão Automática**: Implementa estratégia de reconexão em caso de queda de conexão
- **Backup Automático**: Cria backups periódicos do histórico de conversas

## Requisitos

- Node.js (v14 ou superior)
- Conta na API da OpenAI
- Chave de API do OpenWeather (opcional)
- Acesso à internet

## Configuração

1. Clone o repositório
2. Instale as dependências:

```bash
npm init -y
npm install axios openai @whiskeysockets/baileys dotenv async
```

3. Execute o bot:

```bash
node index.js
```

4. Escaneie o código QR que aparecerá no terminal com seu WhatsApp

## Estrutura do Projeto

```
├── index.js                           # Ponto de entrada
├── src/
│   ├── services                       # Gerenciador de resumo dinâmico de conversas
│   │   └── conversationSummarizer.js  # Gera resumos de conversas
│   ├── config.js                      # Configurações e variáveis de ambiente
│   ├── conversation.js                # Gerenciamento de histórico de conversas
│   ├── message-handler.js             # Processamento de mensagens
│   ├── openai.js                      # Integração com API da OpenAI
│   ├── utils.js                       # Funções utilitárias
│   ├── weather.js                     # Integração com API do OpenWeather
│   └── whatsapp.js                    # Conexão com WhatsApp
├── data/
│   ├── conversationHistory.json  # Armazenamento de histórico
│   └── processedMessages.json    # Registro de mensagens processadas
└── auth/                     # Arquivos de autenticação do WhatsApp
```

## Como Funciona

### Fluxo Principal

1. **Inicialização**: O sistema carrega o histórico de conversas e se conecta ao WhatsApp
2. **Recebimento de Mensagens**: As mensagens são recebidas e filtradas:
   - Em chats privados, todas as mensagens são respondidas
   - Em grupos, apenas mensagens que mencionam o bot ou respondem a mensagens dele são processadas
3. **Processamento de Mensagens**:
   - Verifica se é um comando (ex: `/limpar`)
   - Verifica se é uma consulta sobre o clima
   - Caso contrário, processa com a API da OpenAI
4. **Resposta**: A mensagem gerada é enviada de volta ao usuário

### Gerenciamento de Conversas

- **Histórico**: Cada usuário tem seu próprio histórico de conversas armazenado
- **Limitação de Tamanho**: O histórico é limitado a um número máximo de mensagens
- **Limpeza Automática**: Históricos antigos são removidos periodicamente
- **Backups**: O sistema cria backups regulares para evitar perda de dados

### Integração com APIs

- **OpenAI**: Utiliza o modelo configurado para gerar respostas naturais
- **OpenWeather**: Busca informações meteorológicas para cidades específicas

## Comandos Disponíveis

- `/limpar`: Limpa o histórico de conversa atual
- `/ajuda`: Exibe uma mensagem com comandos disponíveis

## Tratamento de Erros

- **Reconexão Automática**: Em caso de desconexão, tenta reconectar automaticamente
- **Sistema de Retry**: Implementa tentativas com backoff exponencial nas chamadas à API
- **Validação de Dados**: Verifica se as variáveis de ambiente necessárias estão configuradas
- **Tratamento de Exceções**: Captura e trata erros durante o processamento de mensagens

## Manutenção e Backup

- **Limpeza Periódica**: Remove históricos de conversas inativas após um dia
- **Backup Automático**: Cria backups do histórico a cada 12 horas
- **Gestão de Arquivos**: Utiliza arquivos temporários para evitar corrupção de dados
- **Limitação de Uso**: Gerencia o uso de tokens da API para evitar custos excessivos

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
