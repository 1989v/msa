using UnityEngine;

namespace Kgd.Field
{
    /// <summary>
    /// 밀도 세계에서 겨눈 자리. 칸을 세지 않고 **장을 따라 걷다가 표면을 넘는 자리**를 찾는다 —
    /// 넘은 뒤 몇 번 이등분해 표면 위에 정확히 세운다.
    /// </summary>
    public static class KgdFieldRay
    {
        public struct Hit
        {
            public bool Any;
            public Vector3 At, Normal;
            public float Distance;
            /// <summary>표면 안쪽 칸 — 재료는 여기서 읽는다.</summary>
            public int X, Y, Z;
            public byte Mat;
        }

        public static Hit Cast(KgdFieldWorld w, Vector3 from, Vector3 dir, float reach, float step = 0.12f)
        {
            var hit = new Hit();
            if (dir.sqrMagnitude < 1e-8f) return hit;
            dir.Normalize();

            float prevT = 0f;
            float prevV = w.Sample(from);
            // 이미 땅속에서 시작하면 겨눌 것이 없다 — 카메라가 벽에 들어간 프레임이다
            if (prevV > 0f) return hit;

            for (float t = step; t <= reach; t += step)
            {
                float v = w.Sample(from + dir * t);
                if (v <= 0f) { prevT = t; prevV = v; continue; }

                float lo = prevT, hi = t;
                for (int i = 0; i < 4; i++)
                {
                    float mid = (lo + hi) * 0.5f;
                    if (w.Sample(from + dir * mid) > 0f) hi = mid; else lo = mid;
                }
                float at = (lo + hi) * 0.5f;
                hit.Any = true;
                hit.Distance = at;
                hit.At = from + dir * at;
                hit.Normal = w.Normal(hit.At);
                var inside = hit.At - hit.Normal * 0.35f;
                hit.X = Mathf.FloorToInt(inside.x);
                hit.Y = Mathf.FloorToInt(inside.y);
                hit.Z = Mathf.FloorToInt(inside.z);
                hit.Mat = w.Mat(hit.X, hit.Y, hit.Z);
                // 표면 안쪽 칸이 비어 있으면(얇은 껍질) 한 칸 더 들어가 본다
                if (hit.Mat == 0)
                {
                    inside -= hit.Normal * 0.5f;
                    hit.Mat = w.Mat(Mathf.FloorToInt(inside.x), Mathf.FloorToInt(inside.y), Mathf.FloorToInt(inside.z));
                }
                return hit;
            }
            return hit;
        }
    }
}
