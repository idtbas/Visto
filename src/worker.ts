// The simulation lives in this worker so the page stays smooth while the brain computes.
import { createHost } from './simHost';
import type { ToWorker } from './protocol';

const handle = createHost((m) => (self as unknown as Worker).postMessage(m));
self.onmessage = (e: MessageEvent<ToWorker>): void => handle(e.data);
