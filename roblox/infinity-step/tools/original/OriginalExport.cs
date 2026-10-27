using System;
using System.IO;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
public static class OriginalExport {
 [Serializable] public class Slab { public int id, biome, mover; public Vector3 at, slope; public float halfX,halfZ,depth,grade; public string kind; public bool onPath,dead; }
 [Serializable] public class Move { public Vector3 a,b; public float period,phase; }
 [Serializable] public class Link { public int from,to; public bool valid; public Vector3 launch,dir; public float vx,vy,g,air; }
 [Serializable] public class Sample {public float y; public Look look; public Vector3 wind;}
 [Serializable] public class Export { public int seed=20261028; public string difficulty="Normal",unity; public float generatedTop,summit=3000,scale=4; public Vector3 start; public List<Slab> slabs=new(); public List<Move> movers=new();public List<int> path; public List<Link> links=new();public List<Sample> environment=new(); public Color[] body=Pal.Body,trim=Pal.Trim; public Color asphalt=Pal.Asphalt; }
 public static void Run() {
  Tower.Hardness=Tower.Level.Normal;
  var e=new Export();e.unity=Application.unityVersion;
  var t=new Tower(e.seed,3220); e.generatedTop=t.GeneratedTop;e.start=t.StartPos;e.path=t.Path;
  for(int i=0;i<t.Slabs.Count;i++){var s=t.Slabs[i];e.slabs.Add(new Slab{id=i,at=s.At,halfX=s.HalfX,halfZ=s.HalfZ,depth=s.Depth,kind=s.Kind.ToString(),biome=s.Biome,mover=s.Mover,onPath=s.OnPath,dead=s.Dead,grade=s.Grade,slope=s.Slope});}
  foreach(var m in t.Movers)e.movers.Add(new Move{a=m.A,b=m.B,period=m.Period,phase=m.Phase});
  var arc=typeof(Tower).GetMethod("LinkArc",BindingFlags.NonPublic|BindingFlags.Instance);
  for(int i=1;i<t.Path.Count;i++){int a=t.Path[i-1],b=t.Path[i];object[] args={t.Slabs[a],t.Slabs[b],Vector3.zero,Vector3.zero,0f,0f,0f,0f};bool valid=(bool)arc.Invoke(t,args);e.links.Add(new Link{from=a,to=b,valid=valid,launch=(Vector3)args[2],dir=(Vector3)args[3],vx=(float)args[4],vy=(float)args[5],g=(float)args[6],air=(float)args[7]});}
  for(int y=0;y<=3225;y+=5)e.environment.Add(new Sample{y=y,look=Biome.At(y),wind=Biome.WindAt(y,e.seed)});
  File.WriteAllText(Environment.GetEnvironmentVariable("ORIGINAL_EXPORT"),JsonUtility.ToJson(e,true));
  Debug.Log($"ORIGINAL_EXPORT slabs={e.slabs.Count} path={e.path.Count} top={e.generatedTop}");
 }
}
