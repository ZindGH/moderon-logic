import * as vscode from "vscode";
import * as toolchain from "./toolchain";
import { Config } from "./config";
import * as os from "os";
import { log } from "./util";

export const TASK_TYPE = "eec";
export const TASK_SOURCE = "eemblang";

import * as path from "path";
import { fstat } from "fs";
import { rejects } from "assert";

import * as nodePath from 'path';
import { openStdin } from "process";
import { Console } from "console";

const posixPath = nodePath.posix || nodePath;

export interface EasyTaskDefinition extends vscode.TaskDefinition {
    command?: string;
    args?: string[];
    cwd?: string;
    env?: { [key: string]: string };
    overrideEasy?: string;
    dependsOn?: string;
}

let isFoundToolchain = false;

class EasyTaskProvider implements vscode.TaskProvider {
    private readonly config: Config;

    constructor(config: Config) {
        this.config = config;
    }

    async provideTasks(): Promise<vscode.Task[]> {
        // Detect Rust tasks. Currently we do not do any actual detection
        // of tasks (e.g. aliases in .cargo/config) and just return a fixed
        // set of tasks that always exist. These tasks cannot be removed in
        // tasks.json - only tweaked.

        const pathToEec  = await toolchain.easyPath();
        const pathToLinker  = await toolchain.linkerPath();
        const pathToEbuild  = await toolchain.ebuildPath();

        const defs = [
            { command: "build", name: "Build for Device", args: ["-target", "thumbv7m-none-none-eabi", "-emit-llvm", "-g", "-O3"], group: vscode.TaskGroup.Build },
            { command: "simulate", name: "Run Simulator", args: ["-jit", "-S", "-emit-llvm", "-g", "-O3"], group: undefined },
            { command: "link", name: "linker", args: [
                "${cwd}\\out\\output.o",
                "--format=elf",
                "--Map=${cwd}\\out\\target.map",
                "${cwd}\\out\\target.ld",
                "-o",
                "${cwd}\\out\\target.o",
                "-nostdlib" ]
            , group: undefined, /*dependsOn: "eemblang: Build for Device"*/ },
            { command: "ebuild", name: "buildAELF", args: [
                "-f", "${cwd}\\out\\target_out.o",
                "-o", "${cwd}\\out\\prog.alf",
                "-m", "${cwd}\\out\\output.map",
                "-c", "${cwd}\\out\\test.cpp_CFG.bin",
                "-r", "${cwd}\\out\\test.cpp_RES.bin" ]
                , group: undefined }
        ];

        const tasks: vscode.Task[] = [];
        for (const workspaceTarget of vscode.workspace.workspaceFolders || []) {
            for ( const def of defs ) {
                var args0;
                
                if ( def.command == "link" || def.command == "ebuild"  )
                {
                    args0 = def.args;
                }
                else
                {
                    args0 = [`${workspaceTarget.uri.fsPath}/main.es`].concat(def.args);
                }
                const vscodeTask = await buildEasyTask(
                workspaceTarget,
                { type: TASK_TYPE, command: def.command, args: args0 },
                def.name,
                args0,
                this.config.easyRunner
                );
                vscodeTask.group = def.group;
                tasks.push( vscodeTask ); 
            }
        }
        return tasks;
    }


   



    async resolveTask( task: vscode.Task ): Promise<vscode.Task | undefined> {
        // VSCode calls this for every cargo task in the user's tasks.json,
        // we need to inform VSCode how to execute that command by creating
        // a ShellExecution for it.
        if (!isFoundToolchain) {
            isFoundToolchain = await toolchain.checkToolchain();
            if (!isFoundToolchain)
            {
                vscode.window.showErrorMessage(`EEmbLang Compiler is not installed! Can't find toolchain`);
                return undefined;
            }
        }

        const definition = task.definition as EasyTaskDefinition;

        if ( definition.type === TASK_TYPE && definition.command ) {
            return await buildEasyTask(
                task.scope,
                definition,
                task.name,
                definition.args ?? [],
                this.config.easyRunner
            );
        }

        return undefined;
    }
}


export async function createTask(idx: number, config: Config): Promise<vscode.Task> {


    if (!isFoundToolchain) {
        isFoundToolchain = await toolchain.checkToolchain();
        if (!isFoundToolchain)
        {
            vscode.window.showErrorMessage(`EEmbLang Compiler is not installed! Can't find toolchain`);
            return new Promise((resolve, reject) => { reject(); });
        }
    }

    let workspaceTarget: vscode.WorkspaceFolder | undefined = undefined; 

    for (const workspaceTarget0 of vscode.workspace.workspaceFolders || []) {
        workspaceTarget = workspaceTarget0;
        break;
    }


    let ldPath = await toolchain.easyPath();
    const pIdx = ldPath.lastIndexOf("bin");
    let libPath = "";
    if (pIdx !== -1)
    {
        libPath = ldPath.substring(0, pIdx-1) + "/";
        ldPath = ldPath.substring(0, pIdx-1) + "/targets/target_out.ld";
    }

    const defs = [
        { command: "build", name: "Build for Device", args: ["-target", "thumbv7m-none-none-eabi", "-emit-llvm", "-g", "-O3"], group: vscode.TaskGroup.Build },
        { command: "simulate", name: "Run Simulator", args: ["-jit", "-S", "-emit-llvm", "-g", "-O3"], group: undefined },
        { command: "link", name: "linker", args: [
            "${cwd}\\out\\output.o",
            `${libPath}bin/dl7M_tln.a`,
            `${libPath}bin/m7M_tl.a`,
            // `${libPath}targets/v7-m/nofp/libc.a`,
            // `${libPath}targets/v7-m/nofp/libg.a`,
            // `${libPath}targets/v7-m/nofp/libm.a`,
           // `${libPath}targets/v7-m/nofp/libsemihost.a`,
            //`${libPath}targets/v7-m/nofp/crt0.o`,
            //`${libPath}targets/v7-m/nofp/crt0-hosted.o`,
            //`${libPath}targets/v7-m/nofp/crt0-semihost.o`,
           // `${libPath}bin/rt7M_tl.a`,
            //`${libPath}bin/shb_l.a`,
            "--format=elf",
            "--Map=${cwd}\\out\\output.map",
            ldPath,
            "-o",
            "${cwd}\\out\\output.elf",
            "-nostdlib" ]
        , group: undefined/*, dependsOn: "eemblang: Build for Device"*/ },
        { command: "ebuild", name: "buildAELF", args: [
            "-f", "${cwd}\\out\\output.elf",
            "-o", "${cwd}\\out\\prog.alf",
            "-m", "${cwd}\\out\\output.map",
            "-c", "${cwd}\\out\\output_CFG.bin",
            "-r", "${cwd}\\out\\output_RES.bin" ]
            , group: undefined/*, dependsOn: "eemblang: linker" */},
        { command: "flaher", name: "EEmbFlasher", args: ["${cwd}\\out\\prog.alf"], group: undefined  }
    ];


    

    const def = defs[idx];


    const args0 = (idx == 0 || idx == 1) ? [`${workspaceTarget!.uri.fsPath}/main.es`].concat(def.args) : def.args;

    const vscodeTask = await buildEasyTask(
        workspaceTarget,
        { type: TASK_TYPE, command: def.command, args: args0 },
        def.name,
        args0,
        config.easyRunner
        );
        vscodeTask.group = def.group;
        vscodeTask.presentationOptions.showReuseMessage = false;

    return vscodeTask;
}



export async function buildEasyTask(
    scope: vscode.WorkspaceFolder | vscode.TaskScope | undefined,
    definition: EasyTaskDefinition,
    name: string,
    args: string[],
    customRunner?: string,
    throwOnError: boolean = false
): Promise<vscode.Task> {
    let exec: vscode.ProcessExecution | vscode.ShellExecution | undefined = undefined;

console.log( "command: ", definition.command );

    if ( definition.command == "link"  || definition.command == "ebuild" || definition.command == "flaher" )
    {
        if ( !exec ) {
            // Check whether we must use a user-defined substitute for cargo.
            // Split on spaces to allow overrides like "wrapper cargo".
            const overrideEasy= definition.overrideEasy ?? definition.overrideEasy;

            var easyPath  = await toolchain.linkerPath();
            
            if ( definition.command == "ebuild" )
            {
                easyPath = await toolchain.ebuildPath();
            }
            else if ( definition.command == "flaher" )
            {
                easyPath = await toolchain.flasherPath();
            }

            const easyCommand = overrideEasy?.split(" ") ?? [easyPath];
    
            const fullCommand = [...easyCommand, ...args];
    
            exec = new vscode.ProcessExecution( fullCommand[0], fullCommand.slice(1), definition );
        }
    }
    else
    {
    if ( !exec ) {
        // Check whether we must use a user-defined substitute for cargo.
        // Split on spaces to allow overrides like "wrapper cargo".
        const overrideEasy= definition.overrideEasy ?? definition.overrideEasy;
        const easyPath = await toolchain.easyPath();
        const easyCommand = overrideEasy?.split(" ") ?? [easyPath];

        const index = args.indexOf("-o", 0);
        if (index == -1) {
            let uri = vscode.Uri.file(args[0]);
            let path = "";
            try {
                let stat = (await vscode.workspace.fs.stat(uri));
                if (stat.type == vscode.FileType.File) {
                    path = posixPath.dirname(uri.path);
                    path = path.concat("/out/output");
                    if (os.type() === "Windows_NT" && path[0] == '/') {
                        path = path.slice(1);
                    }
                }
                else {
                    path = args[0].concat("/out/output");
                }
            } catch {
                vscode.window.showErrorMessage(`Can't compile file '${args[0]}'`);
                return new Promise(function(resolve, reject) {
                    reject("Error");
                });
            }
            args = args.concat(["-o", path]);
            uri = vscode.Uri.file(posixPath.dirname(path));
            (await (vscode.workspace.fs.stat(uri)).then(()=>{}, () => {
                vscode.workspace.fs.createDirectory(uri);
            }));
        }
        
        const fullCommand = [...easyCommand, ...args];

        exec = new vscode.ProcessExecution( fullCommand[0], fullCommand.slice(1), definition );
    }
    }
    return new vscode.Task(
        definition,
        // scope can sometimes be undefined. in these situations we default to the workspace taskscope as
        // recommended by the official docs: https://code.visualstudio.com/api/extension-guides/task-provider#task-provider)
        scope ?? vscode.TaskScope.Workspace,
        name,
        TASK_SOURCE,
        exec,
        ["$eec"]
    );
}

export function activateTaskProvider(config: Config): vscode.Disposable {
    const provider = new EasyTaskProvider(config);
    return vscode.tasks.registerTaskProvider(TASK_TYPE, provider);
}