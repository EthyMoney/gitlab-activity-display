import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fetch from 'node-fetch';
import config from '../config.json';

const currentTime = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
console.log('Application attempting to start...', currentTime);

// GPU acceleration flags optimized for Raspberry Pi 2
// Pi 2 has limited GPU capabilities, so we use conservative settings
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-gpu-compositing');
app.commandLine.appendSwitch('enable-accelerated-2d-canvas');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Determine the correct icon path for both dev and production
  let iconPath;
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Development mode
    iconPath = path.join(__dirname, '..', 'favicon.ico');
  } else {
    // Production mode - icon should be in the same directory as main.js
    iconPath = path.join(__dirname, 'favicon.ico');
  }

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 480,
    height: 320,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: iconPath,
    fullscreen: true, // Optional: Open the window in fullscreen mode
    frame: false // Optional: Remove window frame if desired (needs to be false to hide mouse cursor)
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // remove the menu
  mainWindow.removeMenu();

  // Remove the DevTools for a cleaner display.
  // mainWindow.webContents.openDevTools();
};

// Fetch the feed and send it to the renderer process
ipcMain.handle('fetch-feed', async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // allow self-signed certificates
  const feedUrl = config.gitlabFeedUrl;
  const response = await fetch(feedUrl);
  if (!response.ok) {
    throw new Error(`Network response was not ok: ${response.statusText}`);
  }
  const text = await response.text();
  return text;
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // Log that the application has started and show the current time in 12-hour AM/PM format
  const currentTime = new Date().toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true });
  console.log(`Application started at ${currentTime}`);

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});