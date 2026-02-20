import { Container } from "pixi.js";
import { CleanupManager } from "../lifecycle/CleanupManager";

export abstract class Scene extends Container {
  protected readonly cleanupManager: CleanupManager;

  protected constructor() {
    super();
    this.cleanupManager = new CleanupManager();
  }

  abstract onEnter(): Promise<void> | void;

  abstract update(deltaMs: number): void;

  onExit(): void {
    this.cleanupManager.cleanup();
    this.removeChildren();
  }
}