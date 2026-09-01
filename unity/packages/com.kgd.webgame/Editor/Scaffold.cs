using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Kgd.Editor
{
    /// <summary>
    /// 새 게임의 씬 골격을 배치 모드로 만든다.
    ///
    /// 씬은 Main.unity 하나이고 그 안에는 Bootstrap 오브젝트 하나뿐이다 — 카메라·조명·프리팹까지
    /// 전부 게임 코드가 런타임에 만든다. 에디터 GUI 로 놓아 둔 상태가 없어야 파일만 보고
    /// 무엇이 왜 그렇게 되어 있는지 읽히고, 배치 빌드로 그대로 재현된다.
    /// </summary>
    public static class Scaffold
    {
        /// <summary>
        /// **도는 시작 게임을 뽑는다.** 씬 골격만 만들어 두면 다음 사람이 「무엇부터
        /// 붙이나」에서 막힌다 — 걷고·오르고·활공하고·적이 쫓아오는 것이 처음부터 돌면
        /// 거기서 규칙만 바꾸면 된다.
        ///
        /// 이 파일이 **패키지의 두 번째 사용자**이기도 하다. 아홉 종 하나만 쓰는 동안은
        /// 「쓸 수 있다」가 주장이지만, 여기서 컴파일되면 그건 확인이다.
        /// </summary>
        public static void CreateStarter()
        {
            const string dir = "Assets/Scripts";
            Directory.CreateDirectory(dir);
            string path = $"{dir}/StarterEntry.cs";
            if (File.Exists(path))
            {
                Debug.LogWarning($"[Kgd] 이미 있다: {path} — 덮지 않는다");
                return;
            }
            File.WriteAllText(path, Starter);
            AssetDatabase.Refresh();
            Debug.Log($"[Kgd] {path} 생성 — 씬의 Bootstrap 에 StarterEntry 를 붙이면 바로 돈다");
        }

        /// <summary>
        /// 평지 하나 · 기둥 몇 개 · 쫓아오는 것 하나. **패키지만으로 도는 최소 게임**이다.
        /// 지형을 진짜로 만들려면 <see cref="Kgd.Terrain.KgdPlateauBuilder"/> 를 쓴다.
        /// </summary>
        private const string Starter = @"using Kgd;
using Kgd.Art;
using Kgd.Motion;
using Kgd.Play;
using UnityEngine;

/// <summary>패키지만으로 도는 최소 게임. 여기서 규칙만 바꾸면 새 게임이 된다.</summary>
public sealed class StarterEntry : MonoBehaviour
{
    /// <summary>세상은 「이 자리 바닥이 얼마나 높은가」만 답하면 된다.</summary>
    private sealed class Flat : IKgdGround, IKgdWall
    {
        public readonly KgdObstacles Things = new(8f);
        public float HeightAt(Vector3 p) => Mathf.Max(0f, Things.TopAt(p));
        public bool WallAt(Vector3 at, float reach, out float top, out Vector3 inward)
            => Things.WallAt(at, reach, out top, out inward);
    }

    private readonly Flat _world = new();
    private KgdTraverse _hero;
    private KgdChase _foe;
    private KgdOrbitCam _cam;
    private Transform _heroBody, _foeBody;

    private void Start()
    {
        Application.targetFrameRate = 60;
        KgdInput.BindPadActions(""KeyC"", ""KeyX"", ""KeyZ"", ""KeyA"", ""KeyS"");

        var camGo = new GameObject(""camera"", typeof(Camera));
        var cam = camGo.GetComponent<Camera>();
        cam.clearFlags = CameraClearFlags.SolidColor;
        cam.backgroundColor = new Color(0.45f, 0.60f, 0.74f);

        var sun = new GameObject(""sun"", typeof(Light)).GetComponent<Light>();
        sun.type = LightType.Directional;
        sun.transform.rotation = Quaternion.Euler(48f, 225f, 0f);
        RenderSettings.ambientLight = new Color(0.45f, 0.48f, 0.55f);

        var root = new GameObject(""world"").transform;

        // 바닥
        var floor = new KgdMesh().Quad(Vector3.zero, 200f, 200f, new Color(0.31f, 0.44f, 0.24f));
        KgdMat.Object(""floor"", floor.Build(""floor""), root, shadows: false);

        // 기둥 — 막히기도 하고 올라설 수도 있고 붙어 오를 수도 있다
        var mb = new KgdMesh();
        for (int i = 0; i < 8; i++)
        {
            float a = i / 8f * Mathf.PI * 2f;
            var at = new Vector3(Mathf.Cos(a) * 26f, 0f, Mathf.Sin(a) * 26f);
            float h = 4f + i * 1.6f;
            mb.Box(at + Vector3.up * h * 0.5f, new Vector3(7f, h, 7f), new Color(0.35f, 0.37f, 0.41f));
            _world.Things.Add(at, 3.5f, h);
        }
        KgdMat.Object(""pillars"", mb.Build(""pillars""), root);

        _hero = new KgdTraverse(KgdTraverse.Tuning.Default, 100f) { MapRadius = 96f };
        _heroBody = Kenney.Body(root, new Color(0.85f, 0.87f, 0.90f));
        _foe = new KgdChase(KgdChase.Tuning.Default, new Vector3(0f, 0f, 34f));
        _foeBody = Kenney.Body(root, new Color(0.55f, 0.30f, 0.36f));
        _cam = new KgdOrbitCam(cam, _world, _hero.Pos);
    }

    private void Update()
    {
        float dt = Mathf.Min(Time.deltaTime, 0.05f);

        var m = KgdInput.Move;
        var move = Quaternion.Euler(0f, _cam.Yaw, 0f) * new Vector3(m.x, 0f, m.y);
        _hero.Tick(dt, new KgdTraverse.Wish
        {
            Move = move.sqrMagnitude > 1f ? move.normalized : move,
            Run = KgdInput.Action(5),
            JumpDown = KgdInput.ActionDown(1),
            RollDown = KgdInput.ActionDown(2),
            GlideDown = KgdInput.ActionDown(4),
            LetGoDown = KgdInput.ActionDown(1),
        }, _world, _world);

        _foe.Tick(dt, _hero.Pos, _world, _hero.Body, _world);

        _heroBody.SetPositionAndRotation(_hero.Pos, Quaternion.Euler(0f, _hero.Yaw, 0f));
        _foeBody.SetPositionAndRotation(_foe.Pos, Quaternion.Euler(0f, _foe.Yaw, 0f));
        _cam.Tick(dt, _hero.Pos, 1.35f, _hero.Now == KgdTraverse.State.Climb);
    }

    /// <summary>모델이 없어도 돌게 상자 하나로 세운다. 진짜 모델은 KgdKit 이 놓는다.</summary>
    private static class Kenney
    {
        public static Transform Body(Transform parent, Color tint)
        {
            var mb = new KgdMesh();
            mb.Box(new Vector3(0f, 0.9f, 0f), new Vector3(0.7f, 1.8f, 0.5f), tint);
            mb.Box(new Vector3(0f, 1.95f, 0f), new Vector3(0.55f, 0.5f, 0.55f), tint * 1.15f);
            return KgdMat.Object(""body"", mb.Build(""body""), parent).transform;
        }
    }
}
";

        public static void CreateMainScene()
        {
            const string path = "Assets/Scenes/Main.unity";
            Directory.CreateDirectory("Assets/Scenes");

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var go = new GameObject("Bootstrap");

            var entry = Type.GetType("GameEntry, Assembly-CSharp");
            if (entry != null) go.AddComponent(entry);
            else Debug.LogWarning("[Kgd] GameEntry 를 못 찾았다 — 스크립트를 넣은 뒤 다시 실행하라");

            EditorSceneManager.SaveScene(scene, path);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(path, true) };
            AssetDatabase.SaveAssets();
            Debug.Log($"[Kgd] {path} 생성 · Build Settings 등록 완료");
        }
    }
}
