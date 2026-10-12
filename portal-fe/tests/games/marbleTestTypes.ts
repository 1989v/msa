/** Runtime records exported by the shipped JavaScript simulation. Tests never implement physics. */
export interface TestMarble {
  id: number;
  owner: number;
  name: string;
  held: boolean;
  done: boolean;
  rank: number;
  x: number;
  y: number;
}
