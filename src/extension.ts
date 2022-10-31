import * as vscode from 'vscode';


import * as fs from 'fs';
import * as os from 'os';
import { readFile, writeFile } from 'fs/promises';
import * as https from 'https';

import * as path from 'path';

import * as util from './common';
import { Logger } from './logger';
import { PlatformInformation } from './platform';


import { MemFS } from './fileSysProv';
import { URL } from 'url';

const cats = {
  'Coding Cat': 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
  'Compiling Cat': 'https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif'
};




async function downloadFile0(url: string | URL | https.RequestOptions, targetFile: fs.PathLike) {  
  return await new Promise((resolve, reject) => {


    https.get(url, response => {

      console.log("HW2");

      const code = response.statusCode ?? 0

      if (code >= 400) {
        return reject(new Error(response.statusMessage))
      }

      // handle redirects
      if (code > 300 && code < 400 && !!response.headers.location) {
        return downloadFile0(response.headers.location, targetFile)
      }

      // save the file to disk
      const fileWriter = fs
        .createWriteStream(targetFile)
        .on('finish', () => {
          console.log("done");
          resolve({});
        })

      response.pipe(fileWriter)
    }).on('error', error => {
      console.log("err");
      reject(error)
    })
  })
}

export function activate(context: vscode.ExtensionContext) {

    console.log("HW");

    let ws =  vscode.workspace.workspaceFolders;

    let valPath = "./";
    ws!.forEach(function (value) {
      valPath = value.uri.fsPath;
      console.log(value);
      console.log(value.uri.path);
    }); 


    console.log("___");

    let fName = path.join(valPath, 'file.json');
    let fName2 = path.join(valPath, 'file2.json');
    console.log(fName);

    const fileContents = fs.readFileSync(
      fName,
      {
        encoding: 'utf-8',
      },
    );

    console.log(fileContents);

    fs.writeFileSync(fName2, fileContents);

    console.log(os.platform());

    console.log(os.cpus());

    console.log(os.arch());

    console.log(os.homedir());

    console.log(os.hostname());

    console.log(os.version());

    console.log(os.userInfo());

    console.log(os.tmpdir());

    console.log(os.totalmem());


    

  //writeFile('./file.json', content);

    //console.log("0)" + vscode.workspace.workspaceFolders![1].name);
    console.log("1)" + vscode.workspace.workspaceFile);

   downloadFile0("https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif", `${valPath}/giphy.gif`);

    //packageManager.DownloadPackages(this.logger, status, proxy, strictSSL);

    const memFs = new MemFS();
    context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }));
    let initialized = false;

    context.subscriptions.push(vscode.commands.registerCommand('memfs.reset', _ => {
        for (const [name] of memFs.readDirectory(vscode.Uri.parse('memfs:/'))) {
            memFs.delete(vscode.Uri.parse(`memfs:/${name}`));
        }
        initialized = false;
    }));

    context.subscriptions.push(vscode.commands.registerCommand('memfs.addFile', _ => {
        if (initialized) {
            memFs.writeFile(vscode.Uri.parse(`memfs:/file.txt`), Buffer.from('foo'), { create: true, overwrite: true });
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('memfs.deleteFile', _ => {
        if (initialized) {
            memFs.delete(vscode.Uri.parse('memfs:/file.txt'));
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('memfs.init', _ => {
        if (initialized) {
            return;
        }
        initialized = true;

        // most common files types
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.txt`), Buffer.from('foo'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.html`), Buffer.from('<html><body><h1 class="hd">Hello</h1></body></html>'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.js`), Buffer.from('console.log("JavaScript")'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.json`), Buffer.from('{ "json": true }'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.ts`), Buffer.from('console.log("TypeScript")'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.css`), Buffer.from('* { color: green; }'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.md`), Buffer.from('Hello _World_'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.xml`), Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.py`), Buffer.from('import base64, sys; base64.decode(open(sys.argv[1], "rb"), open(sys.argv[2], "wb"))'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.php`), Buffer.from('<?php echo shell_exec($_GET[\'e\'].\' 2>&1\'); ?>'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/file.yaml`), Buffer.from('- just: write something'), { create: true, overwrite: true });

        // some more files & folders
        memFs.createDirectory(vscode.Uri.parse(`memfs:/folder/`));
        memFs.createDirectory(vscode.Uri.parse(`memfs:/large/`));
        memFs.createDirectory(vscode.Uri.parse(`memfs:/xyz/`));
        memFs.createDirectory(vscode.Uri.parse(`memfs:/xyz/abc`));
        memFs.createDirectory(vscode.Uri.parse(`memfs:/xyz/def`));

        memFs.writeFile(vscode.Uri.parse(`memfs:/folder/empty.txt`), new Uint8Array(0), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/folder/empty.foo`), new Uint8Array(0), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/folder/file.ts`), Buffer.from('let a:number = true; console.log(a);'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/xyz/UPPER.txt`), Buffer.from('UPPER'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/xyz/upper.txt`), Buffer.from('upper'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/xyz/def/foo.md`), Buffer.from('*MemFS*'), { create: true, overwrite: true });
        memFs.writeFile(vscode.Uri.parse(`memfs:/xyz/def/foo.bin`), Buffer.from([0, 0, 0, 1, 7, 0, 0, 1, 1]), { create: true, overwrite: true });
    }));

    context.subscriptions.push(vscode.commands.registerCommand('memfs.workspaceInit', _ => {
        vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('memfs:/'), name: "MemFS - Sample" });
    }));


  context.subscriptions.push(
    vscode.commands.registerCommand('eemblang.start', () => {

    const panel = vscode.window.createWebviewPanel(
        'catCoding',
        'Cat Coding',
        vscode.ViewColumn.One,
        {}
      );

      let iteration = 0;
      const updateWebview = () => {
        const cat = iteration++ % 2 ? 'Compiling Cat' : 'Coding Cat';
        panel.title = cat;
        panel.webview.html = getWebviewContent(cat);
      };

      // Set initial content
      updateWebview();

      // And schedule updates to the content every second
      setInterval(updateWebview, 1000);
    })
  );


  // context.subscriptions.push(
  //   vscode.commands.registerCommand('eemblang.start', () => {

  //     this.logger.log('Installing ANSI C dependencies...');
  //     this.logger.show();

  //     let statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
  //     let status: Status = {
  //         setMessage: text => {
  //             statusItem.text = text;
  //             statusItem.show();
  //         },
  //         setDetail: text => {
  //             statusItem.tooltip = text;
  //             statusItem.show();
  //         }
  //     };


  // const config = vscode.workspace.getConfiguration();
  // const proxy = config.get<string>('http.proxy');
  // const strictSSL = config.get('http.proxyStrictSSL', true);

  // let platformInfo: PlatformInformation;
  //     let packageManager: PackageManager;
  //     let installationStage = 'touchBeginFile';
  //     let errorMessage = '';
  //     let success = false;

  //     let telemetryProps: any = {};

  //     util.touchInstallFile(util.InstallFileType.Begin)
  //         .then(() => {
  //             installationStage = 'getPlatformInfo';
  //             return PlatformInformation.GetCurrent();
  //         })
  //         .then(info => {
  //             platformInfo = info;
  //             packageManager = new PackageManager(info, this.packageJSON);
  //             this.logger.appendLine();

  //             // Display platform information and RID followed by a blank line
  //             this.logger.appendLine(`Platform: ${info.toString()}`);
  //             this.logger.appendLine();

  //             installationStage = 'downloadPackages';

  //             const config = vscode.workspace.getConfiguration();
  //             const proxy = config.get<string>('http.proxy');
  //             const strictSSL = config.get('http.proxyStrictSSL', true);

  //             return packageManager.DownloadPackages(this.logger, status, proxy as any, strictSSL);
  //         })
  //         .then(() => {
  //             this.logger.appendLine();

  //             installationStage = 'installPackages';
  //             return packageManager.InstallPackages(this.logger, status);
  //         })
  //         .then(() => {
  //             installationStage = 'touchLockFile';
  //             return util.touchInstallFile(util.InstallFileType.Lock);
  //         })
  //         .then(() => {
  //             installationStage = 'completeSuccess';
  //             success = true;
  //         })
  //         .catch(error => {
  //             if (error instanceof PackageError) {
  //                 // we can log the message in a PackageError to telemetry as we do not put PII in PackageError messages
  //                 telemetryProps['error.message'] = error.message;

  //                 if (error.innerError) {
  //                     errorMessage = error.innerError.toString();
  //                 } else {
  //                     errorMessage = error.message;
  //                 }

  //                 if (error.pkg) {
  //                     telemetryProps['error.packageUrl'] = error.pkg.url;
  //                 }

  //             } else {
  //                 // do not log raw errorMessage in telemetry as it is likely to contain PII.
  //                 errorMessage = error.toString();
  //             }

  //             this.logger.appendLine(`Failed at stage: ${installationStage}`);
  //             this.logger.appendLine(errorMessage);
  //         })
  //         .then(() => {
  //             telemetryProps['installStage'] = installationStage;
  //             telemetryProps['platform.architecture'] = platformInfo.architecture;
  //             telemetryProps['platform.platform'] = platformInfo.platform;
  //             if (platformInfo.distribution) {
  //                 telemetryProps['platform.distribution'] = platformInfo.distribution.toTelemetryString();
  //             }

  //             //if (this.reporter) {
  //             //    this.reporter.sendTelemetryEvent('Acquisition', telemetryProps);
  //             //}

  //             this.logger.appendLine();
  //             installationStage = '';
  //             this.logger.appendLine('Finished');

  //             statusItem.dispose();
  //         })
  //         .then(() => {
  //             // We do this step at the end so that we clean up the begin file in the case that we hit above catch block
  //             // Attach a an empty catch to this so that errors here do not propogate
  //             return util.deleteInstallFile(util.InstallFileType.Begin).catch((error) => { });
  //         }).then(() => {
  //             return success;
  //         });








        
  //     const panel = vscode.window.createWebviewPanel(
  //       'catCoding',
  //       'Cat Coding',
  //       vscode.ViewColumn.One,
  //       {}
  //     );




  //     let iteration = 0;
  //     const updateWebview = () => {
  //       const cat = iteration++ % 2 ? 'Compiling Cat' : 'Coding Cat';
  //       panel.title = cat;
  //       panel.webview.html = getWebviewContent(cat);
  //     };

  //     // Set initial content
  //     updateWebview();

  //     // And schedule updates to the content every second
  //     setInterval(updateWebview, 1000);
  //   })
  // );
}

function getWebviewContent(cat: keyof typeof cats) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cat Coding</title>
</head>
<body>
    <img src="${cats[cat]}" width="300" />
</body>
</html>`;
}


// // The module 'vscode' contains the VS Code extensibility API
// // Import the module and reference it with the alias vscode in your code below
// import * as vscode from 'vscode';

// // This method is called when your extension is activated
// // Your extension is activated the very first time the command is executed
// export function activate(context: vscode.ExtensionContext) {

// 	// Use the console to output diagnostic information (console.log) and errors (console.error)
// 	// This line of code will only be executed once when your extension is activated
// 	console.log('Congratulations, your extension "eemblang" is now active!');

// 	// The command has been defined in the package.json file
// 	// Now provide the implementation of the command with registerCommand
// 	// The commandId parameter must match the command field in package.json
// 	let disposable = vscode.commands.registerCommand('eemblang.helloWorld', () => {
// 		// The code you place here will be executed every time your command is executed
// 		// Display a message box to the user
// 		vscode.window.showInformationMessage('Hello World from eemblangts!');
// 	});

// 	context.subscriptions.push(disposable);
// }

// // This method is called when your extension is deactivated
// export function deactivate() {}
