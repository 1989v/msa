// One shared simulation/render timeline; times are seconds, arcs are radians.
export const COMBO_STAGES = Object.freeze([
  {id:'cut', name:'horizontal', duration:.48, impact:.17, damage:16, range:3.2, arc:1.25},
  {id:'rising', name:'backhand', duration:.56, impact:.23, damage:21, range:3.2, arc:1.25},
  {id:'overhead', name:'finisher', duration:.78, impact:.36, damage:38, range:3.9, arc:1.8},
].map(Object.freeze));
