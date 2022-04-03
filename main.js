'use strict';
const {app, BrowserWindow, ipcMain, shell, globalShortcut, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const {autoUpdater} = require('electron-updater');

const {Updater} = require('./lib/updater');
const {AppConfig} = require('./lib/config');
const {Networking} = require('./lib/networking');
const {UnrealModLoader} = require('./lib/unrealmodloader');

const config = new AppConfig();
config.getConfig();

const networking = new Networking();

/*
 * check if app is called through protocol or not
 */

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('electron-test', process.execPath, [path.resolve(process.argv[1])])
    }
} else {
    app.setAsDefaultProtocolClient('electron-test')
}

// Get instance lock
const gotTheLock = app.requestSingleInstanceLock()

let mainWindow;

/*
 * If lock is not set, we quit, else we either focus on existing instance
 * or we launch a fresh instance if no first instance
 */

if (!gotTheLock) {
    app.quit()
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore()
            mainWindow.focus()
        }
    })

    // Create mainWindow, load the rest of the app, etc...
    app.on("ready", loadMainWindow);

    app.on('open-url', (event, url) => {
        console.log("test");
    })
}

function getMods(path, content) {
    let all_mods = [];
    if (content != null)
        for (const folder of content) {
            let file = path + folder + '/module.json';
            if (fs.existsSync(file)) {
                let text = fs.readFileSync(file, 'utf8');
                all_mods.push(text);
            }
        }
    return all_mods;
}

/**
 * Scan mod directories to find all installed mods to load module.json and store result in array.
 * load html file with args stringify when needed, and send them through querystring
 */

function scanDirectories(mainWindow, remote_mods_list, pathToFiles) {
    if (pathToFiles !== "") {
        let coremods_path = pathToFiles + 'CoreMods\\';
        let paks_path = pathToFiles + 'Paks\\';
        let all_mods = [];
        let CoreMods;
        let Paks;

        try {
            CoreMods = fs.readdirSync(coremods_path);
            Paks = fs.readdirSync(paks_path);
        } catch (e) {
            dialog.showErrorBox('error', e);
        }

        all_mods = all_mods.concat(getMods(coremods_path, CoreMods));
        all_mods = all_mods.concat(getMods(paks_path, Paks));

        mainWindow.loadFile(path.join(__dirname, 'public/index.html'), {
            query: {
                "data": JSON.stringify(all_mods),
                "version": app.getVersion(),
                "remote_mods_list": JSON.stringify(remote_mods_list),
            }
        });
    } else {
        mainWindow.loadFile(path.join(__dirname, 'public/index.html'), {
            query: {
                "error": "No path defined",
                "version": app.getVersion()
            }
        });
    }

    globalShortcut.register('f5', function () {
        app.relaunch();
        app.exit(0);
    });
    globalShortcut.register('CommandOrControl+R', function () {
        app.relaunch();
        app.exit(0);
    });
}

async function checkUnrealModLoader() {
    if (config.data.pathtogame === '')
        return;

    let unreal_remote_info = await networking.get('https://raw.githubusercontent.com/Longvinter-Modtools/UnrealModLoader/main/unrealmodloader/module.json');
    let unreal_path = config.data.pathtogame.split('\\');

    const unreal = new UnrealModLoader();

    unreal_path = unreal.pop_array(unreal_path, 3);
    unreal_path = path.join.apply(null, unreal_path) + '\\Longvinter\\Binaries\\Win64';

    let unreal_path_core = unreal_path + '\\unrealmodloader';

    unreal.checkXinput(unreal_path + '\\xinput1_3.dll');

    await unreal.checkUnrealFolder(unreal_path_core);
    await unreal.finalize(unreal_remote_info.servers[0], unreal_path + '\\', unreal_remote_info.version);
    await unreal.checkProfile(unreal_path_core + '\\Profiles');

    unreal.checkModLoaderInfoRoot(unreal_path);
    unreal.checkModLoader(unreal_path_core + '\\ModLoaderInfo.ini');
    return unreal_remote_info.version;
}

/**
 * Create the window
 * Retrieve list of all mods from linked Github repo
 * create IPC channels to listen to for available self-updates / software env query
 */

async function loadMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        enableRemoteModule: true,
        autoHideMenuBar: true,
    });

    const ses = mainWindow.webContents.session;
    ses.clearCache();

    let remote_mods_list = await networking.get('https://raw.githubusercontent.com/tsukasaroot/longvinter-mods/main/modules-list.json');
    await scanDirectories(mainWindow, remote_mods_list, config.data.pathtogame);

    mainWindow.once('ready-to-show', () => {
        autoUpdater.checkForUpdatesAndNotify();
    });
}

autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('ispackaged', () => {
    mainWindow.webContents.send('ispackaged', app.isPackaged);
});

/**
 * Called by update / install ipcMain to update or install a mod on user machine
 * arg is a stringify JSON containing the mod's informations
 */

async function retrieval(args, mp) {
    args = JSON.parse(args);
    let updater = new Updater(args.servers[0], mp);
    let manifest = await updater.getManifest();
    return await updater.downloadManifestFiles(args.name.toLowerCase(), args.category, manifest.files);
}

/**
 * Called by uninstall ipcMain to remove a mod on user machine
 * arg is a stringify JSON containing the mod's informations
 */

async function uninstall(args) {
    args = JSON.parse(args);

    if (args.category === 'coremods')
        args.category = 'CoreMods';
    if (args.category === 'paks')
        args.category = 'Paks';

    fs.rmSync(config.data.pathtogame + args.category + '\\' + args.name.toLowerCase(), {recursive: true, force: true});
}

app.disableHardwareAcceleration();

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        loadMainWindow();
    }
});

ipcMain.on('restart_app', () => {
    autoUpdater.quitAndInstall();
});

ipcMain.on('update', async (event, args) => {
    let response = await retrieval(args, config.data.pathtogame);
    event.reply('update', args, response);
});

ipcMain.on('install', async (event, args) => {
    let response = await retrieval(args, config.data.pathtogame);
    event.reply('install', args, response);
});

ipcMain.on('uninstall', async (event, args) => {
    await uninstall(args);
    event.reply('uninstall', args);
});

ipcMain.on('refresh', () => {
    app.relaunch();
    app.exit(0);
});

ipcMain.on('add-game-path', (event, path) => {
    config.setConfig('pathtogame', path);
    console.log(path + 'CoreMods')
    if (!fs.existsSync(path + 'CoreMods')) {
        fs.mkdirSync(path + 'CoreMods');
    }
    event.reply('add-game-path');
})

ipcMain.on('shell:open', () => {
    const pageDirectory = __dirname.replace('app.asar', 'app.asar.unpacked')
    const pagePath = path.join('file://', pageDirectory, 'index.html')
    shell.openExternal(pagePath)
})

ipcMain.on('unrealmodloader-check', async (event, arg) => {
    let version = await checkUnrealModLoader();
    event.reply('unrealmodloader-check', version);
})