# WhatsApp Bot with OpenAI Integration

A WhatsApp bot that uses OpenAI's API to provide intelligent responses in conversations, built with Node.js and the Baileys library.

## Features

- 🤖 OpenAI integration for natural language processing
- 💬 Group and private chat support
- 📝 Conversation history management
- 🔄 Automatic conversation summarization
- 💾 Periodic backups
- ⚡ Command system
- 🔐 Environment-based configuration

## Prerequisites

- Node.js v18 or higher
- WhatsApp account
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone https://github.com/mathazel/ZapIA.git
cd ZapIA
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
BOT_NUMBER=your_whatsapp_number
BOT_NAME=your_bot_name
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-3.5-turbo
```

## Usage

1. Start the bot:
```bash
node index.js
```

2. Scan the QR code with WhatsApp to authenticate

3. The bot will now respond to:
   - Direct messages
   - Group messages when mentioned
   - Replies to its messages

## Available Commands

- `/clear` - Clears conversation history
- `/ajuda` - Shows available commands

## Project Structure

```
WhatsAppBot/
├── src/
│   ├── config/
│   │   └── config.js
│   ├── core/
│   │   ├── conversation.js
│   │   └── message-handler.js
│   ├── services/
│   │   ├── conversationSummarizer.js
│   │   ├── openai.js
│   │   └── whatsapp.js
│   └── utils/
│       ├── fileManager.js
│       └── utils.js
├── data/
├── auth/
└── index.js
```

## Key Features Explained

- **Conversation Management**: Maintains conversation history with automatic cleanup
- **Message Summarization**: Intelligently summarizes long conversations to maintain context
- **Backup System**: Automatically creates backups of conversation history
- **Error Handling**: Robust error handling with automatic reconnection
- **Rate Limiting**: Implements rate limiting for API calls

## Dependencies

- [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [openai](https://github.com/openai/openai-node) - OpenAI API client
- [async-lock](https://github.com/rogierschouten/async-lock) - Async lock mechanism
- [dotenv](https://github.com/motdotla/dotenv) - Environment configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) for the WhatsApp Web API
- [OpenAI](https://openai.com/) for the language model API

## Support

For support, please open an issue in the GitHub repository.