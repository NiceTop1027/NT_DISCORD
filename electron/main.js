const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;

// 외부 링크 처리
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Google OAuth URL인 경우 새 BrowserWindow에서 열기
    if (url.includes('accounts.google.com')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 600,
          webPreferences: {
            sandbox: false,
          }
        }
      };
    }
    return { action: 'allow' };
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      sandbox: false, // Google OAuth를 위해 sandbox 비활성화
      webSecurity: true,
    },
    backgroundColor: '#202225',
    title: 'NiceTop',
  });

  // Load the app
  if (isDev) {
    const devServerPort = process.env.VITE_PORT || 5173;
    mainWindow.loadURL(`http://localhost:${devServerPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // Set Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = {
      ...details.responseHeaders,
      'Content-Security-Policy': [
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://*.firebaseio.com https://www.googletagmanager.com; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https: blob:; " +
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://accounts.google.com wss://*.firebaseio.com https://*.cloudfunctions.net https://www.google-analytics.com; " +
        "font-src 'self' data:; " +
        "media-src 'self' blob:; " +
        "frame-src https://accounts.google.com https://*.firebaseapp.com https://*.firebaseio.com;"
      ]
    };

    // Remove Cross-Origin-Opener-Policy header
    delete responseHeaders['cross-origin-opener-policy'];
    delete responseHeaders['Cross-Origin-Opener-Policy'];

    callback({ responseHeaders });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
