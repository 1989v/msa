/** d3-force-3d 는 타입 선언을 싣지 않는다 — 아틀라스 그래프 판이 쓰는 2차원 부분만 적는다 */
declare module 'd3-force-3d' {
  export interface SimNode {
    id: string;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }
  export interface SimLink<N extends SimNode> {
    source: string | N;
    target: string | N;
  }
  export interface Force {
    (alpha: number): void;
  }
  export interface Simulation<N extends SimNode> {
    force(name: string, force: Force | null): this;
    on(type: 'tick' | 'end', listener: (() => void) | null): this;
    alpha(value: number): this;
    alphaTarget(value: number): this;
    restart(): this;
    stop(): this;
    tick(iterations?: number): this;
    nodes(): N[];
  }
  export interface LinkForce<N extends SimNode, L extends SimLink<N>> extends Force {
    id(fn: (n: N) => string): this;
    distance(d: number | ((l: L) => number)): this;
    strength(s: number | ((l: L) => number)): this;
  }
  export interface ManyBodyForce<N extends SimNode> extends Force {
    strength(s: number | ((n: N) => number)): this;
  }
  export interface CollideForce<N extends SimNode> extends Force {
    radius(r: number | ((n: N) => number)): this;
  }
  export interface PositionForce extends Force {
    strength(s: number): this;
  }
  export function forceSimulation<N extends SimNode>(nodes: N[], numDimensions?: number): Simulation<N>;
  export function forceLink<N extends SimNode, L extends SimLink<N>>(links: L[]): LinkForce<N, L>;
  export function forceManyBody<N extends SimNode>(): ManyBodyForce<N>;
  export function forceCollide<N extends SimNode>(): CollideForce<N>;
  export function forceX(x?: number): PositionForce;
  export function forceY(y?: number): PositionForce;
}
