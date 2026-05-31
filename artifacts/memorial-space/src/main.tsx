import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./map-maker-preview.css";
import { installMapMakerPublishSync } from "./lib/map-maker-publish-sync";
import { installMapMakerWorkflowEnhancements } from "./lib/map-maker-workflow-enhancements";

installMapMakerPublishSync();
installMapMakerWorkflowEnhancements();

createRoot(document.getElementById("root")!).render(<App />);
