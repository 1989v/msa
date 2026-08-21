/**
 * d3-force-3d 는 타입 정의를 배포하지 않는다 (ThreeJSGraph 는 @ts-expect-error 로 우회).
 * 도메인 맵이 2D 시뮬레이션으로 쓰는 API 만 최소한으로 선언한다.
 */
declare module 'd3-force-3d' {
  export interface SimNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
  }

  export interface Simulation<N extends SimNodeDatum> {
    tick(iterations?: number): this;
    restart(): this;
    stop(): this;
    nodes(): N[];
    nodes(nodes: N[]): this;
    alpha(): number;
    alpha(alpha: number): this;
    alphaMin(): number;
    alphaMin(min: number): this;
    alphaTarget(): number;
    alphaTarget(target: number): this;
    alphaDecay(decay: number): this;
    velocityDecay(decay: number): this;
    force(name: string): unknown;
    force(name: string, force: unknown | null): this;
  }

  export interface LinkForce<
    N extends SimNodeDatum,
    L extends { source: string | N; target: string | N } = { source: string | N; target: string | N },
  > {
    (alpha: number): void;
    links(links: L[]): this;
    id(fn: (node: N) => string): this;
    distance(fn: number | ((link: L) => number)): this;
    strength(fn: number | ((link: L) => number)): this;
  }

  export interface ManyBodyForce<N extends SimNodeDatum> {
    (alpha: number): void;
    strength(fn: number | ((node: N) => number)): this;
    distanceMax(max: number): this;
  }

  export interface CollideForce<N extends SimNodeDatum> {
    (alpha: number): void;
    radius(fn: number | ((node: N) => number)): this;
    strength(strength: number): this;
  }

  export interface PositionForce<N extends SimNodeDatum> {
    (alpha: number): void;
    strength(fn: number | ((node: N) => number)): this;
    x?(fn: number | ((node: N) => number)): this;
    y?(fn: number | ((node: N) => number)): this;
  }

  export function forceSimulation<N extends SimNodeDatum>(nodes?: N[], numDimensions?: number): Simulation<N>;
  export function forceLink<
    N extends SimNodeDatum,
    L extends { source: string | N; target: string | N } = { source: string | N; target: string | N },
  >(links?: L[]): LinkForce<N, L>;
  export function forceManyBody<N extends SimNodeDatum>(): ManyBodyForce<N>;
  export function forceCollide<N extends SimNodeDatum>(radius?: number | ((node: N) => number)): CollideForce<N>;
  export function forceX<N extends SimNodeDatum>(x?: number | ((node: N) => number)): PositionForce<N>;
  export function forceY<N extends SimNodeDatum>(y?: number | ((node: N) => number)): PositionForce<N>;
  export function forceCenter(x?: number, y?: number): unknown;
}
