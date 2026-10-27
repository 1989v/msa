// Host-only minimal adapter. NOT UnityEngine: .NET MathF and Vector3 float operations.
using System;
namespace UnityEngine {
 public static class Application {public static string unityVersion=>"source-host-dotnet8 (NOT Unity engine)";}
 public struct Vector2 {public float x,y;public Vector2(float x,float y){this.x=x;this.y=y;}public float magnitude=>MathF.Sqrt(x*x+y*y);}
 public struct Vector3 {
  public float x,y,z; public Vector3(float x,float y,float z){this.x=x;this.y=y;this.z=z;}
  public static Vector3 zero=>new(0,0,0);public static Vector3 one=>new(1,1,1);public static Vector3 up=>new(0,1,0);public static Vector3 forward=>new(0,0,1);
  [System.Text.Json.Serialization.JsonIgnore] public float sqrMagnitude=>x*x+y*y+z*z;
  [System.Text.Json.Serialization.JsonIgnore] public float magnitude=>MathF.Sqrt(sqrMagnitude);
  [System.Text.Json.Serialization.JsonIgnore] public Vector3 normalized=>magnitude>1e-5f?this/magnitude:zero;
  public static Vector3 operator +(Vector3 a,Vector3 b)=>new(a.x+b.x,a.y+b.y,a.z+b.z);
  public static Vector3 operator -(Vector3 a,Vector3 b)=>new(a.x-b.x,a.y-b.y,a.z-b.z);
  public static Vector3 operator -(Vector3 a)=>zero-a;
  public static Vector3 operator *(Vector3 a,float b)=>new(a.x*b,a.y*b,a.z*b);
  public static Vector3 operator *(float b,Vector3 a)=>a*b;
  public static Vector3 operator /(Vector3 a,float b)=>a*(1f/b);
  public static float Dot(Vector3 a,Vector3 b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  public static Vector3 Cross(Vector3 a,Vector3 b)=>new(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
  public static Vector3 Lerp(Vector3 a,Vector3 b,float t)=>a+(b-a)*Mathf.Clamp01(t);
  public static Vector3 Min(Vector3 a,Vector3 b)=>new(MathF.Min(a.x,b.x),MathF.Min(a.y,b.y),MathF.Min(a.z,b.z));
  public static Vector3 Max(Vector3 a,Vector3 b)=>new(MathF.Max(a.x,b.x),MathF.Max(a.y,b.y),MathF.Max(a.z,b.z));
 }
 public struct Color {public float r,g,b,a;public Color(float r,float g,float b,float a=1){this.r=r;this.g=g;this.b=b;this.a=a;}public static Color Lerp(Color a,Color b,float t)=>new(Mathf.Lerp(a.r,b.r,t),Mathf.Lerp(a.g,b.g,t),Mathf.Lerp(a.b,b.b,t),Mathf.Lerp(a.a,b.a,t));}
 public static class Mathf {
  public const float PI=(float)Math.PI,Deg2Rad=PI/180,Rad2Deg=180/PI;
  public static float Abs(float v)=>MathF.Abs(v);public static float Sqrt(float v)=>MathF.Sqrt(v);public static float Pow(float a,float b)=>MathF.Pow(a,b);
  public static float Sin(float v)=>MathF.Sin(v);public static float Cos(float v)=>MathF.Cos(v);public static float Atan2(float a,float b)=>MathF.Atan2(a,b);
  public static float Min(float a,float b)=>MathF.Min(a,b);public static float Max(float a,float b)=>MathF.Max(a,b);
  public static int Min(int a,int b)=>Math.Min(a,b);public static int Max(int a,int b)=>Math.Max(a,b);
  public static float Clamp(float v,float a,float b)=>Math.Clamp(v,a,b);public static int Clamp(int v,int a,int b)=>Math.Clamp(v,a,b);
  public static float Clamp01(float v)=>Clamp(v,0,1);public static float Lerp(float a,float b,float t)=>a+(b-a)*Clamp01(t);
  public static float InverseLerp(float a,float b,float v)=>a!=b?Clamp01((v-a)/(b-a)):0;
  public static float Repeat(float v,float length)=>Clamp(v-MathF.Floor(v/length)*length,0,length);
  public static float LerpAngle(float a,float b,float t){float delta=Repeat(b-a,360);if(delta>180)delta-=360;return a+delta*Clamp01(t);}
  public static float SmoothStep(float a,float b,float t){t=Clamp01(t);return a+(b-a)*t*t*(3-2*t);}
  public static int FloorToInt(float v)=>(int)MathF.Floor(v);public static int RoundToInt(float v)=>(int)MathF.Round(v);public static float Ceil(float v)=>MathF.Ceiling(v);
 }
 public static class Debug {public static void Log(object v)=>Console.Error.WriteLine(v);public static void LogWarning(object v)=>Log(v);public static void LogError(object v)=>Log(v);}
 public static class JsonUtility {public static string ToJson(object value,bool pretty)=>System.Text.Json.JsonSerializer.Serialize(value,new System.Text.Json.JsonSerializerOptions{WriteIndented=pretty,IncludeFields=true});}
}
namespace Kgd.Motion {public interface IKgdGround{}public interface IKgdWall{}public interface IKgdCeiling{}public interface IKgdLedge{}}
namespace Kgd.Art {}
public static class Climber {public const float Height=1.8f,Radius=0.42f;}
public class Program {public static void Main()=>OriginalExport.Run();}
