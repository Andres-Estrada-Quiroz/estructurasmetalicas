
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// ESTILOS DE BOOTSTRAP
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

// ESTILOS ORIGINALES DEL SISTEMA
import "./index.css";

// AUTENTICACIÓN
import AuthGate from "./AuthGate";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>
);
