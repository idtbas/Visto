import type { BrainInfo, ControlMode, Frame } from './sim/sim';

export type ToWorker =
  | { type: 'start' }
  | { type: 'pause'; paused: boolean }
  | { type: 'speed'; speed: number }
  | { type: 'mode'; mode: ControlMode }
  | { type: 'manualStim'; values: number[] }
  | { type: 'reset' }
  | { type: 'cookie' }
  | { type: 'placeCookie'; x: number }
  | { type: 'autoReward'; on: boolean };

export type FromWorker = { type: 'frame'; frame: Frame } | { type: 'ready'; brain: BrainInfo };
