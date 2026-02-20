import { Container } from "pixi.js";
import { Scene } from "./Scene";

export class SceneManager {
  private readonly root: Container;
  private activeScene: Scene | null = null;
  private transitionId = 0;

  constructor(root: Container) {
    this.root = root;
  }

  async setScene(scene: Scene): Promise<void> {
    this.transitionId += 1;
    const transitionId = this.transitionId;
    if (this.activeScene !== null) {
      this.activeScene.onExit();
      this.root.removeChild(this.activeScene);
      this.activeScene.destroy({ children: true });
    }
    this.activeScene = scene;
    this.root.addChild(scene);
    await scene.onEnter();
    if (transitionId !== this.transitionId && this.activeScene === scene) {
      scene.onExit();
      this.root.removeChild(scene);
      scene.destroy({ children: true });
      this.activeScene = null;
    }
  }

  update(deltaMs: number): void {
    this.activeScene?.update(deltaMs);
  }

  destroy(): void {
    this.transitionId += 1;
    if (this.activeScene !== null) {
      this.activeScene.onExit();
      this.root.removeChild(this.activeScene);
      this.activeScene.destroy({ children: true });
      this.activeScene = null;
    }
  }
}
