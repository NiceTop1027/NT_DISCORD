# Discord Clone PC Application

A desktop application built with Electron, React, and Firebase that replicates Discord's core features including text chat, voice chat, and server/channel management.

## 🚀 Features

- **User Authentication**: Email/password + Google OAuth
- **Server Management**: Create, join, and manage servers with role-based permissions
- **Channel System**: Text and voice channels with real-time updates
- **Text Chat**: Real-time messaging with file uploads, markdown support, and message editing
- **Voice Chat**: WebRTC-based voice communication with multiple participants
- **Dark Mode**: Discord-style dark theme
- **Desktop App**: Native Electron application for Windows and macOS

## 📦 Tech Stack

- **Frontend**: React 18 + TailwindCSS
- **Desktop**: Electron 28+
- **Backend**: Firebase (Auth, Firestore, Storage, Realtime Database)
- **State Management**: Zustand
- **Voice**: WebRTC
- **Build Tool**: Vite

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- Firebase project ([Create one](https://console.firebase.google.com/))

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd NiceTop-Discord
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase credentials from Firebase Console

4. Setup Firebase services:
   - Enable Authentication (Email/Password + Google)
   - Create Firestore database
   - Enable Storage
   - Enable Realtime Database

## 🏃 Running the App

### Development Mode

```bash
npm run dev
```

This will start:
- Vite dev server on `http://localhost:5173`
- Electron app window

### Build for Production

```bash
# Build for current platform
npm run build

# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win
```

## 📁 Project Structure

```
├── electron/                 # Electron main process files
│   ├── main.js              # Main process entry
│   └── preload.js           # Preload script with context bridge
├── src/
│   ├── components/          # React components
│   │   ├── auth/           # Login, Register, Profile
│   │   ├── server/         # Server list, server settings
│   │   ├── channel/        # Channel list, channel creation
│   │   ├── chat/           # Chat window, messages
│   │   ├── voice/          # Voice channel UI
│   │   ├── layout/         # Main layout components
│   │   └── common/         # Reusable components
│   ├── services/           # Business logic
│   ├── store/              # Zustand state management
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utilities and helpers
│   ├── types/              # TypeScript types
│   ├── styles/             # Global styles
│   ├── App.jsx             # Root component
│   └── main.jsx            # React entry point
├── tests/                   # Test files
├── firebase/                # Firebase configuration files
└── public/                  # Static assets
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run Firebase emulators
npm run firebase:emulators
```

## 📝 Environment Variables

See `.env.example` for required environment variables.

## 🔒 Security

- Context isolation enabled in Electron
- Node integration disabled
- Firebase security rules implemented
- Content Security Policy (CSP) configured

## 📖 Documentation

- [Implementation Plan](./specs/001-discord-pc-firebase/plan.md)
- [Data Model](./specs/001-discord-pc-firebase/data-model.md)
- [API Contracts](./specs/001-discord-pc-firebase/contracts/)
- [Task List](./specs/001-discord-pc-firebase/tasks.md)

## 🤝 Contributing

This is a learning project. Feel free to fork and experiment!

## 📄 License

MIT

## 🎯 Roadmap

- [x] Project setup
- [ ] Authentication system
- [ ] Server/channel management
- [ ] Text chat
- [ ] Voice chat
- [ ] File uploads
- [ ] Notifications
- [ ] Mobile PWA support
