import * as cp from "child_process";
import * as os from "os";
import * as path from "path";
import * as readline from "readline";
import * as vscode from "vscode";
import { execute, log, memoizeAsync } from "./util";

import * as fs from 'fs';
import * as https from 'https';


import fetch from 'node-fetch';
import { ClientRequest } from 'http';
import { isDirAtUri, isFileAtUri } from "./toolchain";




export type PackageInfo = {
    pkgName: string;
    label: string;
    file: string;
    description: string;
    ver: string;
    repo: string;
}

export type PackagesFile = {
    packages: PackageInfo[];
}


export type PackageVersions = {
    versions: PackageInfo[];
}






export async function installPackage(packageInfo: PackageInfo): Promise<boolean> {


    let homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir();

    const tmpDir = vscode.Uri.joinPath(
        vscode.Uri.file(homeDir),
        ".eec-tmp"
    );

    const tmpFilePath = vscode.Uri.joinPath(
        vscode.Uri.file(homeDir),
        ".eec-tmp", `${packageInfo.file}.zip`
    );


    const toolchainDirPath = vscode.Uri.joinPath(
        vscode.Uri.file(homeDir)
    );

    if (!(await isDirAtUri(tmpDir))) {
        await vscode.workspace.fs.createDirectory(tmpDir).then(() => { }, () => {
            console.log('Create dir error!');
        });
    }

    const isExist = ((await isFileAtUri(tmpFilePath)));

    let result = false;

    const prog = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Downloading...",
        cancellable: true
    }, async (progress, token) => {

        progress.report({ message: "0 Mbyte", increment: 0 });


        let totalSize = 1;
        let prevSize = 0;
        let currentSize = 0;

        let request: ClientRequest;

        let isTerminated = false;



        async function download(url: string | URL /*| https.RequestOptions*/, targetFile: fs.PathLike): Promise<boolean> {
            return new Promise((resolve, reject) => {


                request = https.get(url, /*{ headers: { responseType: 'arraybuffer'} } ,*/ response => {

                    const code = response.statusCode ?? 0

                    if (code >= 400) {
                        isTerminated = true;
                        reject(new Error(response.statusMessage));
                    }

                    // handle redirects
                    if (code > 300 && code < 400 && !!response.headers.location) {
                        resolve(download(response.headers.location, targetFile));
                        return;
                    }

                    totalSize = response.headers['content-length'] ? Number(response.headers['content-length']) : 1;
                    console.log(totalSize);

                    response.on('data', (chunk) => {
                        const buffer = chunk as Buffer;
                        prevSize = currentSize;

                        if (totalSize == 1) {
                            console.log("Compressed size:", buffer.readInt32LE(20));
                            console.log("Uncompressed size:", buffer.readInt32LE(24));
                            console.log("Extra field length:", buffer.readInt16LE(30));
                            totalSize = 2;
                        }
                        //currentSize += 1024*1024;//buffer.byteLength;
                        currentSize += buffer.byteLength;
                    });

                    response.on('error', () => {
                        console.log("err");
                        isTerminated = true;
                        resolve(false);
                    });


                    try {

                        const fileWriter = fs.createWriteStream(targetFile)
                            .on('finish', async () => {
                                console.log("done");
                                progress.report({ message: "Installing...", increment: 0 });
                                let unzip = require('unzip-stream');

                                let fsExtra = require('fs-extra');
                                try {
                                    fsExtra.createReadStream(tmpFilePath.fsPath).pipe(unzip.Extract({ path: toolchainDirPath.fsPath }));
                                } catch (err) {
                                    console.log();
                                    (async () => {
                                        let buttons = ['Yes', 'No'];
                                        let choice = await vscode.window.showErrorMessage(`Invalid package archive!\nDo you want to delete this file?`, ...buttons);
                                        if (choice === buttons[0]) {
                                            fs.rm(tmpFilePath.fsPath, () => {
                                            });
                                        }
                                    })();
                                }

                                progress.report({ message: "Installing...", increment: 100 });
                                isTerminated = true;
                                resolve(true);

                            }).on('error', () => {
                                console.log("err");
                                isTerminated = true;
                                resolve(false);
                            });

                        response.pipe(fileWriter);

                    } catch (err) {
                        console.log(err);
                    }


                }).on('error', error => {
                    console.log(error);
                    isTerminated = true;
                    resolve(false);
                }).setTimeout(10000).on('timeout', () => {
                    console.log("Request timeout");
                    isTerminated = true;
                    resolve(false);
                });

                //resolve(true);
            });
        }

        const result0 = !isExist ? download(packageInfo.repo, tmpFilePath.fsPath) : true;

        if (isExist) {
            progress.report({ message: "Installing...", increment: 25 });
            let unzip = require('unzip-stream');
            let fsExtra = require('fs-extra');
            try {
                fsExtra.createReadStream(tmpFilePath.fsPath).pipe(unzip.Extract({ path: toolchainDirPath.fsPath }));
            } catch (err) {
                console.log();
                (async () => {
                    let buttons = ['Yes', 'No'];
                    let choice = await vscode.window.showErrorMessage(`Invalid package archive!\nDo you want to delete this file?`, ...buttons);
                    if (choice === buttons[0]) {
                        fs.rm(tmpFilePath.fsPath, () => {
                        });
                    }
                })();
            }
            isTerminated = true;
        }

        token.onCancellationRequested(() => {
            console.log("User canceled the long running operation");
            request.destroy();
        });

        let prevPer = 0;
        while (totalSize > currentSize && !isTerminated) {
            await new Promise(f => setTimeout(f, 1000));
            totalSize = totalSize ? totalSize : 1;
            const inPerc = Math.round(((currentSize)) * 100 / totalSize);
            const inc = inPerc - prevPer;
            prevPer = inPerc;
            const currentSizeInMb = Math.round((currentSize / 1024) / 1024);
            const totalSizeInMb = Math.round((totalSize / 1024) / 1024);
            console.log("[" + currentSizeInMb + "/" + totalSizeInMb + " Mbytes]", inPerc);
            progress.report({ message: "[" + currentSizeInMb + "/" + totalSizeInMb + " Mbytes]", increment: inc });

            if (token.isCancellationRequested) {
                return false;
            }
        }

        result = await result0;

        return;
    });

    console.log("Alarm");

    if (result == false && !isExist && ((await isFileAtUri(tmpFilePath)))) {
        fs.rm(tmpFilePath.fsPath, () => {
        });
    }


    return result;
}






function getVerToInt(str: string): number {
    let nums = str.split('.', 3);
    return (parseInt(nums[0]) << 16) | (parseInt(nums[1]) << 8) | (parseInt(nums[2]));
}




export async function checkPackageUpdate(packageInfo: PackageInfo): Promise<PackageInfo | undefined> {

    let lastPkg: PackageInfo | undefined = undefined;

    const response = await fetch(packageInfo.repo).catch((e) => {
        console.log(e);
        return undefined;
    });

    if (response === undefined) {
        return undefined;
    }

    const tmp = `{
        "versions": [
            { "pkgName": "Moderon", "label": "[v0.9]", "file": "moderon_0.9", "description": "[latest version]", "ver": "0.9.1", "repo": "https://github.com/Retrograd-Studios/eepl_vscode_ext_pkg_moderon/raw/v0_9_1/.eec.zip"}
        ]
    }`;

    const data2 = JSON.parse(tmp) as PackageVersions;
    console.log(data2);
    const jdata2 = JSON.stringify(data2);
    console.log(jdata2);

    console.log(response);
    const data = await response.json() as PackageVersions;

    for (let pkg of data.versions) {
        if (lastPkg == undefined || getVerToInt(pkg.ver) > getVerToInt(lastPkg.ver)) {
            lastPkg = pkg;
        }
    }

    if (lastPkg == undefined) {
        return undefined;
    }

    const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir();

    const packagePath = vscode.Uri.joinPath(
        vscode.Uri.file(homeDir), ".eec", "Packages", lastPkg.pkgName, "packageInfo.json");

    const isPackageFile = await isFileAtUri(packagePath);

    if (isPackageFile) {
        const raw = fs.readFileSync(packagePath.fsPath).toString();
        const currentVer = JSON.parse(raw) as PackageInfo;
        if (currentVer.ver != lastPkg.ver) {
            return lastPkg;
        }
    }
    else {
        return lastPkg;
    }

    return undefined;

}


export async function checkPackages() {

    const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir();

    const packagesPath = vscode.Uri.joinPath(
        vscode.Uri.file(homeDir), ".eepl-vscode-ext", "packages.json");
    const packagesDirPath = vscode.Uri.joinPath(
            vscode.Uri.file(homeDir), ".eepl-vscode-ext");

    const isPackagesFile = await isFileAtUri(packagesPath);

    if (!isPackagesFile) {
        const defaultPackages: PackagesFile = {
            packages: [
                { pkgName: "Moderon", label: "[1.0]", file: "", description: "Moderon Controllers", ver: "1.0", 
                repo: "https://github.com/Retrograd-Studios/eepl_vscode_ext_pkg_moderon/raw/main/versions.json" }
            ]
        };
        const jDefaultPackages =  JSON.stringify(defaultPackages);
        if (!(await isDirAtUri(packagesDirPath))) {
            await vscode.workspace.fs.createDirectory(packagesDirPath).then(() => { }, () => {
                console.log('Create dir error!');
            });
        }
        try {
            fs.writeFileSync(packagesPath.fsPath, jDefaultPackages);
        } catch (e: any) {
            console.log(e);
        }
    }

    const raw = fs.readFileSync(packagesPath.fsPath).toString();
    const packagesFile = JSON.parse(raw) as PackagesFile;

    var updates: Array<PackageInfo> = [];

    for (const packageInfo of packagesFile.packages) {
        const lastPkg = await checkPackageUpdate(packageInfo);
        if (lastPkg != undefined) {
            updates.push(lastPkg)
        }
    }

    if (updates.length == 0) {
        return;
    }

    const buttons = ['Yes, to all', 'Not now', 'Ask for each package'];
    const choice = await vscode.window.showInformationMessage(`Updates for packages are available!\nDo you want Download and Install now?`, ...buttons);

    if (choice === buttons[1]) {
        return
    }

    const doNotAsk = choice === buttons[0];
    for (const pkg of updates) {
        let isInstall = true;
        if (!doNotAsk) {
            const buttons2 = ['Install', 'Not now'];
            const choice2 = await vscode.window.showInformationMessage(`Updates for '${pkg.pkgName}' package is available!\n[v${pkg.ver}]\nDo you want Download and Install now?`, ...buttons2);
            if (choice2 == buttons2[1]) {
                isInstall = false;
            }
        }
        if (!isInstall) {
            continue;
        }

        const result = await installPackage(pkg).catch(() => {
            vscode.window.showErrorMessage(`The package '${pkg.pkgName}' has been not installed/updated.`);
        });

    }

}


