import type { BrainInfo, ControlMode, Frame, SimOptions, SimState } from './sim/sim';

export type ToWorker =
  | { type: 'start'; options?: SimOptions; state?: SimState }
  | { type: 'save' }
  | { type: 'pause'; paused: boolean }
  | { type: 'speed'; speed: number }
  | { type: 'mode'; mode: ControlMode }
  | { type: 'manualStim'; values: number[] }
  | { type: 'reset' }
  | { type: 'cookie' }
  | { type: 'placeCookie'; x: number }
  | { type: 'autoReward'; on: boolean }
  | { type: 'wantsToWalk'; on: boolean };

export type FromWorker = { type: 'frame'; frame: Frame } | { type: 'ready'; brain: BrainInfo; restored: boolean } | { type: 'state'; state: SimState }
  | { type: 'attempts'; list: number[] };
