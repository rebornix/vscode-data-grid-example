// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CancellationToken, ProviderResult, CancellationError, Event, Uri } from 'vscode';
import type { Kernel } from '@jupyterlab/services/lib/kernel';
import type { Session } from '@jupyterlab/services';

export interface Jupyter {
    /**
     * Creates a Jupyter Server Collection that can be displayed in the Notebook Kernel Picker.
     *
     * The ideal time to invoke this method would be when a Notebook Document has been opened.
     * Calling this during activation of the extension might not be ideal, as this would result in
     * unnecessarily activating the Jupyter extension as well.
     *
     * Extensions can use this API to provide a list of Jupyter Servers to VS Code users with custom authentication schemes.
     * E.g. one could provide a list of Jupyter Servers that require Kerberos authentication or other.
     */
    createJupyterServerCollection(
        id: string,
        label: string,
        serverProvider: JupyterServerProvider
    ): JupyterServerCollection;

    ready: Promise<void>;

    getKernelService(): Promise<IExportedKernelService | undefined>;
}

/**
 * Provides information required to connect to a Jupyter Server.
 */
export interface JupyterServerConnectionInformation {
    /**
     * Base Url of the Jupyter Server.
     * E.g. http://localhost:8888 or http://remoteServer.com/hub/user/, etc.
     */
    readonly baseUrl: Uri;
    /**
     * Jupyter Authentication Token.
     * When starting Jupyter Notebook/Lab, this can be provided using the --NotebookApp.token=<token> argument.
     * Also when starting Jupyter Notebook/Lab in CLI the token is part of the query string, see here: http://localhost:8888/lab?token=<token>
     */
    readonly token?: string;
    /**
     * HTTP header to be used when connecting to the server.
     * If a {@link token token} is not provided, then headers will be used to connect to the server.
     */
    readonly headers?: Record<string, string>;

    /**
     * Returns the sub-protocols to be used. See details of `protocols` here https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/WebSocket
     * Useful if there is a custom authentication scheme that needs to be used for WebSocket connections.
     * Note: The client side npm package @jupyterlab/services uses WebSockets to connect to remote Kernels.
     *
     * This is useful in the context of vscode.dev or github.dev or the like where the remote Jupyter Server is unable to read the cookies/headers sent from client as part of {@link JupyterServerConnectionInformation.headers headers}.
     */
    readonly webSocketProtocols?: string[];
}

/**
 * Represents a Jupyter Server displayed in the list of Servers.
 * Each server can have its own authentication scheme (token based, username/password or other).
 * See {@link JupyterServerProvider.resolveJupyterServer} for more information.
 */
export interface JupyterServer {
    /**
     * Unique identifier for this server.
     */
    readonly id: string;
    /**
     * A human-readable string representing the name of the Server.
     */
    readonly label: string;
    /**
     * Information required to Connect to the Jupyter Server.
     * This can be eagerly provided by the extension or lazily provided by the extension.
     * For instance of the authentication mechanism is straight forward (e.g. token based), then the extension can provide this information eagerly.
     * Else then information required to connect to the server will be retrieved via {@link JupyterServerProvider.resolveJupyterServer}.
     */
    readonly connectionInformation?: JupyterServerConnectionInformation;
}

/**
 * Provider of Jupyter Servers.
 */
export interface JupyterServerProvider {
    /**
     * Event fired when the list of servers change.
     * Note: The method {@link provideJupyterServers} will not be called unless changes are detected.
     */
    onDidChangeServers?: Event<void>;
    /**
     * Returns the list of {@link JupyterServer Jupyter Servers} or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     */
    provideJupyterServers(token: CancellationToken): ProviderResult<JupyterServer[]>;
    /**
     * Returns the connection information for the Jupyter server.
     * It is OK to return the given `server`. When no result is returned, the given `server` will be used.
     */
    resolveJupyterServer(server: JupyterServer, token: CancellationToken): ProviderResult<JupyterServer>;
}

/**
 * Represents a reference to a Jupyter Server command.
 * Each command allows the user to perform an action, such as starting a new Jupyter Server.
 */
export interface JupyterServerCommand {
    /**
     * A human-readable string which is rendered prominent.
     */
    label: string;
    /**
     * A human-readable string which is rendered less prominent on the same line.
     */
    description?: string;
}

/**
 * Provider of {@link JupyterServerCommand Jupyter Server Commands}.
 * Each command allows the user to perform an action, such as starting a new Jupyter Server.
 */
export interface JupyterServerCommandProvider {
    /**
     * Returns a list of commands to be displayed to the user.
     * @param value The value entered by the user in the quick pick.
     */
    provideCommands(value: string | undefined, token: CancellationToken): ProviderResult<JupyterServerCommand[]>;
    /**
     * Invoked when a {@link JupyterServerCommand command} has been selected.
     * @param command The {@link JupyterServerCommand command} selected by the user.
     * @returns The {@link JupyterServer Jupyter Server} or a thenable that resolves to such. The lack of a result can be
     * signaled by returning `undefined` or `null`.
     *
     * Returning `undefined` or `null` will result in the previous UI being displayed, this will most likely be the Notebook Kernel Picker.
     * Thus extensions can implement a back button like behavior in their UI by returning `undefined` or `null` from this method.
     * If however users exit the UI or workflow (if any provided by 3rd party extension) by selecting a close button or hitting the `ESC` key or the like,
     * extensions are then expected to throw a {@link CancellationError}, else the previous UI will be once again, which might not be desirable.
     */
    handleCommand(command: JupyterServerCommand, token: CancellationToken): ProviderResult<JupyterServer>;
}

/**
 * Represents a logical collection of {@link JupyterServer Jupyter Servers}.
 * Each collection is represented as a separate entry in the Notebook Kernel Picker.
 * Extensions can contribute multiple collections, each with one or more {@link JupyterServer Jupyter Servers}.
 */
export interface JupyterServerCollection {
    /**
     * Unique identifier of the Server Collection.
     */
    readonly id: string;
    /**
     * A human-readable string representing the collection of the Servers. This can be read and updated by the extension.
     */
    label: string;
    /**
     * A link to a resource containing more information. This can be read and updated by the extension.
     */
    documentation?: Uri;
    /**
     * Provider of {@link JupyterServerCommand Commands}. This can be read and updated by the extension.
     */
    commandProvider?: JupyterServerCommandProvider;
    /**
     * Removes this Server Collection.
     */
    dispose(): void;
}


export type WebSocketData = string | Buffer | ArrayBuffer | Buffer[];

export interface IKernelSocket {
    /**
     * Whether the kernel socket is read & available for use.
     * Use `onDidChange` to be notified when this changes.
     */
    ready: boolean;
    /**
     * Event fired when the underlying socket state changes.
     * E.g. when the socket is connected/available or changes to another socket.
     */
    onDidChange: Event<void>;
    /**
     * Sends data to the underlying Jupyter kernel over the socket connection.
     * This bypasses all of the jupyter kernel comms infrastructure.
     */
    sendToRealKernel(data: any, cb?: (err?: Error) => void): void;
    /**
     * Adds a listener to a socket that will be called before the socket's onMessage is called. This
     * allows waiting for a callback before processing messages
     */
    addReceiveHook(hook: (data: WebSocketData) => Promise<void>): void;
    /**
     * Removes a listener for the socket. When no listeners are present, the socket no longer blocks
     */
    removeReceiveHook(hook: (data: WebSocketData) => Promise<void>): void;
    /**
     * Adds a hook to the sending of data from a websocket. Hooks can block sending so be careful.
     */
    addSendHook(hook: (data: any, cb?: (err?: Error) => void) => Promise<void>): void;
    /**
     * Removes a send hook from the socket.
     */
    removeSendHook(hook: (data: any, cb?: (err?: Error) => void) => Promise<void>): void;
}

export type IKernelConnectionInfo = {
    /**
     * Gives access to the jupyterlab Kernel.IKernelConnection object.
     */
    connection: Kernel.IKernelConnection;
    /**
     * Underlying socket used by jupyterlab/services to communicate with kernel.
     * See jupyterlab/services/kernel/default.ts
     */
    kernelSocket: IKernelSocket;
};

export interface IExportedKernelService {
    readonly status: 'discovering' | 'idle';
    /**
     * Changes in kernel state (e.g. discovered kernels, not discovering kernel, etc).
     */
    onDidChangeStatus: Event<void>;
    /**
     * List of running kernels changed.
     */
    onDidChangeKernels: Event<void>;
    /**
     * List of kernel specs changed.
     */
    onDidChangeKernelSpecifications: Event<void>;
    /**
     * Gets a list of all kernel specifications that can be used to start a new kernel or to connect to an existing kernel.
     * Local, remote kernels are returned, including Python interpreters that
     * are treated as kernelspecs (as we can start Kernels for Python interpreters without Jupyter).
     */
    getKernelSpecifications(): Promise<KernelConnectionMetadata[]>;
    /**
     * Gets a list of all active kernel connections.
     * If `uri` is undefined, then the kernel is not associated with any resource. I.e its currently not associated with any notebook in Jupyter extension.
     * If `uri` is undefined, then the kernel is associated with the resource identified by the Uri.
     */
    getActiveKernels(): { metadata: KernelConnectionMetadata; uri: Uri | undefined }[];
    /**
     * Gets the Kernel connection & the metadata that's associated with a given resource.
     * (only successfully started/active connections are returned).
     */
    getKernel(uri: Uri): { metadata: KernelConnectionMetadata; connection: IKernelConnectionInfo } | undefined;
    /**
     * Starts a kernel for a given resource.
     * The promise is resolved only after the kernel has successfully started.
     * If one attempts to start another kernel for the same resource, the same promise is returned.
     */
    startKernel(
        metadata: KernelConnectionMetadata,
        uri: Uri,
        token?: CancellationToken
    ): Promise<IKernelConnectionInfo>;
    /**
     * Connects an existing kernel to a resource.
     * The promise is resolved only after the kernel is successfully attached to a resource.
     * If one attempts to start another kernel or connect another kernel for the same resource, the same promise is returned.
     */
    connect(metadata: LiveRemoteKernelConnectionMetadata, uri: Uri): Promise<IKernelConnectionInfo>;
}

//#region Kernel Information (Kernel Specs, connections)
    /**
     * Details of the kernel spec.
     * See https://jupyter-client.readthedocs.io/en/stable/kernels.html#kernel-specs
     */
    export interface IJupyterKernelSpec {
        /**
         * Id of an existing (active) Kernel from an active session.
         */
        id?: string;
        name: string;
        /**
         * The name of the language of the kernel
         */
        language?: string;
        path: string;
        /**
         * A dictionary of environment variables to set for the kernel.
         * These will be added to the current environment variables before the kernel is started.
         */
        env?: NodeJS.ProcessEnv | undefined;
        /**
         * Kernel display name.
         */
        readonly display_name: string;
        /**
         * A dictionary of additional attributes about this kernel; used by clients to aid in kernel selection.
         * Optionally storing the interpreter information in the metadata (helping extension search for kernels that match an interpreter).
         * Metadata added here should be namespaced for the tool reading and writing that metadata.
         */
        readonly metadata?: Record<string, unknown> & { interpreter?: Partial<PythonEnvironment> };
        /**
         * A list of command line arguments used to start the kernel.
         * The text {connection_file} in any argument will be replaced with the path to the connection file.
         */
        readonly argv: string[];
        /**
         * Optionally where this kernel spec json is located on the local FS.
         */
        specFile?: string;
        /**
         * Optionally the Interpreter this kernel spec belongs to.
         * You can have kernel specs that are scoped to an interpreter.
         * E.g. if you have Python in `c:\Python\Python3.8`
         * Then you could have kernels in `<sys.prefix folder for this interpreter>\share\jupyter\kernels`
         * Plenty of conda packages ship kernels in this manner (beakerx, java, etc).
         */
        interpreterPath?: string;
        /**
         * May be either signal or message and specifies how a client is supposed to interrupt cell execution on this kernel,
         * either by sending an interrupt signal via the operating system’s signalling facilities (e.g. SIGINT on POSIX systems),
         * or by sending an interrupt_request message on the control channel.
         * If this is not specified the client will default to signal mode.
         */
        readonly interrupt_mode?: 'message' | 'signal';
    }
    /**
     * Connection metadata for Kernels started using kernelspec (JSON).
     * This could be a raw kernel (spec might have path to executable for .NET or the like).
     * If the executable is not defined in kernelspec json, & it is a Python kernel, then we'll use the provided python interpreter.
     */
    export type LocalKernelSpecConnectionMetadata = Readonly<{
        kernelModel?: undefined;
        kernelSpec: IJupyterKernelSpec;
        /**
         * Indicates the interpreter that may be used to start the kernel.
         * If possible to start a kernel without this Python interpreter, then this Python interpreter will be used for intellisense & the like.
         * This interpreter could also be the interpreter associated with the kernel spec that we are supposed to start.
         */
        interpreter?: PythonEnvironment;
        kind: 'startUsingLocalKernelSpec';
        id: string;
    }>;
    /**
     * Connection metadata for Remote Kernels started using kernelspec (JSON).
     * This could be a raw kernel (spec might have path to executable for .NET or the like).
     * If the executable is not defined in kernelspec json, & it is a Python kernel, then we'll use the provided python interpreter.
     */
    export type RemoteKernelSpecConnectionMetadata = Readonly<{
        kernelModel?: undefined;
        interpreter?: undefined;
        kernelSpec: IJupyterKernelSpec;
        kind: 'startUsingRemoteKernelSpec';
        baseUrl: string;
        id: string;
    }>;
    /**
     * Connection metadata for Kernels started using Python interpreter.
     * These are not necessarily raw (it could be plain old Jupyter Kernels, where we register Python interpreter as a kernel).
     * We can have KernelSpec information here as well, however that is totally optional.
     * We will always start this kernel using old Jupyter style (provided we first register this interpreter as a kernel) or raw.
     */
    export type PythonKernelConnectionMetadata = Readonly<{
        kernelSpec: IJupyterKernelSpec;
        interpreter: PythonEnvironment;
        kind: 'startUsingPythonInterpreter';
        id: string;
    }>;
    interface IJupyterKernel {
        /**
         * Id of an existing (active) Kernel from an active session.
         */
        id?: string;
        name: string;
    }

    export type LiveKernelModel = IJupyterKernel &
        Partial<IJupyterKernelSpec> & { model: Session.IModel | undefined; notebook?: { path?: string } };

    /**
     * Connection metadata for Live Kernels.
     * With this we are able connect to an existing kernel (instead of starting a new session).
     */
    export type LiveRemoteKernelConnectionMetadata = Readonly<{
        kernelModel: LiveKernelModel;
        /**
         * Python interpreter will be used for intellisense & the like.
         */
        interpreter?: PythonEnvironment;
        baseUrl: string;
        kind: 'connectToLiveRemoteKernel';
        id: string;
    }>;

    export type KernelConnectionMetadata =
        | LocalKernelSpecConnectionMetadata
        | RemoteKernelSpecConnectionMetadata
        | PythonKernelConnectionMetadata
        | LiveRemoteKernelConnectionMetadata;
    export type ActiveKernel = LiveRemoteKernelConnectionMetadata;
    //#endregion


    //#region Python Env Information (soon to be deprecated in favour of Python Extensions new Environments API)
    /**
     * The supported Python environment types.
     */
    export enum EnvironmentType {
        Unknown = 'Unknown',
        Conda = 'Conda',
        VirtualEnv = 'VirtualEnv',
        Pipenv = 'PipEnv',
        Pyenv = 'Pyenv',
        Venv = 'Venv',
        Poetry = 'Poetry',
        VirtualEnvWrapper = 'VirtualEnvWrapper'
    }

    /**
     * A representation of a Python runtime's version.
     */
    export type PythonVersion = {
        /**
         * The original version string.
         */
        raw: string;
        major: number;
        minor: number;
        patch: number;
    };
    export type PythonEnvironment = {
        id: string;
        displayName?: string;
        uri: Uri;
        version?: PythonVersion;
        sysPrefix: string;
        envType?: EnvironmentType;
        envName?: string;
        envPath?: Uri;
    };
    //#endregion


    export type KernelConnectionMetadataWithKernelSpecs =
    | Exclude<KernelConnectionMetadata, LiveRemoteKernelConnectionMetadata>
    | (LiveRemoteKernelConnectionMetadata & { kernelSpec: undefined });