import { Game } from "./core/Game";

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

void bootstrap().catch(() => {
  // Prevent unhandled rejection on startup failure.
});
