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


interface CompilationArtifact {
    fileName: string;
    name: string;
    kind: string;
    isTest: boolean;
}

export interface ArtifactSpec {
    easyArgs: string[];
    filter?: (artifacts: CompilationArtifact[]) => CompilationArtifact[];
}

export class Easy {
    constructor(readonly rootFolder: string, readonly output: vscode.OutputChannel) {}

    // Made public for testing purposes
    static artifactSpec(args: readonly string[]): ArtifactSpec {
        const easyArgs = [...args, "--message-format=json"];

        // arguments for a runnable from the quick pick should be updated.
        // see crates\rust-analyzer\src\main_loop\handlers.rs, handle_code_lens
        switch (easyArgs[0]) {
            case "run":
                easyArgs[0] = "build";
                break;
            case "test": {
                if (!easyArgs.includes("--no-run")) {
                    easyArgs.push("--no-run");
                }
                break;
            }
        }

        const result: ArtifactSpec = { easyArgs: easyArgs };
        if (easyArgs[0] === "test" || easyArgs[0] === "bench") {
            // for instance, `crates\rust-analyzer\tests\heavy_tests\main.rs` tests
            // produce 2 artifacts: {"kind": "bin"} and {"kind": "test"}
            result.filter = (artifacts) => artifacts.filter((it) => it.isTest);
        }

        return result;
    }

    private async getArtifacts(spec: ArtifactSpec): Promise<CompilationArtifact[]> {
        const artifacts: CompilationArtifact[] = [];

        try {
            await this.runEasy(
                spec.easyArgs,
                (message) => {
                    if (message.reason === "compiler-artifact" && message.executable) {
                        const isBinary = message.target.crate_types.includes("bin");
                        const isBuildScript = message.target.kind.includes("custom-build");
                        if ((isBinary && !isBuildScript) || message.profile.test) {
                            artifacts.push({
                                fileName: message.executable,
                                name: message.target.name,
                                kind: message.target.kind[0],
                                isTest: message.profile.test,
                            });
                        }
                    } else if (message.reason === "compiler-message") {
                        this.output.append(message.message.rendered);
                    }
                },
                (stderr) => this.output.append(stderr)
            );
        } catch (err) {
            this.output.show(true);
            throw new Error(`Easy invocation has failed: ${err}`);
        }

        return spec.filter?.(artifacts) ?? artifacts;
    }

    async executableFromArgs(args: readonly string[]): Promise<string> {
        const artifacts = await this.getArtifacts(Easy.artifactSpec(args));

        if (artifacts.length === 0) {
            throw new Error("No compilation artifacts");
        } else if (artifacts.length > 1) {
            throw new Error("Multiple compilation artifacts are not supported.");
        }

        return artifacts[0].fileName;
    }

    private async runEasy(
        easyArgs: string[],
        onStdoutJson: (obj: any) => void,
        onStderrString: (data: string) => void
    ): Promise<number> {
        const path = await easyPath();
        return await new Promise((resolve, reject) => {
            const easy = cp.spawn(path, easyArgs, {
                stdio: ["ignore", "pipe", "pipe"],
                cwd: this.rootFolder,
            });

            easy.on("error", (err) => reject(new Error(`could not launch EEmbLang compiler: ${err}`)));

            easy.stderr.on("data", (chunk) => onStderrString(chunk.toString()));

            const rl = readline.createInterface({ input: easy.stdout });
            rl.on("line", (line) => {
                const message = JSON.parse(line);
                onStdoutJson(message);
            });

            easy.on("exit", (exitCode, _) => {
                if (exitCode === 0) resolve(exitCode);
                else reject(new Error(`exit code: ${exitCode}.`));
            });
        });
    }
}

/** Mirrors `project_model::sysroot::discover_sysroot_dir()` implementation*/
export async function getSysroot(dir: string): Promise<string> {
    const easyPath = await getPathForExecutable("eec");

    // do not memoize the result because the toolchain may change between runs
    return await execute(`${easyPath} --print sysroot`, { cwd: dir });
}

export async function getEasyId(dir: string): Promise<string> {
    const easyPath = await getPathForExecutable("eec");

    // do not memoize the result because the toolchain may change between runs
    const data = await execute(`${easyPath} -V -v`, { cwd: dir });
    const rx = /commit-hash:\s(.*)$/m;

    return rx.exec(data)![1];
}

/** Mirrors `toolchain::cargo()` implementation */
export function easyPath(): Promise<string> {
    return getPathForExecutable("eec");
}

export function linkerPath(): Promise<string> {
    return getPathForExecutable("ld.lld");
}

export function ebuildPath(): Promise<string> {
    return getPathForExecutable("ebuild");
}

export function flasherPath(): Promise<string> {
    return getPathForExecutable("eflash");
}




export type ToolchainInfo = {
  label: string;
  file: string;
  description: string;
  ver: string;
  url: string;
}

export type ToolchainsFile = {
  toolchains: ToolchainInfo[];
}


 export async function installToolchain(toolchainInfo: ToolchainInfo): Promise<boolean> {

  
  let homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir(); 
  
  const tmpDir = vscode.Uri.joinPath(
    vscode.Uri.file(homeDir),
    ".eec-tmp"
  );

  const tmpFilePath = vscode.Uri.joinPath(
    vscode.Uri.file(homeDir),
    ".eec-tmp", `${toolchainInfo.file}.zip`
  );

  // const tmpUnzipDirPath = vscode.Uri.joinPath(
  //   vscode.Uri.file(homeDir),
  //   ".eec-tmp", `${toolchainInfo.file}`
  // );

  // const toolchainFilePath = vscode.Uri.joinPath(
  //   vscode.Uri.file(homeDir),
  //   ".eec-tmp", `${toolchainInfo.file}`, ".eec.zip"
  // );

  // const toolchainDirPath = vscode.Uri.joinPath(
  //   vscode.Uri.file(homeDir),
  //   ".eec"
  // );

  const toolchainDirPath = vscode.Uri.joinPath(
      vscode.Uri.file(homeDir)
    );

  if ( ! ( await isDirAtUri(tmpDir) ) )
  {
    vscode.workspace.fs.createDirectory(tmpDir).then(()=>{},  () => {
      console.log('Create dir error!');
    });
  }
    //".eec.zip");

    // const standardPath = vscode.Uri.joinPath(
    //   vscode.Uri.file(homeDir));


  const isExist = ( ( await isFileAtUri(tmpFilePath) ) ) ;

  let result = false;

  const prog = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Downloading...",
      cancellable: true
  }, async (progress, token) => {
      
    progress.report({message: "0 Mbyte", increment: 0});


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
      .on('finish', () => {
        console.log("done");
        progress.report({ message: "Installing...", increment: 0 });
        let unzip = require('unzip-stream');
        // let fsExtra = require('fs-extra'); 
        // fsExtra.createReadStream(tmpFilePath.fsPath).on('error', (err) => {
        //   console.log(err);
        //   (async () => {
        //     let buttons = ['Yes', 'No'];
        //     let choice = await vscode.window.showErrorMessage(`Invalid toolcahin archive!\nDo you want to delete this file?`, ...buttons);
        //     if (choice === buttons[0]) {
        //       fs.rm(tmpFilePath.fsPath, () => {
        //       });
        //     }
        //   })();
        // }).pipe(unzip.Extract({ path: toolchainDirPath.fsPath }));

      let fsExtra = require('fs-extra'); 
      try {
        fsExtra.createReadStream(tmpFilePath.fsPath).pipe(unzip.Extract({ path: toolchainDirPath.fsPath }));
      } catch(err) {
        console.log();
        (async () => {
          let buttons = ['Yes', 'No'];
          let choice = await vscode.window.showErrorMessage(`Invalid toolcahin archive!\nDo you want to delete this file?`, ...buttons);
          if (choice === buttons[0]) {
            fs.rm(tmpFilePath.fsPath, () => {
            });
          }
        })();
      }

        // fsExtra.createReadStream(tmpFilePath.fsPath).pipe(unzip.Extract({ path: tmpUnzipDirPath.fsPath }));
        // progress.report({ message: "Installing...", increment: 50 });
        // fsExtra.createReadStream(toolchainFilePath.fsPath).pipe(unzip.Extract({ path: toolchainDirPath.fsPath }));
        // progress.report({ message: "Installing...", increment: 100 });
        //fsExtra.createReadStream(tmpFilePath.fsPath).pipe(unzip.Extract({ path: toolchainDirPath.fsPath }));
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
    });}

    const result0 = !isExist ? download(toolchainInfo.url, tmpFilePath.fsPath) : true;

    if (isExist) {
      progress.report({ message: "Installing...", increment: 25 });
      let unzip = require('unzip-stream');
      let fsExtra = require('fs-extra'); 
      try {
        fsExtra.createReadStream(tmpFilePath.fsPath).pipe(unzip.Extract({ path: toolchainDirPath.fsPath }));
      } catch(err) {
        console.log();
        (async () => {
          let buttons = ['Yes', 'No'];
          let choice = await vscode.window.showErrorMessage(`Invalid toolcahin archive!\nDo you want to delete this file?`, ...buttons);
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
    while (totalSize > currentSize && !isTerminated)
    {
      await new Promise(f => setTimeout(f, 1000));
      totalSize = totalSize ? totalSize : 1;
       const inPerc = Math.round(((currentSize))*100 / totalSize);
       const inc = inPerc - prevPer;
       prevPer = inPerc;
       const currentSizeInMb =  Math.round((currentSize / 1024) / 1024) ;
       const totalSizeInMb = Math.round((totalSize / 1024) / 1024);
       console.log("["+currentSizeInMb+"/"+totalSizeInMb+" Mbytes]", inPerc);
       progress.report({ message: "["+currentSizeInMb+"/"+totalSizeInMb+" Mbytes]", increment: inc });

       if (token.isCancellationRequested)
       {
          return false;
       }
      // const interval = setInterval(() => 
      // {
       
      // }, 1000);
    }

    result = await result0;

    return;
    });

    console.log("Alarm");

    if (result == false && !isExist && ( ( await isFileAtUri(tmpFilePath) ) ) ) {
      fs.rm(tmpFilePath.fsPath, () => {
      });
    }
    

    return result;
}

type TargetPeriphInfo = {
  aoCount: number;
  relayCount: number;
  uartCount: number;
  uiCount: number;
}

export type TargetInfo = {
  description: string;
  devManId: number;
  devName: string;
  frameWorkVerA: number; 
  frameWorkVerB: number; 
  triplet: string;
  pathToFile: string;
  stdlib: string;
  runtime: string;
  periphInfo: TargetPeriphInfo;
}



export async function getTargets() : Promise<TargetInfo[]> {

  let targetsInfo: Array<TargetInfo> = [];

  const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir(); 
  const targetsDir = vscode.Uri.joinPath(
      vscode.Uri.file(homeDir), ".eec", "targets");




  await vscode.workspace.fs.readDirectory(targetsDir).then( async (files) => {

    for (let element of files ) {

      console.log("file: ", element[0]);
      
      if ( element[1] !=  vscode.FileType.Directory ) {
        //console.log("is not dir");
        continue;
      }

      const targetInfoFile =  vscode.Uri.joinPath(targetsDir, element[0], "targetInfo.json");
      const isExist = await isFileAtUri(targetInfoFile);

      if ( !isExist) {
        continue;
      }

      const raw = fs.readFileSync(targetInfoFile.fsPath).toString();
      const targetInfo = JSON.parse(raw) as TargetInfo;
      targetInfo.pathToFile = targetInfoFile.fsPath;
      targetsInfo.push(targetInfo);
    }

  }, () => {
    console.log("can't find toolchain dir");
  });


  return targetsInfo;
}



export async function getTargetWithDevName(devName: string) : Promise<TargetInfo> {


  const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir(); 
  const targetsDir = vscode.Uri.joinPath(
      vscode.Uri.file(homeDir), ".eec", "targets");

  let result: TargetInfo = {
    description: "Device",
    devManId: 0,
    devName: "Test device",
    frameWorkVerA: 0,
    frameWorkVerB: 22,
    triplet: "thumbv7m-none-none-eabi",
    pathToFile: "",
    periphInfo: {
      aoCount: 3,
      relayCount: 6,
      uartCount: 8,
      uiCount: 11
    },
    stdlib: "armv7m",
    runtime: "clang_rt.builtins-armv7m"
  };

  await vscode.workspace.fs.readDirectory(targetsDir).then( async (files) => {


    for (const element of files ) {

      if ( element[1] !=  vscode.FileType.Directory ) {
        //console.log("is not dir");
        continue;
      }

      const targetInfoFile =  vscode.Uri.joinPath(targetsDir, element[0], "targetInfo.json");
      const isExist = await isFileAtUri(targetInfoFile);

      if ( !isExist) {
        continue;
      }

      const raw = fs.readFileSync(targetInfoFile.fsPath).toString();
      const targetInfo = JSON.parse(raw) as TargetInfo;
      targetInfo.pathToFile = targetInfoFile.fsPath;

      if (targetInfo.description != devName)
      {
        if (result.description == "IS20C01D test") {
            result = targetInfo;
        }
        continue;
      }

      result = targetInfo;
    }

    // files.forEach(element => {
    //   console.log("file: ", element[0]);
    // }); 
  }, () => {
    console.log("can't find toolchain dir");
  });

  return result;
}




function getVerToInt(str: string) : number {
  let nums = str.split('.', 3);
  return (parseInt(nums[0]) << 16) | (parseInt(nums[1]) << 8) << (parseInt(nums[2]));
}

async function getLastToolchainInfo() : Promise<ToolchainInfo | undefined> {

  let lastToolchain: ToolchainInfo | undefined = undefined;

  const response = await fetch("https://github.com/Retrograd-Studios/eemblangtoolchain/raw/main/toolchain.json").catch((e)=>{
    console.log(e);
    return undefined;
  });

  if (response === undefined) {
    return undefined;
  }

  const data = await response.json() as ToolchainsFile;
  
  for (var toolchainInfo of data.toolchains) {
    // if ( lastToolchain == undefined ) {
    //   lastToolchain = toolchainInfo;
    //   continue;
    // }
    if ( lastToolchain == undefined || getVerToInt(toolchainInfo.ver) >  getVerToInt(lastToolchain.ver) ) {
      lastToolchain = toolchainInfo;
    }
  }

  return lastToolchain;
}


export async function checkToolchain(): Promise<boolean> {  

  //let path = await toolchain.easyPath();
  //console.log(path);
  const homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir(); 
  // const standardTmpPath = vscode.Uri.joinPath(
  //   vscode.Uri.file(homeDir),
  //   ".eec.zip");

  //   const standardPath = vscode.Uri.joinPath(
  //     vscode.Uri.file(homeDir));
  //   console.log(standardTmpPath);

  const verFile = vscode.Uri.joinPath(
      vscode.Uri.file(homeDir), ".eec", "toolchain.json");

  const toolchainFile = await isFileAtUri(verFile);

  if (!toolchainFile) {
    let buttons = ['Install', 'Not now'];
    let choice = await vscode.window.showWarningMessage(`EEmbLang Toolchain is not installed!\nDo you want Download and Install now?`, ...buttons);
    if (choice === buttons[0]) {
      const toolchainInfo = await getLastToolchainInfo();
      let res = toolchainInfo != undefined ? await installToolchain(toolchainInfo) : false;
      if (!res) {
        vscode.window.showErrorMessage(`Error: EEmbLang Toolchain is not installed!\nCan't download file`);
      }
      await new Promise(f => setTimeout(f, 3000));
      await vscode.commands.executeCommand('vscode-eemblang.command.setTargetDevice');
      return res;
    }
    return false;
  }

  // type CfgType = {
  //   ver: string;
  // }
  
  // function isCfgType(o: any): o is CfgType {
  //   return "ver" in o 
  // }
  
  const lastToolchain = await getLastToolchainInfo();
  if (lastToolchain == undefined)
  {
    return true;
  }
  // const parsed = JSON.parse(json)
  //if (isCfgType(data)) {
    //console.log(data.ver);

    const raw = fs.readFileSync(verFile.fsPath).toString();
    const currentVer = JSON.parse(raw);

      if (currentVer.ver != lastToolchain.ver) {
        let buttons = ['Install', 'Not now'];
        let choice = await vscode.window.showInformationMessage(`New  EEPL Toolchain (v${lastToolchain.ver}) is available!\nDo you want Download and Install now?`, ...buttons);
        if (choice === buttons[0]) {
          return await installToolchain(lastToolchain);
        }
      }
  //}

  return true;

}





/** Mirrors `toolchain::get_path_for_executable()` implementation */
export const getPathForExecutable = memoizeAsync(
    // We apply caching to decrease file-system interactions
    async (executableName: "eec" | "EEcompiler" | "easy" | "st-util" | "ld.lld" | "ebuild"| "eflash"): Promise<string> => {
        {
            const envVar = process.env[executableName.toUpperCase()];
            if (envVar) return envVar;
        }

        if (await lookupInPath(executableName)) return executableName;

        try {
            // hmm, `os.homedir()` seems to be infallible
            // it is not mentioned in docs and cannot be inferred by the type signature...

            let homeDir = os.type() === "Windows_NT" ? os.homedir() : os.homedir(); 

            const standardPath = vscode.Uri.joinPath(
                vscode.Uri.file(homeDir),
                ".eec",
                "bin",
                os.type() === "Windows_NT" ? `${executableName}.exe` : executableName
            );

            console.log ( "standardPath: ", standardPath, standardPath.fsPath );

            if (await isFileAtUri(standardPath)) return standardPath.fsPath;
        } catch (err) {
            log.error("Failed to read the fs info", err);
        }
        return "notFound";
    }
);

async function lookupInPath(exec: string): Promise<boolean> {
    const paths = process.env.PATH ?? "";

    console.log(os.type());

    const candidates = paths.split(path.delimiter).flatMap((dirInPath) => {
        const candidate = path.join(dirInPath, exec);
        return os.type() === "Windows_NT" ? [candidate, `${candidate}.exe`] : [candidate];
    });

    for await (const isFile of candidates.map(isFileAtPath)) {
        if (isFile) {
            return true;
        }
    }
    return false;
}

async function isFileAtPath(path: string): Promise<boolean> {
    return isFileAtUri(vscode.Uri.file(path));
}

export async function isFileAtUri(uri: vscode.Uri): Promise<boolean> {
    try {
        return ((await vscode.workspace.fs.stat(uri)).type & vscode.FileType.File) !== 0;
    } catch {
        return false;
    }
}

export async function isDirAtUri(uri: vscode.Uri): Promise<boolean> {
  try {
      return ((await vscode.workspace.fs.stat(uri)).type & vscode.FileType.Directory) !== 0;
  } catch {
      return false;
  }
}