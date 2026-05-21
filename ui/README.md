# Mushi API Bot Manager UI

A professional, compact, and industrial-grade dashboard built with **Svelte 5** to manage your WhatsApp bot instances via the Mushi API.

![Version](https://img.shields.io/badge/version-1.0.2-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MPL--2.0-orange?style=flat-square)
![Framework](https://img.shields.io/badge/framework-SvelteKit%205-ff3e00?style=flat-square)

## 🛠 Features

- **Industrial UI**: Compact, non-rounded, and high-density design optimized for monitoring.
- **Real-time Dashboard**: Live monitoring of active bots, memory usage, and system status.
- **Bot Registry**: Full lifecycle management (Register, Start, Stop, Delete).
- **Authentication Handlers**: Built-in support for QR Code scanning and Pairing Code (OTP) verification.
- **Diagnostic Logs**: Per-bot real-time log viewer with a 50-line buffer.
- **System Architecture**: Detailed hardware and software metrics (CPU, RAM, Runtime, Kernel).
- **Module Registry**: Detailed view of registered plugins, categories, and commands.

## 🚀 Getting Started

### Prerequisites

- Node.js (v20.19.0, v22.13.0, or >=24 recommended)
- Mushi Backend running on port `6867` (configurable)

### Installation

1. Clone the repository and navigate to the `ui` directory:
   ```bash
   cd ui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

## ⚙️ Configuration

The UI is pre-configured to proxy API requests to `http://localhost:6867`. To change the backend address or port, modify `vite.config.ts`:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:YOUR_PORT',
        changeOrigin: true
      }
    }
  }
});
```

## 🏗 Project Structure

- `src/lib/api.ts`: Typed API client for backend communication.
- `src/routes/`:
  - `+page.svelte`: Main system dashboard.
  - `bots/`: Bot registration and management list.
  - `bots/[id]/`: Detailed view with pairing UI and logs.
  - `settings/`: Hardware metrics and plugin registry.

## 📄 License

Distributed under the **Mozilla Public License, v. 2.0**. See `LICENSE` for more information.

---
Built with ⚡ by **Ginko**
