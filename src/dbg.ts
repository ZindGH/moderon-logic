
import * as vscode from 'vscode';

import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';


import * as readline from "readline";

import * as toolchain from './toolchain';

import * as cp from "child_process";
import Path = require('path');
import { Config } from './config';


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


let isFoundToolchain = false;

export async function runDebug(config: Config) {


  if (!isFoundToolchain) {
    isFoundToolchain = await toolchain.checkToolchain();
    if (!isFoundToolchain)
    {
        vscode.window.showErrorMessage(`EEmbLang Compiler is not installed! Can't find toolchain`);
        return new Promise((resolve, reject) => { reject(); });
    }
}

if (config.targetDevice.description == "[Device]")
{
    await vscode.commands.executeCommand('vscode-eemblang.command.setTargetDevice');
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
  
  //    const definition: tasks.EasyTaskDefinition = {
  //     type: tasks.TASK_TYPE,
  //     command: "", // run, test, etc...
  //     args: [],
  //     cwd: vscode.workspace.getWorkspaceFolder ,
  //     env: prepareEnv(runnable, config.runnableEnv),
  //     overrideCargo: runnable.args.overrideCargo,
  // };
  
  //    const target = vscode.workspace.workspaceFolders![0]; // safe, see main activate()
  //     const cargoTask = await tasks.buildCargoTask(
  //         target,
  //         definition,
  //         runnable.label,
  //         args,
  //         config.cargoRunner,
  //         true
  //     );
  
  //     cargoTask.presentationOptions.clear = true;
  //     // Sadly, this doesn't prevent focus stealing if the terminal is currently
  //     // hidden, and will become revealed due to task exucution.
  //     cargoTask.presentationOptions.focus = false;
  
  
    const path = await toolchain.getPathForExecutable("st-util");
    
    if (!path) {
      vscode.window.showErrorMessage("Can't find path to 'st-util'");
      return;
    }
  
    const workspace = vscode.workspace.workspaceFolders![0];
  
    //const exec = cp.spawn(path, [], {});
  
    const exec = new Promise((resolve, reject) => {
      const cargo = cp.spawn(path, [], {
          stdio: ["ignore", "pipe", "pipe"],
   //       cwd: workspace.name
      });
  
      cargo.on("error", (err) => {
        reject(new Error(`could not launch cargo: ${err}`))
      });
  
      cargo.stderr.on("data", (chunk) => {
        console.log(chunk.toString());
      });
  
      const rl = readline.createInterface({ input: cargo.stdout });
      rl.on("line", (line) => {
        console.log(line);
          //const message = JSON.parse(line);
          //onStdoutJson(message);
      });
  
      cargo.on("exit", (exitCode, _) => {
          if (exitCode === 0) { 
            resolve(exitCode);
          }
          else {
            reject(new Error(`exit code: ${exitCode}.`));
          }
      });
  });
  
    await new Promise(f => setTimeout(f, 1000));
  
    
    // const exec =  execute(path, {}).then(() => {
    //   vscode.window.showInformationMessage("Success");
    // }, () => {
    //   vscode.window.showErrorMessage("Error");
    // }); //cp.exec(path);

    const pathToArmToolchain = await toolchain.getPathForExecutable("arm-none-eabi-gdb");
    
    if (!pathToArmToolchain) {
      vscode.window.showErrorMessage("Can't find path to 'GNU Arm Embedded Toolchain'");
      return;
    }

    const DirPathToArmToolchain = Path.dirname(pathToArmToolchain);

    const devName = config.targetDevice.devName;
    const cwd = "${cwd}";
    const targetExe = `${cwd}/out/${devName}/output.elf`;
  
     const debugConfig: vscode.DebugConfiguration = {
      type: "cortex-debug",
      request: "attach",
      name: "Debug on PLC",
      cwd: "${workspaceFolder}",
      //svdFile: "./bin/target.svd",
      executable: targetExe,
      runToEntryPoint: "__entryPoint__",
      servertype: "external",
      //gdbPath: "C:/Users/YouTooLife_PC/.eec/out/build/bin/arm-none-eabi-gdb.exe",
      armToolchainPath: DirPathToArmToolchain,
      gdbPath: pathToArmToolchain,
      gdbTarget: "localhost:4242",
      showDevDebugOutput: "raw"
      //preLaunchTask: "st-util"
     };
                 
  
     vscode.debug.startDebugging(workspace, debugConfig);
   
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


