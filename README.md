<p align="center">
  <img src="mushi.png" alt="mushi" width="320">
</p>

# Mushi

Mushi is a simple, lightweight, and modular WhatsApp bot written in JavaScript using the [Baileys](https://github.com/WhiskeySockets/Baileys) library. It is designed to be cross-runtime, supporting Deno, Bun, and Node.js.

> [!WARNING]
> This project is still in development and may not work as expected.

## Features

- **Multi-Runtime Support**: Runs seamlessly on Deno 2+, Bun 1.3+, and Node.js 23+.
- **AI Integration**: Powered by Google Gemini with advanced features like automatic model switching on rate limits.
- **Media Downloader**: Integrated with yt-dlp for downloading content from various social media platforms.
- **Games**: Includes interactive games like Asah Otak, Caklontong, Math, and more.
- **Defense and Security**: Built-in spam message detectors and auto-reject call features for protection.
- **Utility Tools**: Translation, Speedtest, system statistics, and custom shell/eval commands for developers.
- **User Management**: Already built-in user management that come with system roles and permissions.
- **Modular Plugins**: Easily extendable plugin system.

## Prerequisites

Ensure you have one of the following runtimes installed:
- [Node.js](https://nodejs.org/) 23+ (Recommended)
- [Bun](https://bun.sh/) 1.3+ 
- [Deno](https://deno.com/) 2.0+

## Configuration

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ginkohub/mushi.git
   cd mushi
   ```

2. **Setup environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit .env and fill in your details:
   - PHONE: Your WhatsApp number (including country code e.g.: 628xxxx).
   - METHOD: Connection method (`otp` or `qr`).
   - SESSION: Path to session storage (e.g., sqlite: `data/session1.db`, folder: `data/session2/`).
   - GEMINI_API_KEY: Your Google Gemini API key.

## Getting Started
### Using Node.js
```bash
npm install
npm start
```

### Using Bun (Fastest)
```bash
bun install
bun run --watch example.js  
```


### Using Deno
```bash
deno run --allow-all --watch=./src example.js
```

## Development

Run with auto-reload (src):
```bash
npm run dev
```

### Code Quality
This project uses [Biome](https://biomejs.dev/) for linting and formatting:
```bash
npm run lint
npm run format
```

## License
This project is licensed under the [Mozilla Public License 2.0](LICENSE).
