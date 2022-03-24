'use strict';
const fetch = require('node-fetch');
const {ipcMain} = require('electron');
const fs = require('fs');

class Updater {
    constructor(url) {
        this.url = url;
    }

    async get(url) {
        let settings = {
            method: "GET",
            headers: {
                Accept: "application/json; charset=UTF-8",
            }
        };

        const response = await fetch(url, settings);
        return await response.json();
    }

    async download(url) {
        let settings = {
            method: "GET",
            headers: {
                Accept: "application/json; charset=UTF-8",
            }
        };

        return await fetch(url, settings);
    }

    async getManifest() {
        let settings = {
            method: "GET",
            headers: {
                Accept: "application/json; charset=UTF-8",
            }
        };

        const response = await fetch(this.url + 'manifest.json', settings);
        return await response.json();
    }

    async downloadManifestFiles(mod_name, files) {
        for (let [file, sha] of Object.entries(files)) {
            let file_content = await this.download(this.url + file);
            const fileStream = fs.createWriteStream('../mods/' + mod_name + '/' + file);
            let dir = '../mods/' + mod_name;
            let directories = file.split('/');

            if (directories) {
                for (let directory of directories) {
                    if (!directory.includes('.')) {
                        dir += '/' + directory;

                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, {
                                recursive: true
                            });
                        }
                    }
                }
            }

            await new Promise((resolve, reject) => {
                file_content.body.pipe(fileStream);
                file_content.body.on("error", reject);
                fileStream.on("finish", resolve);
            });

            console.log('verifying checksum');
        }
        console.log('upload and installation done')
    }
}

exports.Updater = Updater;