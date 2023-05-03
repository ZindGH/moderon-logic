import * as vscode from 'vscode';


import * as fs from 'fs';
import * as https from 'https';
import * as tasks from './tasks';
import * as toolchain from './toolchain';

import * as cp from "child_process";

import { Config,  substituteVSCodeVariables } from "./config";
import { activateTaskProvider, createTask } from "./tasks";
import { isEasyDocument, execute } from "./util";

import * as readline from "readline";

import {EasyConfigurationProvider} from "./dbg";

import * as os from "os";

import {TableEditorProvider } from './ModbusEditor/tableEditor';


import { URL } from 'url';
import { resolve } from 'path';

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



//   console.log(response);

// if (!response.ok) { /* Handle */ }

// // If you care about a response:
// if (response.body !== null) {
//   // body is ReadableStream<Uint8Array>
//   // parse as needed, e.g. reading directly, or
//   const asString = new TextDecoder("utf-8").decode(response.body);
//   // and further:
//   const asJSON = JSON.parse(asString);  // implicitly 'any', make sure to verify type on runtime.
// }

// function request<Request, Response>(
//   method: 'GET' | 'POST',
//   url: string,
//   content?: Request,
//   callback?: (response: Response) => void,
//   errorCallback?: (err: any) => void) {

// const request = new XMLHttpRequest();
// request.open(method, url, true);
// request.onload = function () {
//   if (this.status >= 200 && this.status < 400) {
//       // Success!
//       const data = JSON.parse(this.response) as Response;
//       callback && callback(data);
//   } else {
//       // We reached our target server, but it returned an error
//   }
// };

// request.onerror = function (err) {
//   // There was a connection error of some sort
//   errorCallback && errorCallback(err);
// };
// if (method === 'POST') {
//   request.setRequestHeader(
//       'Content-Type',
//       'application/x-www-form-urlencoded; charset=UTF-8');
// }
// request.send(content);
// }

// function request2<Request, Response>(
//   method: 'GET' | 'POST',
//   url: string,
//   content?: Request
// ): Promise<Response> {
//   return new Promise<Response>((resolve, reject) => {
//       request(method, url, content, resolve, reject);
//   });
// }


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
    armToolchainPath: "C:\\Program Files (x86)\\GNU Arm Embedded Toolchain\\10 2020-q4-major\\bin",
    gdbPath: "C:/Users/YouTooLife_PC/.eec/out/build/bin/arm-none-eabi-gdb.exe",
    gdbTarget: "localhost:4242",
    showDevDebugOutput: "raw"
    //preLaunchTask: "st-util"
   };
               

   vscode.debug.startDebugging(undefined, debugConfig);
 
}




export function activate(context: vscode.ExtensionContext) {


  //console.log("Hello, World!");

  let extation = vscode.extensions.getExtension("YouTooLife.vscode-eemblang");
  
  console.log(extation);
  
  let config = new Config(context);

  //checkToolchain();
  //installToolchain();
  toolchain.checkToolchain();

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
 

context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.progress', async config => {
  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Downloading...",
    cancellable: true
}, async (progress, token) => {
    token.onCancellationRequested(() => {
        console.log("User canceled the long running operation");
    });
    progress.report({message: "Download...", increment: 0});

    for (var _i = 0; _i < 100; _i++) {
      await new Promise(f => setTimeout(f, 100));
      progress.report({message: "Download...", increment: 1});
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

    if (tsk as tasks.EasyTaskDefinition)
    {
      if (tsk.command == "build" && e.exitCode == 0)
      {
        const task = await createTask(2, config);
        const exec = await vscode.tasks.executeTask(task);
      }
      else if (tsk.command == "link" && e.exitCode == 0) {
        const task = await createTask(3, config);
        const exec = await vscode.tasks.executeTask(task);
      }
    }

  });

  context.subscriptions.push(activateTaskProvider(config));

  context.subscriptions.push(vscode.commands.registerCommand('extension.vscode-eemblang.getProgramName', config => {
    return vscode.window.showInputBox({
      placeHolder: 'Please enter the name of a source file in the workspace folder',
      value: 'source.es'
    });
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.compileProject', async config => {
    const task = 
    await createTask(0, config);
    const exec = await vscode.tasks.executeTask(task);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.runSimulator', async config =>  {
    const task = await createTask(1, config);
    const exec = await vscode.tasks.executeTask(task);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.flash', config => {
    return vscode.window.showInformationMessage("Flash", "Ok");
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.flush', async config => {
    const task = await createTask(4, config);
    const exec = await vscode.tasks.executeTask(task);
    //return vscode.window.showInformationMessage("Flush", "Ok");
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.attach', config => {
    return vscode.window.showInformationMessage("Attach", "Ok");
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.flushDbg', config => {
    return vscode.window.showInformationMessage("flushDbg", "Ok");
  }));

  context.subscriptions.push(vscode.commands.registerCommand('vscode-eemblang.settings', config => {
    return vscode.window.showInformationMessage("settings", "Ok");
  }));

  let myStatusBarItem: vscode.StatusBarItem;
  myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	myStatusBarItem.command = 'vscode-eemblang.runSimulator';
	context.subscriptions.push(myStatusBarItem);
  myStatusBarItem.text = `$(run)`;
  myStatusBarItem.tooltip = "Run Simulator";
	myStatusBarItem.show();


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
 
