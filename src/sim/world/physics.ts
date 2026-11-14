// Physics world: gravity, ground, the body.
import { World, Vec2 } from 'planck';
import { Biped } from '../body/biped';
import { Terrain } from './terrain';

export const DT = 0.001; // one tick = 1 ms, shared by body and brain

export class Physics {
  readonly world: World;
  readonly terrain: Terrain;
  readonly biped: Biped;
  time = 0;

  constructor() {
    this.world = new World({ gravity: new Vec2(0, -9.81), allowSleep: false });
    this.terrain = new Terrain(this.world);
    this.biped = new Biped(this.world);
  }

  step(): void {
    this.biped.preStep(DT);
    this.world.step(DT, 8, 3);
    this.biped.postStep(DT);
    this.time += DT;
  }
}
