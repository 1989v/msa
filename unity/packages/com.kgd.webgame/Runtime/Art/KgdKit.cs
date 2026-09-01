using System.Collections.Generic;
using Kgd.Content;
using UnityEngine;

namespace Kgd.Art
{
    public static class KgdKit
    {

        /// <summary>
        /// 사람 모델이 든 킷의 Resources 경로. 게임이 다른 킷을 쓰면 기동 때 바꾼다 —
        /// 이것만 게임마다 다르고 나머지 로딩 규칙은 같다.
        /// </summary>
        public static string CharacterKit = "Kenney/char/";

        /// <summary>리깅된 사람 모델의 파일명.</summary>
        public static string CharacterModel = "characterMedium";

        private static readonly Dictionary<string, Material> _materials = new();
        private static readonly Dictionary<string, GameObject> _prefabs = new();

        /// <summary>
        /// 받아 둔 챕터 번들. **`kit` 은 번들 이름이거나 Resources 경로 접두 둘 다 된다** —
        /// 번들에 있으면 그것을, 없으면 Resources 를 쓴다. 챕터마다 아트가 갈리는 구조라
        /// 부르는 쪽이 어디서 오는지 몰라도 되게 한다.
        /// </summary>
        public static KgdChapters Bundles;

        private static Shader _shader;
        private static Shader Stylized => _shader ??= Shader.Find("Kgd/Stylized");

        /// <summary>킷 하나의 공용 머티리얼. tintKey 를 주면 같은 아틀라스에 색만 다른 변종을 만든다.</summary>
        public static Material MaterialFor(string kit, Color? tint = null, string tintKey = null)
        {
            string key = kit + (tintKey ?? "");
            if (_materials.TryGetValue(key, out var cached)) return cached;

            var tex = Bundles?.Find<Texture2D>(kit, "colormap") ?? Resources.Load<Texture2D>(kit + "colormap");
            var mat = new Material(Stylized) { name = key };
            if (tex != null) mat.SetTexture("_MainTex", tex);
            mat.SetColor("_Tint", tint ?? Color.white);
            mat.SetFloat("_VColor", 0f);   // 가져온 모델에는 정점 색이 없다 — 켜 두면 값이 정의되지 않는다
            _materials[key] = mat;
            return mat;
        }

        private static GameObject Prefab(string path)
        {
            if (_prefabs.TryGetValue(path, out var cached)) return cached;

            // 번들 먼저 — 챕터 아트는 Resources 에 없다. 이름은 파일명만 쓴다.
            GameObject go = null;
            int slash = path.LastIndexOf('/');
            if (Bundles != null && slash > 0)
                go = Bundles.Find<GameObject>(path.Substring(0, slash), path.Substring(slash + 1));
            if (go == null) go = Resources.Load<GameObject>(path);

            if (go == null) Debug.LogError($"모델을 못 찾았다: {path}");
            _prefabs[path] = go;
            return go;
        }

        /// <summary>
        /// 모델을 하나 놓는다. targetHeight 를 주면 실제 바운드를 재서 그 높이로 맞춘다 —
        /// 킷마다 단위가 달라 배율을 눈으로 맞추면 다음 킷에서 다시 틀린다.
        /// </summary>
        public static GameObject Spawn(string kit, string model, Transform parent,
                                       float targetHeight = 0f, Color? tint = null, string tintKey = null,
                                       bool shadows = true)
        {
            var prefab = Prefab(kit + model);
            if (prefab == null) return new GameObject($"missing_{model}");

            var go = Object.Instantiate(prefab, parent);
            go.name = model;

            var mat = MaterialFor(kit, tint, tintKey);
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                r.sharedMaterial = mat;
                r.shadowCastingMode = shadows
                    ? UnityEngine.Rendering.ShadowCastingMode.On
                    : UnityEngine.Rendering.ShadowCastingMode.Off;
                r.receiveShadows = shadows;
                r.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
                r.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;
            }
            Fit(go, targetHeight);
            return go;
        }

        /// <summary>스킨 텍스처가 따로 있는 모델(리깅 캐릭터)용 머티리얼.</summary>
        public static Material MaterialForSkin(string skin, Color? tint = null, string tintKey = null)
        {
            string key = CharacterKit + skin + (tintKey ?? "");
            if (_materials.TryGetValue(key, out var cached)) return cached;
            var mat = new Material(Stylized) { name = key };
            var tex = Resources.Load<Texture2D>(CharacterKit + skin);
            if (tex != null) mat.SetTexture("_MainTex", tex);
            mat.SetColor("_Tint", tint ?? Color.white);
            mat.SetFloat("_VColor", 0f);
            _materials[key] = mat;
            return mat;
        }

        /// <summary>
        /// 리깅된 사람 모델. 레거시 애니메이션 컴포넌트를 붙여 돌려준다.
        ///
        /// **크기는 모델 자신이 아니라 그 위에 씌운 껍데기에 건다.** 킷의 애니메이션 클립이
        /// 루트의 배율까지 애니메이션하기 때문에, 모델에 직접 배율을 주면 `Play` 한 줄에 지워진다
        /// (2026-08-28: 맞춰 둔 0.54 가 클립의 100 으로 덮여 사람이 105 유닛짜리 덩어리가 됐고,
        /// 카메라가 그 몸통 안에 들어가 화면에서 아무것도 안 보였다).
        /// 껍데기는 클립이 건드리지 않으므로 배율이 그대로 남는다.
        /// </summary>
        public static GameObject SpawnCharacter(string skin, Transform parent, float height,
                                                out Animation anim, Color? tint = null, string tintKey = null,
                                                bool crowd = false)
        {
            anim = null;
            var prefab = Prefab(CharacterKit + CharacterModel);
            if (prefab == null) return new GameObject("missing_character");

            var shell = new GameObject("body");
            shell.transform.SetParent(parent, false);

            var go = Object.Instantiate(prefab, shell.transform);
            go.name = "model";
            var mat = MaterialForSkin(skin, tint, tintKey);
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                r.sharedMaterial = mat;
                if (r is SkinnedMeshRenderer smr)
                {
                    // 스킨드 메시의 월드 바운드는 스킨이 갱신될 때만 다시 계산된다. 굳은 바운드로
                    // 화면 밖 판정을 하면 태어난 자리에서 영영 못 나온다.
                    //
                    // 주인공·동료처럼 몇 개뿐이면 매 프레임 다시 재는 편이 안전하다. 하지만 좀비는
                    // 수백 마리라 그 비용이 프레임을 먹는다 — 그쪽은 넉넉한 바운드를 손으로 박아
                    // 갱신 없이도 컬링이 맞게 돌게 한다.
                    // 일단 켜 둔다. 무리는 아래에서 실제 자세를 잰 뒤 끈다.
                    smr.updateWhenOffscreen = true;
                }
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
                r.receiveShadows = true;
                r.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
                r.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;
            }

            // **애니메이션 컴포넌트는 리그 루트에 단다.**
            // 클립의 커브 경로가 `LeftFootCtrl`, `HipsCtrl/Hips/...` 처럼 리그 루트(`Root`) 기준이라,
            // 모델 최상위에 달면 450개 커브가 하나도 바인딩되지 않고 캐릭터가 바인드 포즈(T자)로 굳는다
            // (2026-08-28: 주인공이 팔 벌린 채 미끄러지던 원인).
            var rig = go.transform.Find("Root") ?? go.transform;

            // 임포트가 모델 최상위에 붙여 준 Animation 은 **끄기만 한다.** Destroy 는 프레임 끝에
            // 처리돼서, 그 사이 GetComponentInChildren 이 빈 컴포넌트를 먼저 집어 클립을 못 찾는다.
            if (rig != go.transform && go.TryGetComponent<Animation>(out var stray))
            {
                stray.playAutomatically = false;
                stray.Stop();
                stray.enabled = false;
            }
            // **`??` 를 쓰지 않는다.** 유니티 Object 의 「없음」은 진짜 null 이 아니라 **가짜 null**
            // 이라, `??` 는 그것을 값으로 보고 그대로 넘긴다 — 다음 줄에서
            // `MissingComponentException` 이 난다. `!=` 만 유니티의 비교를 탄다.
            // 실기에서는 임포트가 리그 루트에 Animation 을 붙여 줘서 드러나지 않았고,
            // 모델이 그것 없이 올라오는 환경(배치모드 검사)에서 처음 터졌다.
            var rigAnim = rig.GetComponent<Animation>();
            anim = rigAnim != null ? rigAnim : rig.gameObject.AddComponent<Animation>();
            anim.playAutomatically = false;
            // 무리는 화면 밖이면 애니메이션을 멈춘다. 바운드를 손으로 박아 뒀으므로
            // "화면 밖이라 멈추고, 멈춰서 영영 화면 밖" 이 되는 교착이 생기지 않는다.
            anim.cullingType = crowd ? AnimationCullingType.BasedOnRenderers : AnimationCullingType.AlwaysAnimate;
            foreach (var name in new[] { "idle", "run", "jump" })
            {
                var clip = LoadClip(name);
                if (clip == null) { Debug.LogWarning($"애니메이션이 없다: {name}"); continue; }
                anim.AddClip(clip, name);
                // **클립마다 걸어야 한다.** `Animation.wrapMode` 는 기본 클립에만 먹고,
                // 상태에 안 걸면 한 번 돌고 굳는다 — 걷기가 두 걸음 만에 멈춘다(실제 신고).
                // 점프는 공중에서 되풀이되면 안 되므로 마지막 자세로 붙든다.
                anim[name].wrapMode = name == "jump" ? WrapMode.ClampForever : WrapMode.Loop;
            }

            // 클립을 한 프레임 먹인 **뒤에** 잰다. 바인드 포즈(T자)는 팔을 벌리고 있어서
            // 그 상태로 재면 폭이 실제보다 넓게 잡힌다
            if (anim.GetClip("idle") != null)
            {
                anim.Play("idle");
                anim.Sample();
            }
            FitShell(shell.transform, height);
            if (crowd) FreezeBounds(go);

            return shell;
        }

        /// <summary>
        /// 동작 클립 하나를 고른다.
        ///
        /// 킷의 애니메이션 FBX 에는 클립이 **둘 이상** 들어 있다 — 실제 동작(`Root|Idle`) 앞에
        /// 바인드 자세(`Root|0.Targeting Pose`)가 있다. 그냥 `Resources.Load` 하면 앞의 것이 잡혀
        /// 캐릭터가 팔 벌린 T 자세로 굳는다 (2026-08-28 실측). 이름으로 골라야 한다.
        /// </summary>
        private static AnimationClip LoadClip(string motion)
        {
            var all = Resources.LoadAll<AnimationClip>(CharacterKit + "anim_" + motion);
            AnimationClip fallback = null;
            foreach (var c in all)
            {
                if (c == null) continue;
                if (c.name.IndexOf("Pose", System.StringComparison.OrdinalIgnoreCase) >= 0) continue;
                if (c.name.IndexOf(motion, System.StringComparison.OrdinalIgnoreCase) >= 0) return c;
                fallback ??= c;
            }
            return fallback;
        }

        /// <summary>
        /// 무리용 — 실제 자세를 한 번 재서 바운드를 굳히고 매 프레임 갱신을 끈다.
        ///
        /// `updateWhenOffscreen` 은 스킨을 매 프레임 다시 계산해 바운드를 뽑는다. 몇 마리면 싸지만
        /// 수백 마리면 그것만으로 CPU 가 쉬지 못하고, WebGL 은 그 계산이 한 스레드에 몰린다
        /// (2026-08-28 모바일 발열 원인 중 하나).
        ///
        /// 그렇다고 값을 눈대중으로 박으면 안 된다 — 바인드 포즈 바운드는 원점 근처에 뭉쳐 있어서
        /// (실측 0.04 유닛) 부풀려도 몸을 감싸지 못하고, 그러면 개체가 통째로 안 그려진다.
        /// **지금 자세를 재서** 로컬 공간 값으로 되돌려 넣는 것만이 맞다.
        /// </summary>
        private static void FreezeBounds(GameObject go)
        {
            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                if (r is not SkinnedMeshRenderer smr) continue;

                var world = smr.bounds;
                var scale = smr.transform.lossyScale;
                if (world.size.y < 0.01f || Mathf.Abs(scale.x) < 1e-5f
                    || Mathf.Abs(scale.y) < 1e-5f || Mathf.Abs(scale.z) < 1e-5f)
                    continue;   // 못 재면 켜 둔 채로 둔다 — 안 보이는 것보다 비싼 편이 낫다

                var center = smr.transform.InverseTransformPoint(world.center);
                var size = new Vector3(world.size.x / Mathf.Abs(scale.x),
                                       world.size.y / Mathf.Abs(scale.y),
                                       world.size.z / Mathf.Abs(scale.z));
                // 걷기·공격에서 팔다리가 더 뻗으므로 넉넉히 잡는다
                smr.localBounds = new Bounds(center, size * 2.2f);
                smr.updateWhenOffscreen = false;
            }
        }

        /// <summary>
        /// 껍데기 배율로 목표 높이를 맞춘다. 실제로 그려지는 월드 바운드를 한 번만 재고 한 번만
        /// 곱한다 — 스킨드 메시의 바운드는 갱신이 한 박자 늦어서, 다시 재고 또 곱하면 같은 배율을
        /// 두 번 먹여 모델이 사라진다.
        /// </summary>
        private static void FitShell(Transform shell, float targetHeight)
        {
            if (targetHeight <= 0f) return;

            float h = WorldHeight(shell);
            if (h < 0.0001f)
            {
                Debug.LogError($"크기를 잴 수 없다: {shell.name}");
                return;
            }
            shell.localScale *= Mathf.Clamp(targetHeight / h, 0.0005f, 400f);

            float after = WorldHeight(shell);
            if (after > targetHeight * 2.5f || after < targetHeight * 0.4f)
                Debug.LogError($"크기 보정이 듣지 않았다: {shell.name} {after:F2} (목표 {targetHeight:F2})");
        }

        private static float WorldHeight(Transform root)
        {
            var renderers = root.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return 0f;
            var box = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++) box.Encapsulate(renderers[i].bounds);
            return box.size.y;
        }

        /// <summary>
        /// 목표 높이(m)에 맞춘다. 렌더러의 실제 바운드로 재고 **한 번 더 확인**한다 —
        /// 한 번만 재면 측정에 실패한 모델이 원본 배율 그대로 남아 수십 미터짜리 덩어리가 되고,
        /// 그게 화면 절반을 덮어도 원인이 안 보인다(실측: 창백한 거대 형체의 정체가 이것이었다).
        /// </summary>
        private static void Fit(GameObject go, float targetHeight)
        {
            if (targetHeight <= 0f) return;

            // 배율이 걸리지 않은 **메시 자체의 높이**를 잰다. Renderer.bounds 는 월드 값이라
            // 스킨드 메시에서는 방금 바꾼 배율이 아직 반영되지 않은 채 돌아오고, 그걸 믿고
            // 한 번 더 재면 같은 배율을 두 번 곱해 모델이 사라진다 (k=0.12 이면 0.014 배).
            float height = LocalHeight(go);
            if (height < 0.0001f)
            {
                Debug.LogError($"크기를 잴 수 없다: {go.name}");
                return;
            }
            go.transform.localScale = Vector3.one * Mathf.Clamp(targetHeight / height, 0.0005f, 400f);
        }

        /// <summary>모델 원본 높이 — 자기 계층 안의 배율만 반영하고 부모 배율은 빼고 잰다.</summary>
        private static float LocalHeight(GameObject go)
        {
            var root = go.transform;
            bool any = false;
            float lo = 0f, hi = 0f;

            foreach (var r in go.GetComponentsInChildren<Renderer>())
            {
                Mesh mesh = r switch
                {
                    SkinnedMeshRenderer smr => smr.sharedMesh,
                    MeshRenderer when r.TryGetComponent<MeshFilter>(out var mf) => mf.sharedMesh,
                    _ => null,
                };
                if (mesh == null) continue;

                // 메시 로컬 → 모델 루트 로컬. 본 자세는 무시하고 바인드 포즈 크기로 잰다
                var m = root.worldToLocalMatrix * r.transform.localToWorldMatrix;
                var b = mesh.bounds;
                for (int c = 0; c < 8; c++)
                {
                    var corner = b.center + Vector3.Scale(b.extents, new Vector3(
                        (c & 1) == 0 ? -1f : 1f, (c & 2) == 0 ? -1f : 1f, (c & 4) == 0 ? -1f : 1f));
                    float y = m.MultiplyPoint3x4(corner).y;
                    if (!any) { lo = hi = y; any = true; }
                    else { if (y < lo) lo = y; if (y > hi) hi = y; }
                }
            }
            return any ? hi - lo : 0f;
        }

        /// <summary>이름 조각으로 본을 찾는다 — 킷마다 본 이름이 달라 하드코딩하면 다음 킷에서 깨진다.</summary>
        public static Transform FindBone(Transform root, params string[] fragments)
        {
            var all = root.GetComponentsInChildren<Transform>();
            foreach (var frag in fragments)
            {
                foreach (var t in all)
                {
                    if (t.name.IndexOf(frag, System.StringComparison.OrdinalIgnoreCase) >= 0) return t;
                }
            }
            return null;
        }

        /// <summary>모델의 원래 크기(월드 단위). 배치 간격을 정할 때 쓴다.</summary>
        public static Vector3 SizeOf(string kit, string model)
        {
            var prefab = Prefab(kit + model);
            if (prefab == null) return Vector3.one;
            bool any = false;
            var box = new Bounds();
            foreach (var f in prefab.GetComponentsInChildren<MeshFilter>())
            {
                if (f.sharedMesh == null) continue;
                if (!any) { box = f.sharedMesh.bounds; any = true; }
                else box.Encapsulate(f.sharedMesh.bounds);
            }
            return any ? box.size : Vector3.one;
        }
    }
}
