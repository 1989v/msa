using UnityEngine;

namespace Kgd.Feel
{
    /// <summary>
    /// 휘두른 자국. **무기가 실제로 지나간 자리**를 리본으로 남긴다.
    ///
    /// 바닥에 부채꼴을 깔면 「어디까지 닿는지」는 보이지만 **무엇으로 치는지**가 안 보인다.
    /// 긴 창과 짧은 검이 같은 자국을 남기면 무기를 바꾼 보람이 없다(실제 신고).
    /// 날의 안쪽·바깥쪽 두 점을 매 프레임 받아 그 사이를 잇는다 — 무기가 길면 자국도 길다.
    ///
    /// 월드 좌표로 만든다. 손에 매달면 휘두르는 동안 자국까지 같이 돌아 뭉개진다.
    /// </summary>
    public sealed class KgdTrail
    {
        /// <summary>남기는 마디 수. 적으면 끊겨 보이고 많으면 늦게까지 남아 지저분하다.</summary>
        public const int Span = 12;

        private readonly Vector3[] _inner = new Vector3[Span];
        private readonly Vector3[] _outer = new Vector3[Span];
        private readonly Vector3[] _verts = new Vector3[Span * 2];
        private readonly Color[] _colors = new Color[Span * 2];
        private readonly int[] _tris = new int[(Span - 1) * 6];
        private int _n;

        public KgdTrail()
        {
            for (int i = 0; i < Span - 1; i++)
            {
                int v = i * 2, t = i * 6;
                _tris[t] = v; _tris[t + 1] = v + 2; _tris[t + 2] = v + 1;
                _tris[t + 3] = v + 1; _tris[t + 4] = v + 2; _tris[t + 5] = v + 3;
            }
        }

        public bool Empty => _n < 2;

        public void Clear() => _n = 0;

        /// <summary>날의 안쪽(손잡이 쪽)과 바깥쪽(끝) 위치. 매 프레임 한 번.</summary>
        public void Add(Vector3 inner, Vector3 outer)
        {
            if (_n == Span)
            {
                for (int i = 1; i < Span; i++) { _inner[i - 1] = _inner[i]; _outer[i - 1] = _outer[i]; }
                _n = Span - 1;
            }
            _inner[_n] = inner; _outer[_n] = outer; _n++;
        }

        /// <summary>지금까지 받은 자리로 리본을 만든다. 오래된 쪽이 옅다.</summary>
        public void Apply(Mesh mesh, Color tint)
        {
            mesh.Clear();
            if (_n < 2) return;

            for (int i = 0; i < _n; i++)
            {
                // **오래된 쪽을 옅게.** 균일한 띠는 자국이 아니라 판때기로 읽힌다
                float k = (float)i / (_n - 1);
                var c = tint; c.a = k * k;
                _verts[i * 2] = _inner[i]; _colors[i * 2] = c;
                _verts[i * 2 + 1] = _outer[i]; _colors[i * 2 + 1] = c;
            }

            var v = new Vector3[_n * 2];
            var col = new Color[_n * 2];
            System.Array.Copy(_verts, v, _n * 2);
            System.Array.Copy(_colors, col, _n * 2);
            var tri = new int[(_n - 1) * 6];
            System.Array.Copy(_tris, tri, tri.Length);

            mesh.vertices = v;
            mesh.colors = col;
            mesh.triangles = tri;
            mesh.RecalculateBounds();
        }
    }
}
