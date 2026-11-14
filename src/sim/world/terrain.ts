// The ground and everything standing on it.
import { World, Vec2, Chain, Box } from 'planck';
import type { Body } from 'planck';

export interface Obstacle {
  kind: 'block';
  x: number;
  w: number;
  h: number;
}

export class Terrain {
  readonly ground: Body;
  readonly obstacles: Obstacle[] = [];
  private readonly obstacleBodies: Body[] = [];

  constructor(readonly world: World) {
    this.ground = world.createBody({ type: 'static', position: new Vec2(0, 0) });
    this.ground.createFixture({
      shape: new Chain([new Vec2(-2000, 0), new Vec2(2000, 0)], false),
      friction: 1.0,
    });
  }

  addBlock(x: number, w: number, h: number): void {
    const b = this.world.createBody({ type: 'static', position: new Vec2(x + w / 2, h / 2) });
    b.createFixture({ shape: new Box(w / 2, h / 2), friction: 1.0 });
    this.obstacleBodies.push(b);
    this.obstacles.push({ kind: 'block', x, w, h });
  }

  clearObstacles(): void {
    for (const b of this.obstacleBodies) this.world.destroyBody(b);
    this.obstacleBodies.length = 0;
    this.obstacles.length = 0;
  }

  /** ground height at x (top of the highest obstacle covering x) */
  heightAt(x: number): number {
    let h = 0;
    for (const o of this.obstacles) if (x >= o.x && x <= o.x + o.w && o.h > h) h = o.h;
    return h;
  }
}
