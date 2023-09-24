import { vscode } from "./utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import DataEditor, { DataEditorRef, GridCell, GridCellKind, GridColumn, Item } from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import { useEffect, useRef, useState } from "react";

function App() {
  function handleHowdyClick() {
    vscode.postMessage({
      command: "refresh",
      text: "Hey there partner! 🤠",
    });
  }

  const [data, setData] = useState([
  ]);
  
  
  // Grid columns may also provide icon, overlayIcon, menu, style, and theme overrides
  const [gridColumns, setGridColumns] = useState<GridColumn[]>([
  ]);
  // const columns: GridColumn[] = [
  //   { title: "First Name", width: 100 },
  //   { title: "Last Name", width: 100 }
  // ];

  const [rows, setRows] = useState(data.length);
  const dataEditorRef = useRef<DataEditorRef>(null);

  useEffect(() => {
    // Handle messages sent from the extension to the webview
    window.addEventListener('message', event => {
      const message = event.data; // The json data that the extension sent
      switch (message.command) {
        case 'update':
          const d = message.data;
          console.log(d);
          setGridColumns(d.columns.map((c: string) => {
            return { title: c, width: 100 };
          }))
          setData(d.data);
          setRows(d.data.length);

          const cells: {
            cell: Item;
        }[] = [];
          for (let i = 0; i < d.data.length; i++) {
            for (let j = 0; j < d.columns.length; j++) {
              cells.push({ cell: [j, i] });
            }
          }

          dataEditorRef.current?.updateCells(cells);
          return;
      }
    });

    vscode.postMessage({
      command: "connected"
    });
  }, []);
  
  // If fetching data is slow you can use the DataEditor ref to send updates for cells
  // once data is loaded.
  function getData([col, row]: Item): GridCell {
    const person = data[row];
    const val = person[col];
  
    return {
      kind: GridCellKind.Text,
      data: `${val}`,
      allowOverlay: false,
      displayData: `${val}`
    };
  }

  return (
    <main>
      <h1>Data Grid</h1>
      <VSCodeButton onClick={handleHowdyClick}>Refresh</VSCodeButton>
      <DataEditor columns={gridColumns} getCellContent={getData} rows={rows} ref={dataEditorRef} />
    </main>
  );
}

export default App;
