import { commands, ExtensionContext } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";

export function activate(context: ExtensionContext) {
  // Create the show hello world command
  const showHelloWorldCommand = commands.registerCommand("hello-world.showHelloWorld", () => {
    HelloWorldPanel.render(context.extensionUri, undefined);
  });

  context.subscriptions.push(commands.registerCommand('hello-world.showDataGrid', (data: { variable: any; }) => {
    HelloWorldPanel.render(context.extensionUri, data.variable.name);
  }));

  // Add command to the extension context
  context.subscriptions.push(showHelloWorldCommand);
}
