
import * as vscode from 'vscode';

import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';


import * as readline from "readline";

import * as toolchain from './toolchain';

import * as cp from "child_process";


export interface EasyDbgCfg extends DebugConfiguration {
  request: string,
  cmd: string;
}


async function checkDepencies() {
   
  
    let extName = "marus25.cortex-debug";
     //let extName = "vadimcn.vscode-lldb";
    
     let debugEngine = vscode.extensions.getExtension(extName);
   
     if (!debugEngine) {
       let buttons = ['Install', 'Not now'];
       let choice = await vscode.window.showWarningMessage(`Extension '${extName}' is not installed! It is required for debugging.\n Install now?`, ...buttons);
       if (choice === buttons[0]) {
        await vscode.commands.executeCommand('workbench.extensions.installExtension', extName).then(() => {
           vscode.window.showInformationMessage(`Extension '${extName}' has been successfully installed`);
        }, () => {
          vscode.window.showErrorMessage(`Extension '${extName}' has not been installed :(`);
          return;
        } );  
       } else if (choice == buttons[1]) {
          vscode.window.showErrorMessage(`Extension '${extName}' has not been installed.\n Debugging is unreached :(`);
          return;
       } 
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
  
    let workspace = vscode.workspace.workspaceFolders![0];
  
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
  
  
     debugEngine = vscode.extensions.getExtension(extName);
  
     let debugConfig: vscode.DebugConfiguration = {
      type: "cortex-debug",
      request: "attach",
      name: "Debug on PLC",
      cwd: "${workspaceFolder}",
      svdFile: "./bin/target.svd",
      executable: "./bin/target.o",
      runToEntryPoint: "__entryPoint__",
      servertype: "external",
//      armToolchainPath: "C:\\Program Files (x86)\\GNU Arm Embedded Toolchain\\10 2020-q4-major\\bin",
      //gdbPath: "C:/Users/YouTooLife_PC/.eec/out/build/bin/arm-none-eabi-gdb.exe",
      gdbTarget: "localhost:3333",
      showDevDebugOutput: "raw"
      //preLaunchTask: "st-util"
     };
                 
  
     vscode.debug.startDebugging(undefined, debugConfig);
   
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
 //           armToolchainPath: "C:\\Program Files (x86)\\GNU Arm Embedded Toolchain\\10 2020-q4-major\\bin",
            //gdbPath: "C:/Users/YouTooLife_PC/.eec/out/build/bin/arm-none-eabi-gdb.exe",
            gdbTarget: "localhost:3333",
            showDevDebugOutput: "raw",
            preLaunchTask: "eemblang: Build for Device"
           };


           let cfg = config as EasyDbgCfg;
           if (cfg.cmd == "simulate") {
            debugConfig.preLaunchTask = "eemblang: Run Simulator";
           }
           else {
            checkDepencies();
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


