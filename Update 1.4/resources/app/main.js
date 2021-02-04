const {remote, app, BrowserWindow, ipcMain, Menu, Tray} = require('electron');
const path = require('path');
const {exec} = require('child_process');
const fs = require('fs-extra');

if (process.mas) app.setName('Web API Client');
let mainWindow = null;
let appIcon = null;
let Avatar;

// Patch ffmplay
process.env.SDL_AUDIODRIVER="directsound";

//delete process.env.ELECTRON_ENABLE_SECURITY_WARNINGS;
//process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true;

function initialize () {
	makeSingleInstance()

  function createWindow () {
    const windowOptions = {
      frame: false,
      resizable: false,
      show: true,
      width: 441,
      height: 330,
      alwaysOnTop: true,
      title: 'Web API Avatar Client Welcome',
      icon: 'resources/app/images/Avatar.png',
      webPreferences: {
        nodeIntegration: true
      }
    }

    mainWindow = new BrowserWindow(windowOptions)
    mainWindow.loadFile('assets/html/main.html');

    mainWindow.setMenu(null);
    // mainWindow.openDevTools();
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    })

    mainWindow.once('show', () => {
    })

    mainWindow.on('closed', () => {
      ipcMain.removeAllListeners('welcomeHide');
      ipcMain.removeAllListeners('quit');
      ipcMain.removeAllListeners('OnTop');
      mainWindow = null;
    })

    ipcMain.on('welcomeHide', (event) => {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.hide();
      event.returnValue = true;
    })

    ipcMain.on('OnTop', (event) => {
      mainWindow.setAlwaysOnTop(false);
      event.returnValue = true;
    })

    ipcMain.on('quit', (event) => {
		event.returnValue = true;
		setTimeout(() => {
			app.quit();
		},1000)
    })

  }

  app.on('ready', () => {
    createWindow()
    setTray();
  })

  app.on('window-all-closed', () => {
    if (appIcon) appIcon.destroy()
    if (process.platform !== 'darwin') {
      app.quit();
    }
  })

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow()
    }
  })
}



function makeSingleInstance () {
  if (process.mas) return;

  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })
  }
}

function setTray() {

  const iconName = 'Avatar-tray.png'
  const iconPath = path.join(__dirname, 'assets', 'images', iconName)
  appIcon = new Tray(iconPath)
  let prop = fs.readJsonSync('./resources/app/Avatar.config', { throws: false });
  let showed;
  const contextMenu = Menu.buildFromTemplate(
    [
      {
        label: "Ouvrir/Fermer Infos Serveur",
        click: () => {
          if (!showed) {
            mainWindow.show();
            if (!mainWindow.isFocused()) mainWindow.focus();
            showed = true;
          } else {
            mainWindow.hide();
            showed = false;
          }
        }
      },
      {type: 'separator'},
      {
        label: 'Quitter',
        click: () => {
          let cmd = path.resolve (__dirname+"/core/lib/nircmd/nircmd");
          exec(cmd+' win close title "'+prop.name+' v'+prop.version+'"', (err, stdout, stderr) => {
            app.quit();
        	});
        }
      }

    ]
  )

  appIcon.setToolTip(prop.name)
  appIcon.setContextMenu(contextMenu)

}

initialize ()
