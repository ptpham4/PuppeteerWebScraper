"use strict";
import { createWriteStream, existsSync } from 'fs';
import { resolve as _resolve, join as _join } from 'path';
import axios from 'axios';


export default class Downloader {
    constructor(targetURL, filePath, fileExtension) {
        this.setTargetURL(targetURL);
        this.setFilePath(filePath, fileExtension);
    }

    setTargetURL(targetURL) {
        this.targetURL = targetURL;
    }

    setFilePath(filePath, fileExtension) {
        if (filePath && fileExtension) {
            let i = 1;
            while (existsSync(filePath + '(' + i.toString() + ')' + fileExtension))
            {
                i++;
            }
            this.filepath = filePath + '(' + i.toString() + ')' + fileExtension;
        }
        else {
            this.filepath = _resolve(__dirname, this.targetURL.split('/').pop());
        }
    }

    async download() {
        const fileWriter = createWriteStream(this.filepath);
        const response = await axios({
            url: this.targetURL,
            method: 'GET',
            responseType: 'stream'
        });
        response.data.pipe(fileWriter);
        return new Promise((resolve, reject) => {
            fileWriter.on('finish', () => {
                resolve();
            });
            fileWriter.on('error', (err) => {
                reject(err); 
            });
        });
    }
}