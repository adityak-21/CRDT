import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Find the <div id="root"> from index.html
const rootElement = document.getElementById("root")!;

// Create React root and render our App
ReactDOM.createRoot(rootElement).render(<App />);