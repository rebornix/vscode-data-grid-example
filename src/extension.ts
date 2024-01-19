import { commands, ExtensionContext, Uri } from "vscode";
import { HelloWorldPanel } from "./panels/panel";

export function activate(context: ExtensionContext) {
  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand("hello-world.showHelloWorld", () => {
    HelloWorldPanel.render(context.extensionUri, undefined);
  });

  context.subscriptions.push(commands.registerCommand('hello-world.showDataGrid', (variable: {
    name: string;
    type: string;
    fileName?: Uri
  }) => {
    HelloWorldPanel.render(context.extensionUri, variable.name);
  }));

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand);
}
