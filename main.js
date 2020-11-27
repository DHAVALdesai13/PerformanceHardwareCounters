const { app, BrowserWindow } = require('electron');
const path = require("path");

function createWindow() {
    const win = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true
        }
    });
    win.loadFile("index.html");
  //  if (process.argv.length >= 3) {
  //      let file_path = path.resolve(process.argv[2]);
  //      win.webContents.on("did-finish-load", () => {
  //          win.webContents.executeJavaScript("initial_draw('" + file_path + "')");
  //      });
  //  }
      let file_path = 'bperf_output.csv';
      win.webContents.on("did-finish-load", () => {
      win.webContents.executeJavaScript("initial_draw('" + file_path + "')");
        });

    win.maximize();
    //win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});