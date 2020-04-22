"use strict";
import puppeteer from 'puppeteer';
import { join as _join } from 'path';
import Downloader from './downloader.js';
require('dotenv').config();

export class Authenticator {
    constructor(targetURL, account, controllers) {
        this.setTargetURL(targetURL);
        this.setCredentials(account);
        this.setFormControllers(controllers);
    }
    setTargetURL(targetURL) {
        if (targetURL)
            this.targetURL = targetURL;
        else
            this.targetURL = undefined;
    }
    setCredentials(account) {
        this.username = account.username;
        this.password = account.password;
    }
    setFormControllers(controllers) {
        this.usernameInputId = controllers.usernameInputId;
        this.passwordInputId = controllers.passwordInputId;
        this.loginButtonId = controllers.loginButtonId;
    }
    isAuthenticable() {
        return this.targetURL !== undefined;
    }
    async authenticate(page) {
        if (this.isAuthenticable()) {
            try {
                if (page === undefined) {
                    const browser = await puppeteer.launch();
                    page = await browser.newPage();
                }
                await page.goto(this.targetURL);
                await page.type(this.usernameInputId, this.username);
                await page.type(this.passwordInputId, this.password);
                await page.click(this.loginButtonId);
                return true;
                // How to wait until the system has logged me in?
            }
            catch (err) {
                console.log(err);
                return false;
            }
        }
    }
}


export default class Scraper {
    constructor(targetURL, needAuth = false) {
        this.setTargetURL(targetURL);
        this.needAuth = needAuth;
    }
    setTargetURL(targetURL) {
        if (targetURL)
            this.targetURL = targetURL;
        else
            this.targetURL = undefined;
    }
    isScrapable() {
        return this.targetURL !== undefined;
    }
}


export class VideoScraper extends Scraper {
    constructor(targetURL, controllers, storageFolder, needAuth = false) {
        super(targetURL, needAuth);
        this.setStorageFolder(storageFolder);
        this.setControllers(controllers);
    }

    setStorageFolder(storageFolder) {
        this.storageFolder = storageFolder;
    }

    setControllers(controllers) {
        this.videoId = controllers.videoId;
        this.titleClassname = controllers.titleClassname;
        this.videoExtension = controllers.videoExtension;
        this.auth = controllers.auth;
    }

    async getFilePath(page) {
        try {
            let filename = await page.$$eval(this.titleClassname, (titles) => {
                let name = "";
                for (let i = 0; i < titles.length; i++) {
                    name += titles[i].innerText.split(" ").join('');
                    if (i != titles.length - 1)
                        name += "_";
                }
                return name;
            });
            return _join(this.storageFolder, filename);
        } catch (err) {
            console.log(err);
            return _join(this.storageFolder, filename);
        }
    }

    async scrape() {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        var source, filepath;
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36');

        if (this.needAuth) {
            try {
                let authenticator = new Authenticator(this.auth.loginURL, this.auth.account, this.auth.controllers);
                let authSuccess = await authenticator.authenticate(page);
                if (authSuccess) {
                    await page.waitFor(5000);
                    console.log("Authentication succeeded!");
                }
                else {
                    console.log("Failed to authenticate user.");
                    await browser.close();
                    return false;
                }
            }
            catch (err) {
                console.log("Failed to authenticate user: ", err);
                await browser.close();
                return false;
            }
        }
        try {
            await Promise.all([
                page.goto(this.targetURL),
                page.waitForNavigation(),
                page.waitFor(this.videoId),
                page.waitFor(this.titleClassname)
            ]);
            source = await page.$eval(this.videoId, video => video.src);
            filepath = await this.getFilePath(page);
            console.log("Scraped successfully!");
        }
        catch (err) {
            console.log("Failed to scrape video(s): ", err);
            await browser.close();
            return false;
        }
        try {
            let videoDownloader = new Downloader(source, filepath, this.videoExtension);
            await videoDownloader.download();
            console.log("Downloaded videos successfully!");
        }
        catch (err) {
            console.log("Failed to download video(s): ", err);
            await browser.close();
            return false;
        }

        await browser.close();
        return true;
    }
}