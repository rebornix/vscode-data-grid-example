import { Disposable, Webview, WebviewPanel, window, Uri, ViewColumn, extensions, workspace, NotebookDocument, CancellationTokenSource, NotebookCellOutputItem } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { Jupyter, Kernel } from "./jupyterAPI";

interface DataFrameColumns {
  columns: {
    key: string;
    name: string;
    type: string;
  }[];
  indexColumn: string;
  rowCount: number;
}

interface DataFrameValues {
  columns: string[];
  index: number[];
  data: (number | string)[][];
}

const DataFrameFunc = '_VSCODE_getDataFrame';
const cleanupCode = `
try:
    del _VSCODE_getDataFrame
except:
    pass
`;

const ErrorMimeType = NotebookCellOutputItem.error(new Error('')).mime;
                            
/**
 * This class manages the state and behavior of HelloWorld webview panels.
 *
 * It contains all the data and methods for:
 *
 * - Creating and rendering HelloWorld webview panels
 * - Properly cleaning up and disposing of webview resources when the panel is closed
 * - Setting the HTML (and by proxy CSS/JavaScript) content of the webview panel
 * - Setting message listeners so data can be passed between the webview and extension
 */
export class HelloWorldPanel {
  public static currentPanel: HelloWorldPanel | undefined;
  private readonly _panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _columns: DataFrameColumns | undefined;
  private _values: DataFrameValues | undefined;

  /**
   * The HelloWorldPanel class private constructor (called only from the render method).
   *
   * @param panel A reference to the webview panel
   * @param extensionUri The URI of the directory containing the extension
   */
  private constructor(panel: WebviewPanel, extensionUri: Uri, notebook: NotebookDocument | undefined, variable: string | undefined) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);


    const jupyterApi = extensions.getExtension<Jupyter>('ms-toolsai.jupyter')?.exports;

    if (jupyterApi && variable && notebook) {
      this.initialize(extensionUri, jupyterApi, notebook, variable);
    } else {
      this._initializeWebview(extensionUri);
    }
  }

  private _initializeWebview(extensionUri: Uri) {
    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);
  }

  initialize(extensionUri: Uri, jupyterApi: Jupyter, notebook: NotebookDocument, variable: string) {
    jupyterApi.kernels.getKernel(notebook.uri).then(async (kernel) => {
      if (!kernel) {
        return;
      }

      const fetchVariableValueCode = await this._generateCodeForDataFrameColumns(extensionUri, variable);
      const result = await this._runCode(kernel, fetchVariableValueCode);
      const value = JSON.parse(result) as DataFrameColumns;
      this._columns = value;
      const fetchVariableValueCode2 = await this._generateCodeForDataFrameRows(extensionUri, variable, 0, this._columns.rowCount - 1);
      const result2 = await this._runCode(kernel, fetchVariableValueCode2);
      const value2 = JSON.parse(result2) as DataFrameValues;
      this._values = value2;
      this._initializeWebview(extensionUri);
    });
  }

  private async _runCode(kernel: Kernel, code: string) {
    const tokenSource = new CancellationTokenSource();
    const textDecoder = new TextDecoder();
    let streamingOutput: string[] = [];
    try {
      for await (const outputs of kernel.executeCode(code, tokenSource.token)) {
        for (const output of outputs) {
          if (output.mime === ErrorMimeType) {
            const error = JSON.parse(textDecoder.decode(output.data)) as Error;
            console.log(
              `Error executing code ${error.name}: ${error.message},/n ${error.stack}`
            );
          } else {
            streamingOutput.push(textDecoder.decode(output.data));
          }
        }
      }
    } finally {
      tokenSource.dispose();
    }

    return streamingOutput.join('');
  }

  private async _generateCodeForDataFrameColumns(extensionUri: Uri, variableName: string) {
    // fs read file sync from vscodeDataFrame.py
    const path = Uri.joinPath(extensionUri, 'pythonFiles', 'vscodeDataFrame.py');
    const data = await workspace.fs.readFile(path);
    const initializeCode = Buffer.from(data).toString('utf-8');
    const code = `${DataFrameFunc}("info", False, ${variableName})`;
    return `${initializeCode}\n\n${code}\n\n${cleanupCode}`;
  }

  private async _generateCodeForDataFrameRows(extensionUri: Uri, variableName: string, startIndex: number, endIndex: number) {
    // fs read file sync from vscodeDataFrame.py
    const path = Uri.joinPath(extensionUri, 'pythonFiles', 'vscodeDataFrame.py');
    const data = await workspace.fs.readFile(path);
    const initializeCode = Buffer.from(data).toString('utf-8');
    const code = `${DataFrameFunc}("rows", False, ${variableName}, ${startIndex}, ${endIndex})`;
    return `${initializeCode}\n\n${code}\n\n${cleanupCode}`;
  }

  /**
   * Renders the current webview panel if it exists otherwise a new webview panel
   * will be created and displayed.
   *
   * @param extensionUri The URI of the directory containing the extension.
   */
  public static render(extensionUri: Uri, variable: string | undefined) {
    if (HelloWorldPanel.currentPanel) {
      // If the webview panel already exists reveal it
      HelloWorldPanel.currentPanel._panel.reveal(ViewColumn.One);
    } else {
      const activeNotebookDocument = window.activeNotebookEditor?.notebook;
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        // Panel view type
        "showHelloWorld",
        // Panel title
        "Hello World",
        // The editor column the panel should be displayed in
        ViewColumn.One,
        // Extra panel configurations
        {
          // Enable JavaScript in the webview
          enableScripts: true,
          // Restrict the webview to only load resources from the `out` and `webview-ui/build` directories
          localResourceRoots: [Uri.joinPath(extensionUri, "out"), Uri.joinPath(extensionUri, "webview-ui/build")],
        }
      );

      HelloWorldPanel.currentPanel = new HelloWorldPanel(panel, extensionUri, activeNotebookDocument, variable);
    }
  }

  /**
   * Cleans up and disposes of webview resources when the webview panel is closed.
   */
  public dispose() {
    HelloWorldPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  /**
   * Defines and returns the HTML that should be rendered within the webview panel.
   *
   * @remarks This is also the place where references to the React webview build files
   * are created and inserted into the webview HTML.
   *
   * @param webview A reference to the extension webview
   * @param extensionUri The URI of the directory containing the extension
   * @returns A template string literal containing the HTML that should be
   * rendered within the webview panel
   */
  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, extensionUri, [
      "webview-ui",
      "build",
      "static",
      "css",
      "main.css",
    ]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, extensionUri, [
      "webview-ui",
      "build",
      "static",
      "js",
      "main.js",
    ]);

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
          <meta name="theme-color" content="#000000">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Hello World</title>
        </head>
        <body>
          <noscript>You need to enable JavaScript to run this app.</noscript>
          <div id="root"></div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  /**
   * Sets up an event listener to listen for messages passed from the webview context and
   * executes code based on the message that is recieved.
   *
   * @param webview A reference to the extension webview
   * @param context A reference to the extension context
   */
  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;

        switch (command) {
          case "refresh":
            // Code that should run in response to the hello message command
            // window.showInformationMessage(text);
            this._refresh(webview);
            return;
          case "connected":
            this._refresh(webview);
            return;
        }
      },
      undefined,
      this._disposables
    );
  }

  private _refresh(webview: Webview) {
    webview.postMessage({
      command: "update",
      data: this._values ?? {
        columns: [],
        rows: []
      }
    })
  }
}
