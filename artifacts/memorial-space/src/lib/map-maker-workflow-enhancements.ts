function textOf(el: Element | null) {
  return (el?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function isMapMakerPage() {
  return Boolean(document.querySelector('[data-testid="map-maker-root"]'));
}

function findButtonByText(text: string) {
  const needle = text.toLowerCase();
  return Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => textOf(button).includes(needle));
}

function renameSaveButton() {
  const saveButton = document.querySelector<HTMLButtonElement>('[data-testid="save-map"]');
  if (!saveButton || saveButton.dataset.workflowEnhanced === "true") return;

  saveButton.dataset.workflowEnhanced = "true";
  saveButton.title = "Save private draft. This does not publish or sync to Burial Spots.";
  saveButton.setAttribute("aria-label", "Save draft map");

  for (const node of Array.from(saveButton.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) node.textContent = " Save Draft";
  }

  if (!textOf(saveButton).includes("draft")) {
    const label = document.createTextNode(" Save Draft");
    saveButton.appendChild(label);
  }
}

function openPublishPanelThenPublish() {
  const publishTab = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
    .find((button) => textOf(button) === "publish" || textOf(button).endsWith(" publish"));

  if (publishTab) publishTab.click();

  window.setTimeout(() => {
    const publishButton = findButtonByText("publish map");
    if (publishButton) {
      publishButton.click();
      return;
    }

    window.alert(
      "Open the Workflow panel, select Publish, then click Publish map. Make sure a cemetery is selected first.",
    );
  }, 80);
}

function addPublishButton() {
  const saveButton = document.querySelector<HTMLButtonElement>('[data-testid="save-map"]');
  if (!saveButton || document.querySelector('[data-testid="publish-live-map"]')) return;

  const publishButton = document.createElement("button");
  publishButton.type = "button";
  publishButton.dataset.testid = "publish-live-map";
  publishButton.title = "Publish permanent live map and sync spots to Burial Spots and Map View.";
  publishButton.className = [
    "h-8",
    "inline-flex",
    "items-center",
    "justify-center",
    "gap-1.5",
    "rounded-md",
    "bg-primary",
    "px-3",
    "text-sm",
    "font-medium",
    "text-primary-foreground",
    "shadow-sm",
    "transition-colors",
    "hover:bg-primary/90",
    "focus-visible:outline-none",
    "focus-visible:ring-1",
    "focus-visible:ring-ring",
  ].join(" ");
  publishButton.innerHTML = `<span aria-hidden="true">🚀</span><span>Publish Live Map</span>`;
  publishButton.addEventListener("click", openPublishPanelThenPublish);

  saveButton.insertAdjacentElement("afterend", publishButton);
}

function addWorkflowHint() {
  const root = document.querySelector('[data-testid="map-maker-root"]');
  if (!root || document.querySelector('[data-testid="map-maker-workflow-hint"]')) return;

  const hint = document.createElement("div");
  hint.dataset.testid = "map-maker-workflow-hint";
  hint.className = "fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-md border border-primary/25 bg-background/95 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur";
  hint.innerHTML = `<strong>Workflow:</strong> Save Draft keeps work private. Publish Live Map makes it permanent and syncs Burial Spots + Map View.`;
  root.appendChild(hint);

  window.setTimeout(() => hint.remove(), 7000);
}

function enhanceMapMakerWorkflow() {
  if (!isMapMakerPage()) return;
  renameSaveButton();
  // addPublishButton() removed — Publish Live button is now a React component
  // in the top bar (data-testid="publish-live-map-top"). The DOM-injection
  // approach caused a duplicate button whenever Step 5 was not the active tab.
  addWorkflowHint();
}

export function installMapMakerWorkflowEnhancements() {
  if (typeof window === "undefined") return;
  const win = window as Window & { __memorialspaceMapMakerWorkflowInstalled?: boolean };
  if (win.__memorialspaceMapMakerWorkflowInstalled) return;
  win.__memorialspaceMapMakerWorkflowInstalled = true;

  const observer = new MutationObserver(() => enhanceMapMakerWorkflow());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", enhanceMapMakerWorkflow);
  window.setInterval(enhanceMapMakerWorkflow, 1200);
  enhanceMapMakerWorkflow();
}
