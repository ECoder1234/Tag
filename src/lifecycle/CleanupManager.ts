export type CleanupTask = () => void;

export class CleanupManager {
  private tasks: CleanupTask[] = [];

  register(task: CleanupTask): CleanupTask {
    this.tasks.push(task);
    return task;
  }

  addEventListener<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.register(() => target.removeEventListener(type, listener, options));
  }

  addDocumentListener<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.register(() => target.removeEventListener(type, listener, options));
  }

  setInterval(handler: () => void, timeoutMs: number): number {
    const handle = window.setInterval(handler, timeoutMs);
    this.register(() => window.clearInterval(handle));
    return handle;
  }

  setTimeout(handler: () => void, timeoutMs: number): number {
    const handle = window.setTimeout(handler, timeoutMs);
    this.register(() => window.clearTimeout(handle));
    return handle;
  }

  cleanup(): void {
    for (let index = this.tasks.length - 1; index >= 0; index -= 1) {
      const task = this.tasks[index];
      if (task !== undefined) {
        task();
      }
    }
    this.tasks = [];
  }
}
