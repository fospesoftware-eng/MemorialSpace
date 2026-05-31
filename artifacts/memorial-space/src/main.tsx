import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./map-maker-preview.css";
import { installMapMakerPublishSync } from "./lib/map-maker-publish-sync";

installMapMakerPublishSync();

createRoot(document.getElementById("root")!).render(<App />);
