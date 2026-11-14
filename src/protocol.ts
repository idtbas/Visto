import type { BrainInfo, ControlMode, Frame } from './sim/sim';

export type ToWorker =
  | { type: 'start' }
  | { type: 'pause'; paused: boolean }
  | { type: 'speed'; speed: number }
  | { type: 'mode'; mode: ControlMode }
  | { type: 'manualStim'; values: number[] }
  | { type: 'reset' };

export type FromWorker = { type: 'frame'; frame: Frame } | { type: 'ready'; brain: BrainInfo };
