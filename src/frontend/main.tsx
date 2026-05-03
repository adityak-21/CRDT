import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./Home";
import { Room } from "./Room";

const rootElement = document.getElementById("root")!;

ReactDOM.createRoot(rootElement).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<Room />} />
    </Routes>
  </BrowserRouter>
);