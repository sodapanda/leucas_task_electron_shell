const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  ipcMain.handle("ping", () => "pong");
  ipcMain.handle("screenshot", async () => {
    const { createCanvas, loadImage } = require("canvas");
    const screenshot = require("screenshot-desktop");
    const fs = require("fs");
    const { v4: uuidv4 } = require("uuid");
    const axios = require("axios");

    const screens = await screenshot.listDisplays();
    const canvasWidth = 960;
    const canvasHeight = 540;
    // 创建画布
    const canvas = createCanvas(canvasWidth * screens.length, canvasHeight);
    const ctx = canvas.getContext("2d");

    // 截取每个屏幕的截图并拼接到画布上
    for (let i = 0; i < screens.length; i++) {
      const screen = screens[i];
      const imgData = await screenshot({ screen: screen.id, format: "png" });
      const img = await loadImage(imgData);
      const scaleFactor = Math.min(
        img.width / canvasWidth,
        img.height / canvasHeight
      );
      ctx.drawImage(
        img,
        i * canvasWidth,
        0,
        img.width / scaleFactor,
        img.height / scaleFactor
      );
    }

    const filename = uuidv4() + ".png";
    const out = fs.createWriteStream(filename);
    const stream = canvas.createPNGStream();

    await new Promise((resolve, reject) => {
      stream.pipe(out);
      out.on("finish", resolve);
    });

    const fileContent = fs.readFileSync(filename);

    const options = {
      method: "post",
      url: "http://192.168.2.102:7080/upload",
      headers: {
        "Content-Type": "image/png",
        "Content-Length": fileContent.length,
      },
      data: fileContent,
    };

    const response = await axios(options);
    console.log(`statusCode: ${response.status}`);
    console.log(`body: ${response.data}`);
    console.log("File upload completed.");
    fs.unlinkSync(filename);

    return response.data;
  });

  // and load the index.html of the app.
  mainWindow.loadURL("https://task.leucas.io");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
