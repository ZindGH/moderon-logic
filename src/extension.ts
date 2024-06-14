import * as vscode from 'vscode';


import * as fs from 'fs';
import * as https from 'https';
import * as tasks from './tasks';
import * as toolchain from './toolchain';

import * as cp from "child_process";

import { Config } from "./config";
import { activateTaskProvider, createTask } from "./tasks";
import { isEasyDocument, execute } from "./util";

import * as readline from "readline";

import { EasyConfigurationProvider, runDebug } from "./dbg";

import * as os from "os";

import { TableEditorProvider } from './ModbusEditor/tableEditor';


import { URL } from 'url';
import { resolve } from 'path';
import fetch from 'node-fetch';
import { ToolchainsFile } from './toolchain';
import { checkPackages } from './packages';
import { execArgv } from 'process';
import { createNewProject, selectExamples } from './examples';
import { EFlasherClient } from './EFlasher/eflasher';
import { EGDBServer } from './EGDB_Server/egdbServer';

//import { resolve } from 'path';


async function downloadFile0(url: string | URL | https.RequestOptions, targetFile: fs.PathLike, callback: () => void) {
  return new Promise((resolve, reject) => {


    https.get(url, response => {

      const code = response.statusCode ?? 0

      if (code >= 400) {
        return reject(new Error(response.statusMessage))
      }

      // handle redirects
      if (code > 300 && code < 400 && !!response.headers.location) {
        return downloadFile0(response.headers.location, targetFile, callback)
      }

      const length = response.headers['content-length'];
      console.log(length);

      // save the file to disk
      const fileWriter = fs
        .createWriteStream(targetFile)
      // .on('finish', () => {
      //   //console.log("done");
      //   callback();
      //   resolve({});
      //})

      response.on('data', (chunk) => {
        const buffer = chunk as Buffer;
        console.log("chunk", chunk);
      })
      response.pipe(fileWriter);
      //response.on('data')


    }).on('error', error => {
      console.log("err");
      reject(error)
    })
  });

}




export type Workspace =
  | { kind: "Empty" }
  | {
    kind: "Workspace Folder";
  }
  | {
    kind: "Detached Files";
    files: vscode.TextDocument[];
  };


export function fetchWorkspace(): Workspace {
  const folders = (vscode.workspace.workspaceFolders || []).filter(
    (folder) => folder.uri.scheme === "file"
  );
  const rustDocuments = vscode.workspace.textDocuments.filter((document) =>
    isEasyDocument(document)
  );

  return folders.length === 0
    ? rustDocuments.length === 0
      ? { kind: "Empty" }
      : {
        kind: "Detached Files",
        files: rustDocuments,
      }
    : { kind: "Workspace Folder" };
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
      });
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
    armToolchainPath: "C:\\Program Files (x86)\\GNU Arm Embedded Toolchain\\10 2020-q4-major\\bin",
    gdbPath: "C:/Users/YouTooLife_PC/.eec/out/build/bin/arm-none-eabi-gdb.exe",
    gdbTarget: "localhost:4242",
    showDevDebugOutput: "raw"
    //preLaunchTask: "st-util"
  };


  vscode.debug.startDebugging(undefined, debugConfig);

}


let EEPL_stackOfCommands: string[] = []



let EEPL_isBuildFailed = true;
let EEPL_isReqRebuild = true;


export function activate(context: vscode.ExtensionContext) {


  console.log("Hello, World!");

  // (async () => {
  //   EFlasherClient.getPortList();
  // })();


  let extation = vscode.extensions.getExtension("Retrograd-Studios.moderon_logic");

  console.log(extation);

  let config = new Config(context);
  let eflashClient = new EFlasherClient(config, context);
  let eGdbServer = new EGDBServer(config, context);




  // (async () => {
  //   const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir();
  //   const exePath = vscode.Uri.joinPath(
  //   vscode.Uri.file(homeDir), ".eec", "bin", "eec.exe");

  //   let task = new vscode.Task(
  //     { type: 'eec', task: 'compile' },
  //     vscode.TaskScope.Workspace,
  //     'compile',
  //     '34teepl',
  //     new vscode.ProcessExecution(exePath.fsPath, [])
  //   );

  //   await vscode.tasks.executeTask(task);
  // })();



  //checkToolchain();
  //installToolchain();


  //   vscode.window.withProgress({
  //     location: vscode.ProgressLocation.Notification,
  //     title: "Downloading...",
  //     cancellable: true
  // }, async (progress, token) => {
  //     token.onCancellationRequested(() => {
  //         console.log("User canceled the long running operation");
  //     });
  //     progress.report({message: "Download...", increment: 0});

  //     for (var _i = 0; _i < 100; _i++) {
  //       await new Promise(f => setTimeout(f, 100));
  //       progress.report({message: "Download...()", increment: _i});
  //     }

  //   });


  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.progress', async config => {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Downloading...",
      cancellable: true
    }, async (progress, token) => {
      token.onCancellationRequested(() => {
        console.log("User canceled the long running operation");
      });
      progress.report({ message: "Download...", increment: 0 });

      for (var _i = 0; _i < 100; _i++) {
        await new Promise(f => setTimeout(f, 100));
        progress.report({ message: "Download...", increment: 1 });
      }

    });
  })

  );




  vscode.debug.onDidStartDebugSession((e) => {
    console.log(e);
    //checkDepencies();
  });


  vscode.tasks.onDidEndTaskProcess(async (e) => {

    console.log(e.execution.task.name);
    const tsk: tasks.EasyTaskDefinition = (e.execution.task.definition as tasks.EasyTaskDefinition);

    if (tsk as tasks.EasyTaskDefinition) {
      if (tsk.command == "build" && e.exitCode == 0) {
        const task = await createTask(2, config);
        const exec = await vscode.tasks.executeTask(task);
      }
      else if (tsk.command == "link" && e.exitCode == 0) {
        const task = await createTask(3, config);
        const exec = await vscode.tasks.executeTask(task);
      }
      else if (tsk.command == "ebuild" && e.exitCode == 0) {
        EEPL_isBuildFailed = false;
        const cmd = EEPL_stackOfCommands.pop();
        if (cmd) {
          vscode.commands.executeCommand(cmd);
        }
      } else if (e.exitCode != 0) {
        if (EEPL_stackOfCommands.length) {
          EEPL_stackOfCommands = [];
        }
      }
    } 

  });

  vscode.workspace.onDidSaveTextDocument((e) => {
    EEPL_isReqRebuild = true;
  });

  vscode.workspace.onDidSaveNotebookDocument((e) => {
    EEPL_isReqRebuild = true;
  });

  vscode.workspace.onDidCreateFiles((e) => {
    EEPL_isReqRebuild = true;
  });

  vscode.workspace.onDidDeleteFiles((e) => {
    EEPL_isReqRebuild = true;
  });

  vscode.workspace.onDidRenameFiles((e) => {
    EEPL_isReqRebuild = true;
  });


  // vscode.workspace.onDidOpenTextDocument((e) => {
  //   if (e.languageId != 'EEPL') {
  //     console.log('Deavivate');
  //   } else {
  //     console.log('Activate');
  //   }
  // });

  context.subscriptions.push(activateTaskProvider(config));

  // context.subscriptions.push(vscode.commands.registerCommand('extension.vscode-eemblang.getProgramName', () => {
  //   return vscode.window.showInputBox({
  //     placeHolder: 'Please enter the name of a source file in the workspace folder',
  //     value: 'source.es'
  //   });
  // }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.compileProject', async () => {


    EEPL_isBuildFailed = true;

    for (const file of vscode.workspace.textDocuments) {
      if (file.isDirty) {
        console.log("changes: ", file.fileName, file.version);
        await file.save();
      } else {
        console.log("no changes: ", file.fileName, file.version);
      }
    }

    EEPL_isReqRebuild = false;

    const task = await createTask(0, config).catch(() => { });
    if (!task) {
      return;
    }
    const exec = await vscode.tasks.executeTask(task);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.runSimulator', async () => {

    for (const file of vscode.workspace.textDocuments) {
      if (file.isDirty) {
        console.log("changes: ", file.fileName, file.version);
        await file.save();
      } else {
        console.log("no changes: ", file.fileName, file.version);
      }
    }

    const task = await createTask(1, config).catch(() => { });
    if (!task) {
      return;
    }
    const exec = await vscode.tasks.executeTask(task);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.buildAndDebug', config => {
    let runRebuild = false;
    for (const file of vscode.workspace.textDocuments) {
      if (file.isDirty) {
        runRebuild = true;
        break;
      } 
    }

    if (EEPL_isReqRebuild || EEPL_isBuildFailed || runRebuild) {
      EEPL_stackOfCommands.push('eepl.command.buildAndDebug');
      EEPL_stackOfCommands.push('eepl.command.buildAndFlash');
      vscode.commands.executeCommand('eepl.command.compileProject');
      return;
    }

    eGdbServer.runGdbServer();
    
  }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.openFlasher', async () => {
    const task = await createTask(4, config).catch(() => { });
    if (!task) {
      return;
    }
    const exec = await vscode.tasks.executeTask(task);
    //return vscode.window.showInformationMessage("Flush", "Ok");
  }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.attach', () => {
    //runDebug(config);
    eGdbServer.runGdbServer();
  }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.buildAndFlash', () => {

    let runRebuild = false;
    for (const file of vscode.workspace.textDocuments) {
      if (file.isDirty) {
        runRebuild = true;
        break;
      }
    }

    if (EEPL_isReqRebuild || EEPL_isBuildFailed || runRebuild) {
      EEPL_stackOfCommands.push('eepl.command.buildAndFlash');
      vscode.commands.executeCommand('eepl.command.compileProject');
      return;
    }

    eflashClient.flash((err)=>{
      if (!err) {
        const cmd = EEPL_stackOfCommands.pop();
        if (cmd) {
          vscode.commands.executeCommand(cmd);
        }
      } else {
        if (EEPL_stackOfCommands.length) {
          EEPL_stackOfCommands = [];
        }
      }
        
    });

  }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.settings', () => {
    vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', `@ext:${extation?.id}`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('eepl.command.setBuildPreset', async () => {
    const pickTargets: any[] = [
      { label: "Debug", detail: "Generate debug information. Disable all optimizations. Enable Runtime checks.", picked: false, description: " $(debug-alt)" },
      { label: "OpDebug", detail: "Generate debug information. Enable -O3 level optimizations. Enable Runtime checks.", picked: false, description: " $(debug-alt) $(symbol-event)" },
      { label: "Release", detail: "Discard debug information. Enable -O3 level optimizations. Disable Runtime checks.", picked: false, description: " $(check-all)" },
      { label: "Safe Release", detail: "Discard debug information. Enable -O3 level optimizations. Enable Runtime checks.", picked: false, description: " $(workspace-trusted)" },
      { label: "Custom", detail: "User defined optimization level, on/off generate debug information, on/off Runtime checks. ", picked: false, description: " $(edit)" },
      { label: "Settings", detail: "Open build settings", picked: false, description: " $(settings)" }
    ];

    


    const curentPreset = config.get<string>('build.presets');

      for (const variant of pickTargets) {

        const isPicked = (curentPreset == variant.label);
        const pickItem = isPicked ? '$(pass-filled)' : (variant.label != 'Settings' ? '$(circle-large-outline)' : "\t");
        const detail = ` ${pickItem} ${variant.detail}`;
        variant.detail = detail;
        variant.picked = isPicked;
      }

      const target = await vscode.window.showQuickPick(
        pickTargets,
        { placeHolder: 'Select build preset', title: "Build preset" }
      );
  
      if (target) {
        if (target.label != 'Settings') {
          config.set('build.presets', target.label);
        } else {
          vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', `@ext:${extation?.id} eepl.build`);
        }
      }


  }));




  //const devName = config.get<string>('target.device');
  //const devName: string = vscode.workspace.getConfiguration("eepl").get('target.device');
  let sbSelectTargetDev: vscode.StatusBarItem;
  sbSelectTargetDev = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);
  sbSelectTargetDev.command = 'eepl.command.setTargetDevice';
  context.subscriptions.push(sbSelectTargetDev);
  sbSelectTargetDev.text = "$(chip) Select Target";
  sbSelectTargetDev.tooltip = "Select target Device/Platform";
  sbSelectTargetDev.show();
  toolchain.checkAndSetCurrentTarget(config, sbSelectTargetDev);

  //const currentToolchain = await toolchain.getCurrentToolchain(); //config.get<string>('toolchain.version');
  let sbSelectToolchain: vscode.StatusBarItem;
  sbSelectToolchain = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 2);
  sbSelectToolchain.command = 'eepl.command.setToolchain';
  context.subscriptions.push(sbSelectToolchain);
  sbSelectToolchain.text = `$(extensions)`;
  sbSelectToolchain.tooltip = "Select toolchain";
  sbSelectToolchain.show();

  let sbSelectBuildPreset: vscode.StatusBarItem;
  sbSelectBuildPreset = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  sbSelectBuildPreset.command = 'eepl.command.setBuildPreset';
  context.subscriptions.push(sbSelectBuildPreset);
  sbSelectBuildPreset.text = config.get<string>('build.presets');
  sbSelectBuildPreset.tooltip = "Select build preset";
  sbSelectBuildPreset.show();

  let sbOpenSettings: vscode.StatusBarItem;
  sbOpenSettings = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 3);
  sbOpenSettings.command = 'eepl.command.settings';
  context.subscriptions.push(sbOpenSettings);
  sbOpenSettings.text = '$(settings-gear)'
  sbOpenSettings.tooltip = "Open extension settings";
  sbOpenSettings.show();


  // let sbClearCache: vscode.StatusBarItem;
  // sbClearCache = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  // sbClearCache.command = 'eepl.command.clearCache';
  // context.subscriptions.push(sbSelectToolchain);
  // sbClearCache.text = "$(terminal-kill)";
  // sbClearCache.tooltip = "Clear cache";
  // sbClearCache.show();





  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async e => {


    if (e.affectsConfiguration('eepl.target.device')) {
      if (config.targetDevice != config.get<toolchain.TargetInfo>("target.device")) {
        toolchain.checkAndSetCurrentTarget(config, sbSelectTargetDev);
      }
    }


    if (e.affectsConfiguration('eepl.toolchain.version')) {
      toolchain.checkAndSetCurrentToolchain(config, sbSelectToolchain);
    }

    if (e.affectsConfiguration('eepl.build')) {
      EEPL_isReqRebuild = true;
      if (e.affectsConfiguration('eepl.build.presets')) {
        sbSelectBuildPreset.text = config.get<string>('build.presets');
      } else {
        config.set('build.presets', 'Custom');
      }
    }
    

  }));





  (async () => {

    await toolchain.checkToolchain();
    let currentToolchain = await toolchain.getCurrentToolchain();
    //const inCfg = config.get<toolchain.ToolchainInfo>("toolchain.version");
    //   if (currentToolchain == undefined || !('ver' in currentToolchain))
    //   {
    //       currentToolchain = {
    //       label: "",
    //       file: "",
    //       description: "",
    //       ver: "0.0.0",
    //       url: ""
    //     };
    //   }
    //   else
    //   {
    //     currentToolchain.ver += ".0";
    //   }
    // config.setGlobal("toolchain.version", currentToolchain);
    toolchain.checkAndSetCurrentToolchain(config, sbSelectToolchain);
  })();





  // (async () => {
  //   await toolchain.checkToolchain();
  //   const targetDev = await toolchain.getTargetWithDevName(devName);
  //   sbSelectTargetDev.text = targetDev.description;
  //   config.targetDevice = targetDev;
  //   sbSelectToolchain.text = config.get<string>('toolchain.version') + (toolchain.IsNightlyToolchain ? " (latest version)" : " (old version)");
  // })();

  vscode.commands.registerCommand('eepl.command.clearCache', async () => {

    const devName = config.targetDevice.devName;

    const cwd = vscode.workspace.workspaceFolders![0].uri.path;
    const cachePath = `${cwd}/out/${devName}/.eec_cache`;
    const cacheSimPath = `${cwd}/out/Simulator/.eec_cache`;

    fs.rm(vscode.Uri.file(cachePath).fsPath, { recursive: true, force: true }, () => {
    });
    fs.rm(vscode.Uri.file(cacheSimPath).fsPath, { recursive: true, force: true }, () => {
    });

  });

  vscode.commands.registerCommand('eepl.command.setTargetDevice', async () => {


    let pickTargets: any[] = [];

    const prevDev = config.targetDevice; //.get<string>('target.device');

    const targets = await toolchain.getTargets();

    targets.forEach(element => {
      const isPicked = (prevDev.description == element.description);
      const pickItem = isPicked ? '$(pass-filled)' : '$(circle-large-outline)';// '$(check)' : ' ';
      const detail = ` ${pickItem}  $(device-mobile) [${element.periphInfo.uiCount} UIs, ${element.periphInfo.relayCount} Relays, ${element.periphInfo.aoCount} AOs, ${element.periphInfo.uartCount} COMs]   $(extensions) framework v${element.frameWorkVerA}.${element.frameWorkVerB}`;
      pickTargets.push({ label: element.devName, detail: detail, devName: element.devName, picked: isPicked, description: element.description, _target: element });
    });

    const target = await vscode.window.showQuickPick(
      pickTargets,
      // [
      //   { label: 'M72001', description: 'M72001 basic', devName: 'M72IS20C01D', target: vscode.ConfigurationTarget.Workspace },
      //   { label: 'M72002', description: 'M72002 medium', devName: 'M72IS20C02D', target: vscode.ConfigurationTarget.Workspace },
      //   { label: 'M72003', description: 'M72003 perfomance', devName: 'M72IS20C03D', target: vscode.ConfigurationTarget.Workspace }
      // ],
      { placeHolder: 'Select the target Device/Platform', title: "Target Device/Platform" }
    );

    if (target) {
      toolchain.setCurrentTarget(target._target, config, sbSelectTargetDev);
    }

  });

  vscode.commands.registerCommand('eepl.command.setToolchain', async () => {


    let pickTargets: any[] = [];

    //const prevVers = config.get<string>('toolchain.version');
    const currentToolchain = await toolchain.getCurrentToolchain();

    const toolchains = await toolchain.getToolchains();

    if (toolchains != undefined) {

      for (var toolchainInfo of toolchains) {

        const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir();

        const tmpFilePath = vscode.Uri.joinPath(
          vscode.Uri.file(homeDir),
          ".eec-tmp", `${toolchainInfo.file}.zip`
        );

        const isPicked = (currentToolchain ? currentToolchain.label == toolchainInfo.label : false);
        const pickItem = isPicked ? '$(pass-filled)' : '$(circle-large-outline)';//'$(check)' : ' ';
        const isLocal = (await toolchain.isFileAtUri(tmpFilePath));
        const localItem = isLocal ? '$(folder-active)' : '$(cloud-download)';
        const detail = ` ${pickItem}  $(info) [v${toolchainInfo.ver}]  ${localItem}`;
        pickTargets.push({ label: toolchainInfo.label, detail: detail, picked: isPicked, description: toolchainInfo.description, toolchain: toolchainInfo });
      }

    } else {

      const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir();

      const tmpDir = vscode.Uri.joinPath(
        vscode.Uri.file(homeDir),
        ".eec-tmp"
      );



      await vscode.workspace.fs.readDirectory(tmpDir).then((files) => {
        files.forEach(element => {

          console.log("file: ", element[0]);

          if (element[1] != vscode.FileType.File || element[0].lastIndexOf(".json") == -1 || element[0].lastIndexOf("ToolchainInfo.") == -1) { //element[0].split('.').length < 3) {
            //console.log("is not toolchain");
            return;
          }

          // const toolchainInfo: toolchain.ToolchainInfo = {
          //   label: element[0],
          //   file: element[0].substring(0, element[0].lastIndexOf(".zip")),
          //   description: '',
          //   ver: 'unknown',
          //   url: ''
          // };

          const rowFile = fs.readFileSync(vscode.Uri.joinPath(tmpDir, element[0]).fsPath).toString();
          const toolchainInfo: toolchain.ToolchainInfo = JSON.parse(rowFile);

          const isPicked = (currentToolchain ? currentToolchain.label == toolchainInfo.label : false);
          const pickItem = isPicked ? '$(pass-filled)' : '$(circle-large-outline)';//'$(check)' : ' ';
          //const isLocal = true;
          const localItem = '$(file-zip)';// isLocal ? '$(folder-active)' : '$(cloud-download)';
          const detail = ` ${pickItem}  $(info) [v${toolchainInfo.ver}]  ${localItem}`;
          pickTargets.push({ label: toolchainInfo.label, detail: detail, picked: isPicked, description: toolchainInfo.description, toolchain: toolchainInfo });
        });
      }, () => {
        console.log("Can't find toolchains");
      });

    }

    const target = await vscode.window.showQuickPick(
      pickTargets,
      // [
      //   { label: 'M72001', description: 'M72001 basic', devName: 'M72IS20C01D', target: vscode.ConfigurationTarget.Workspace },
      //   { label: 'M72002', description: 'M72002 medium', devName: 'M72IS20C02D', target: vscode.ConfigurationTarget.Workspace },
      //   { label: 'M72003', description: 'M72003 perfomance', devName: 'M72IS20C03D', target: vscode.ConfigurationTarget.Workspace }
      // ],
      { placeHolder: 'Select toolchain version', title: "Toolchain" }
    );

    if (target) {
      const isInstalled = await toolchain.installToolchain(target.toolchain);
      // if (isInstalled)
      // {
      //   config.set("toolchain.version", await toolchain.getCurrentToolchain());
      // }
    }

  });





  // let myStatusBarItem: vscode.StatusBarItem;
  // myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  // myStatusBarItem.command = 'vscode-eemblang.runSimulator';
  // context.subscriptions.push(myStatusBarItem);
  // myStatusBarItem.text = `$(run)`;
  // myStatusBarItem.tooltip = "Run Simulator";
  // myStatusBarItem.show();


  vscode.commands.registerCommand('eepl.command.createNewProject', async () => {
    createNewProject();
  });

  vscode.commands.registerCommand('eepl.command.createProjectFromExample', async () => {
    selectExamples();
  });



  (async () => {
    checkPackages();
  })();


  const provider = new EasyConfigurationProvider();
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('eembdbg', provider));


  context.subscriptions.push(TableEditorProvider.register(context));

  // let factory = new InlineDebugAdapterFactory();
  // context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('eembdbg', factory));
  // if ('dispose' in factory) {
  // 	context.subscriptions.push(factory);
  // }

  //   console.log("HW");

  //   let ws =  vscode.workspace.workspaceFolders;

  //   let valPath = "./";
  //   ws!.forEach(function (value) {
  //     valPath = value.uri.fsPath;
  //     console.log(value);
  //     console.log(value.uri.path);
  //   }); 


  //   console.log("___");

  //   let fName = path.join(valPath, 'file.json');
  //   let fName2 = path.join(valPath, 'file2.json');
  //   console.log(fName);

  //   const fileContents = fs.readFileSync(
  //     fName,
  //     {
  //       encoding: 'utf-8',
  //     },
  //   );

  //   console.log(fileContents);

  //   fs.writeFileSync(fName2, fileContents);

  //   console.log(os.platform());

  //   console.log(os.cpus());

  //   console.log(os.arch());

  //   console.log(os.homedir());

  //   console.log(os.hostname());

  //   console.log(os.version());

  //   console.log(os.userInfo());

  //   console.log(os.tmpdir());

  //   console.log(os.totalmem());




  // //writeFile('./file.json', content);

  //   //console.log("0)" + vscode.workspace.workspaceFolders![1].name);
  //   console.log("1)" + vscode.workspace.workspaceFile);

  //  downloadFile0("https://media.giphy.com/media/mlvseq9yvZhba/giphy.gif", `${valPath}/giphy.gif`);

}

