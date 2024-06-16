
import * as vscode from 'vscode';

import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';


import * as readline from "readline";

import * as toolchain from './toolchain';

import * as cp from "child_process";
import Path = require('path');
import { Config } from './config';

import * as fs from 'fs';


export interface EasyDbgCfg extends DebugConfiguration {
  request: string,
  cmd: string;
}


async function checkDepencies(extName: string): Promise<boolean> {
     //let extName = "vadimcn.vscode-lldb";
    
    const debugEngine = vscode.extensions.getExtension(extName);
   
    if (debugEngine) {
      return true;
    }

       
    let buttons = ['Install', 'Not now'];
    let choice = await vscode.window.showWarningMessage(`Extension '${extName}' is not installed! It is required for debugging.\n Install now?`, ...buttons);
    
    if (choice === buttons[0]) {

      let result = false;

      await vscode.commands.executeCommand('workbench.extensions.installExtension', extName).then(() => {
          result = true;
          vscode.window.showInformationMessage(`Extension '${extName}' has been successfully installed`);
        }, 
        () => {
          vscode.window.showErrorMessage(`Extension '${extName}' has not been installed :(`);
        });
        
      return result;

    } else {

      vscode.window.showErrorMessage(`Extension '${extName}' has not been installed.\n Debugging is unreached :(`);
      return false;

    } 
}




export async function runDebug(config: Config) {


  if (!(await toolchain.IsToolchainInstalled())) {
    return new Promise((resolve, reject) => { reject(); });
  }

if (config.targetDevice.description == "[Device]")
{
    await vscode.commands.executeCommand('eepl.command.setTargetDevice');
    if (config.targetDevice.description == "[Device]")
    {
        return new Promise((resolve, reject) => { reject(); });
    }
}
  

  const extName = "marus25.cortex-debug";

  const isCanDebug = await checkDepencies(extName);

  if (!isCanDebug) {
    return;
  }

  
    // const workspace = vscode.workspace.workspaceFolders![0];


    const pathToArmToolchain = await toolchain.getPathForExecutable("arm-none-eabi-gdb");
    
    if (!pathToArmToolchain) {
      vscode.window.showErrorMessage("Can't find path to 'GNU Arm Embedded Toolchain'");
      return;
    }

    let progPath = "./";

    const ws = vscode.workspace.workspaceFolders? vscode.workspace.workspaceFolders[0] : undefined;
            if (!ws) {
                vscode.window.showErrorMessage('Workspace is not opened.');
                return false;
            }

            const cwd = ws.uri.fsPath;//"${cwd}";
            const devName = config.targetDevice.devName;
            progPath = `${cwd}/out/${devName}/output.elf`;

            if (!fs.existsSync(progPath)) {
                const options: vscode.OpenDialogOptions = {
                    canSelectMany: false,
                    openLabel: 'Select App to Flash',
                    canSelectFiles: true,
                    canSelectFolders: false
                };
        
                await vscode.window.showOpenDialog(options).then(fileUri => {
                    if (fileUri && fileUri[0]) {
                        //console.log('Selected dir: ' + fileUri[0].fsPath);
                        progPath = fileUri[0].fsPath;
                    } else {
                        vscode.window.showErrorMessage(`File "${progPath} is not found.`);
                        return new Promise((resolve, reject) => {
                            reject(new Error(`File "${progPath} is not found.`));
                        });
                    }
                });
            } 

    const DirPathToArmToolchain = Path.dirname(pathToArmToolchain);

    //const devName = config.targetDevice.devName;
    //const cwd = "${cwd}";
    //const targetExe = `${cwd}/out/${devName}/output.elf`;

    const gdbServerPort = config.get<number>('gdbserver.port');
  
     const debugConfig: vscode.DebugConfiguration = {
      type: "cortex-debug",
      request: "attach",
      name: "Debug on PLC",
      cwd: "${workspaceFolder}",
      //svdFile: "./bin/target.svd",
      executable: progPath,
      runToEntryPoint: "__entryPoint__",
      servertype: "external",
      //gdbPath: "C:/Users/YouTooLife_PC/.eec/out/build/bin/arm-none-eabi-gdb.exe",
      armToolchainPath: DirPathToArmToolchain,
      gdbPath: pathToArmToolchain,
      gdbTarget: `localhost:${gdbServerPort}`,
      //gdbTarget: "localhost:4242",
      showDevDebugOutput: "raw"
      //preLaunchTask: "st-util"
     };
                 
  
     vscode.debug.startDebugging(ws, debugConfig);
   
  }


export class EasyConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

		// if launch.json is missing or empty

        console.log(config);

        let debugConfig: vscode.DebugConfiguration = {
            type: "cortex-debug",
            request: "attach",
            name: "Debug on PLC",
            cwd: "${workspaceFolder}",
            svdFile: "./bin/target.svd",
            executable: "./bin/target.o",
            runToEntryPoint: "__entryPoint__",
            servertype: "external",
            armToolchainPath: "D:\\Program Files (x86)\\GNU Arm Embedded Toolchain\\10 2020-q4-major\\bin",
            gdbPath: "D:\\Program Files (x86)\\GNU Arm Embedded Toolchain\\10 2020-q4-major\\bin\\arm-none-eabi-gdb.exe",
            gdbTarget: "localhost:3333",
            showDevDebugOutput: "raw",
            preLaunchTask: "eemblang: Build for Device"
           };


           let cfg = config as EasyDbgCfg;
           if (cfg.cmd == "simulate") {
            debugConfig.preLaunchTask = "eemblang: Run Simulator";
           }
           else {
            //checkDepencies();
           }

		// if (!config.type && !config.request && !config.name) {
		// 	const editor = vscode.window.activeTextEditor;
		// 	if (editor && editor.document.languageId === 'markdown') {
		// 		config.type = 'mock';
		// 		config.name = 'Launch';
		// 		config.request = 'launch';
		// 		config.program = '${file}';
		// 		config.stopOnEntry = true;
		// 	}
		// }

		// if (!config.program) {
		// 	return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
		// 		return undefined;	// abort launch
		// 	});
		// }
        //checkDepencies();


		return debugConfig;
	}
}


