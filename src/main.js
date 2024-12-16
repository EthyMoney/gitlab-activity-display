import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import fetch from 'node-fetch';
import config from '../config.json';

console.log('config:', config);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 480,
    height: 320,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: __dirname + '/favicon.ico', // gets brought into the build by vite (as configured in vite.main.config.mjs)
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