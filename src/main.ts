import { Game } from "./core/Game";

const renderBootError = (): void => {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.inset = "0";
  root.style.display = "grid";
  root.style.placeItems = "center";
  root.style.padding = "24px";
  root.style.background = "radial-gradient(circle at 50% 0%, #1b2a46 0%, #05070d 58%)";
  root.style.color = "#eaf2ff";
  root.style.fontFamily = "Courier New, monospace";
  root.style.textAlign = "center";
  root.innerHTML =
    "<div><h1 style=\"margin:0 0 12px;font-size:22px;\">Tag Infinity</h1>" +
    "<p style=\"margin:0 0 14px;font-size:14px;line-height:1.5;\">Startup failed. Please refresh or reopen the page.</p>" +
    "<p style=\"margin:0;font-size:12px;opacity:.8;\">If this continues, check your network and try again.</p></div>";
  document.body.replaceChildren(root);
};

const bootstrap = async (): Promise<void> => {
  const game = await Game.create(document.body);
  window.addEventListener(
    "beforeunload",
    () => {
      game.destroy();
    },
    { once: true }
  );
};

void bootstrap().catch((error: unknown) => {
  console.error("Startup failed:", error);
  renderBootError();
});
