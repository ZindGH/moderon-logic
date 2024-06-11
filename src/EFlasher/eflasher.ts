
//import { SerialPort } from 'serialport'

import * as toolchain from './../toolchain';
import * as cp from "child_process";
import * as readline from "readline";

import * as vscode from 'vscode';
import { getNonce } from './../util';
import * as fs from 'fs';

export class EFlasherClient {

    constructor(
		private readonly context: vscode.ExtensionContext
	) { }



    private async eflashGetPortList() : Promise<string[]> {

        const path = await toolchain.getPathForExecutable("eflash");
    
        if (!path) {
            vscode.window.showErrorMessage("Can't find path to 'st-util'");
            return [];
        }


        let result: string[] = [];

        const workspace = vscode.workspace.workspaceFolders![0];

    const promiseExec = new Promise((resolve, reject) => {
    
        const eflash = cp.spawn(path, ["-nogui", "-cmd", "portlist"], {
            stdio: ["ignore", "pipe", "pipe"],
        }).on("error", (err) => {
            console.log("Error: ", err);
            reject(new Error(`could not launch eflash: ${err}`))
        }).on("exit", (exitCode, _) => {
            if (exitCode === 0) { 
                resolve("Done");
            }
            else {
                //reject(exitCode);
                reject(new Error(`exit code: ${exitCode}.`));
            }
        });

        eflash.stderr.on("data", (chunk) => {
            console.log(chunk.toString());
        });
        
        const rl = readline.createInterface({ input: eflash.stdout });
        rl.on("line", (line) => {

            const message = line.split(": ");

            if (message[0] == "Info") {
                vscode.window.showInformationMessage("EFlasher: "+message[1]);
            } else if (message[0] == "Progress") {

            } else if (message[0] == "Error") {
                vscode.window.showErrorMessage("EFlasher: "+message[1]);
            } else if (message[0] == "PortName") {
                result.push(message[1]);
            }
        });

    });

    let stdout = await promiseExec;

    //console.log("Done!");



        return result;
    }


    public async eflashRun() {


        const panel = vscode.window.createWebviewPanel(
            'eflash', // Identifies the type of the webview. Used internally
            'EFlash config', // Title of the panel displayed to the user
            vscode.ViewColumn.One, // Editor column to show the new webview panel in.
            {
                enableScripts: true
            } // Webview options. More on these later.
        );

        panel.webview.html = await this.getHtmlForWebview(panel.webview);

        panel.onDidDispose(() => {

            console.log("EFlash config windows has been destroyed.");

        });

        panel.webview.onDidReceiveMessage(
            message => {
              switch (message.command) {
                case 'alert':
                  //vscode.window.showErrorMessage(message.text);

                  (async () => {
                        const portList = await this.eflashGetPortList();
                        //['COM11', 'COM22', 'COM4', 'IS: '+message.form.isResetToDef, 'Baudrate: '+message.form.baudRate]
                        panel.webview.postMessage({ command: 'setPortList', data: {'ports': portList} });
                  }
                  )();
                  
                  return;
              }
            },
            undefined,
            this.context.subscriptions
          );

    }

    public static async getPortList() {

        // const list = await SerialPort.list();

        // for (let portInfo of list) {
        //     console.log("LocId: ", portInfo.locationId);
        //     console.log("Manufacturer: ",portInfo.manufacturer);
        //     console.log("Path: ",portInfo.path);
        //     console.log("pnpId: ",portInfo.pnpId);
        //     console.log("ProductId: ",portInfo.productId);
        //     console.log("SerialNumber: ",portInfo.serialNumber);
        //     console.log("VendorId: ",portInfo.vendorId);
        // }

    }

    private async getHtmlForWebview(webview: vscode.Webview): Promise<string> {
		// Local path to script and css for the webview

        const htmlUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'eflasher', 'index.html'));

		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'eflasher', 'eflash.js'));

        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(
            this.context.extensionUri, 'media', 'eflasher', 'eflash.css'));

		// const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(
		// 	this.context.extensionUri, 'media', 'reset.css'));

		const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(
			this.context.extensionUri, 'media', 'vscode.css'));

        //let htmlBody: string = "";

        //console.log(htmlUri.path);

        const htmlBody = fs.readFileSync(htmlUri.fsPath).toString();

        // await vscode.workspace.fs.readFile(htmlUri).then(value => {

        //         htmlBody = value.toString();

        //     },  (e) => {
        //         console.log(e);
        //         console.log("Can't load index.html");
        //     });
		

		// Use a nonce to whitelist which scripts can be run
		const nonce = getNonce();

        console.log(webview.cspSource);

		return /* html */`
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">

				<!--
				Use a content security policy to only allow loading images from https or from our extension directory,
				and only allow scripts that have a specific nonce.
                
				
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                -->

				<meta name="viewport" content="width=device-width, initial-scale=1.0">

				<link href="${styleVSCodeUri}" rel="stylesheet" />
				<link href="${styleMainUri}" rel="stylesheet" />

				<title>EFlash config</title>
			</head>
			<body>
                ${htmlBody}
				<script nonce="${nonce}" src="${scriptUri}"></script>
			</body>
			</html>`;
	}


}