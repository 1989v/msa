// A leg changes only after grounded arrival, so an airborne explorer keeps a stable goal.
export function createRouteGuide(nodes) {
  let selected=null,index=0;
  return { reset(){selected=null;}, target(destination,position,grounded) {
    const end=nodes.findIndex(node=>node.id===destination);
    if(end<0){selected=null;return null;}
    if(selected!==destination){
      selected=destination;
      index=nodes.reduce((best,node,i)=>Math.hypot(node.position.x-position.x,node.position.z-position.z)<Math.hypot(nodes[best].position.x-position.x,nodes[best].position.z-position.z)?i:best,0);
    }
    const node=nodes[index];
    if(index!==end&&grounded&&Math.hypot(node.position.x-position.x,node.position.z-position.z)<2&&Math.abs(node.position.y-position.y)<1)index+=Math.sign(end-index);
    return nodes[index];
  }};
}
