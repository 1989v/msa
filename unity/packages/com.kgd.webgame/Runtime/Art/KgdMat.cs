using UnityEngine;

namespace Kgd.Art
{
    /// <summary>
    /// 공용 머티리얼과 렌더러 하나짜리 오브젝트.
    ///
    /// **불투명 오브젝트는 머티리얼 한 장을 공유하고 색은 정점에 담는다.** 오브젝트마다
    /// 머티리얼을 만들면 드로우콜이 개체 수를 따라가고, WebGL 단일 스레드에서 그건 곧 프레임이다.
    ///
    /// 셰이더는 `Resources` 에 둔다 — `Shader.Find` 로만 찾는 셰이더는 아무도 참조하지 않아
    /// 빌드에서 통째로 스트리핑되고, 그 결과가 마젠타 화면이다.
    /// </summary>
    public static class KgdMat
    {
        private static Material _solid;
        private static Material _fx;

        public static Material Solid => _solid ??= Make("Kgd/Stylized", "Solid");

        private static Material _terrain;

        /// <summary>지형용 — 양면으로 그린다. 계단 위에서 아래 절벽을 볼 때 뒷면이 잘리면 뚫려 보인다.</summary>
        public static Material Terrain
        {
            get
            {
                if (_terrain == null)
                {
                    _terrain = Make("Kgd/Stylized", "Terrain");
                    _terrain.SetFloat("_Cull", 0f);
                }
                return _terrain;
            }
        }
        public static Material Fx => _fx ??= Make("Kgd/Fx", "Fx");

        private static Material Make(string shaderName, string label)
        {
            var shader = Shader.Find(shaderName);
            if (shader == null)
            {
                // Resources 에 들어 있는데도 못 찾으면 스트리핑 설정이 바뀐 것이다 — 조용히 마젠타가
                // 되는 대신 로그로 드러낸다.
                Debug.LogError($"셰이더를 못 찾았다: {shaderName}");
                shader = Shader.Find("Hidden/InternalErrorShader");
            }
            return new Material(shader) { name = label, enableInstancing = false };
        }

        /// <summary>렌더러 하나짜리 오브젝트. 물리는 쓰지 않으므로 콜라이더를 붙이지 않는다.</summary>
        public static GameObject Object(string name, Mesh mesh, Transform parent = null, bool fx = false,
                                        bool shadows = true, bool terrain = false)
        {
            var go = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer));
            if (parent != null) go.transform.SetParent(parent, false);
            go.GetComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = fx ? Fx : terrain ? Terrain : Solid;
            r.shadowCastingMode = shadows
                ? UnityEngine.Rendering.ShadowCastingMode.On
                : UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = shadows;
            r.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
            r.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;
            return go;
        }
    }
}
