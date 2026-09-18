// Presses persist until a simulation tick consumes them, including at >60Hz rendering.
export class InputBuffer {
  constructor(){this.held=new Set();this.pending=new Set();this.axes={x:0,z:0};}
  press(action){if(!this.held.has(action))this.pending.add(action);this.held.add(action);}
  release(action){this.held.delete(action);}
  consume(cameraYaw=0){
    const result={cameraYaw,moveX:this.axes.x,moveZ:this.axes.z};
    for(const key of this.held)result[key]=true;
    for(const key of this.pending)result[key]=true;
    this.pending.clear();return result;
  }
  clear(){this.held.clear();this.pending.clear();this.axes.x=0;this.axes.z=0;}
}
