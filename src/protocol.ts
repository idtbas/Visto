import type { BrainInfo, ControlMode, Frame, SimOptions, SimState } from './sim/sim';
import type { ModuleName } from './sim/brain/brain';

export type ToWorker =
  | { type: 'start'; options?: SimOptions; state?: SimState; mainThread?: boolean }
  | { type: 'save' }
  | { type: 'pause'; paused: boolean }
  | { type: 'speed'; speed: number }
  | { type: 'mode'; mode: ControlMode }
  | { type: 'manualStim'; values: number[] }
  | { type: 'reset' }
  | { type: 'cookie' }
  | { type: 'placeCookie'; x: number }
  | { type: 'autoReward'; on: boolean }
  | { type: 'wantsToWalk'; on: boolean }
  | { type: 'autonomy'; on: boolean }
  | { type: 'obstacles'; on: boolean }
  | { type: 'pain'; on: boolean }
  | { type: 'push'; impulse: number }
  | { type: 'module'; name: ModuleName; on: boolean }
  | { type: 'debugSomnin'; level: number };

export type FromWorker = { type: 'frame'; frame: Frame } | { type: 'ready'; brain: BrainInfo; restored: boolean } | { type: 'state'; state: SimState }
  | { type: 'attempts'; list: number[] };
