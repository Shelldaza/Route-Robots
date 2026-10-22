export class LatestRead {
  private controller: AbortController | null = null;

  start() {
    this.cancel();

    const controller = new AbortController();

    this.controller = controller;

    return controller;
  }

  cancel() {
    this.controller?.abort();
    this.controller = null;
  }

  isCurrent(controller: AbortController) {
    return (
      this.controller === controller
      && !controller.signal.aborted
    );
  }
}
