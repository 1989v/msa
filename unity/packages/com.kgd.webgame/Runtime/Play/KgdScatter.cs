using System;
using System.Collections.Generic;
using Kgd.Motion;
using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 무언가를 지형 위에 뿌린다.
    ///
    /// **뿌린 자리가 갈 수 있는 곳인지 확인한다.** 안 하면 건물 속·절벽 안에 놓이고,
    /// 그건 「있는데 못 가는 것」이라 없는 것보다 나쁘다 — 화면에는 보이기 때문이다.
    ///
    /// 난수는 시드를 받는다. 같은 시드면 같은 배치가 나와야 검사가 성립한다.
    /// </summary>
    public static class KgdScatter
    {
        /// <summary>고리 안에 흩는다. 반경 범위와 개수를 준다.</summary>
        public static List<Vector3> Ring(int seed, int count, float inner, float outer,
                                         IKgdGround ground, Vector3 center = default,
                                         Func<Vector3, bool> accept = null, int tries = 12)
        {
            var rng = new System.Random(seed);
            var found = new List<Vector3>(count);
            for (int i = 0; i < count; i++)
            {
                for (int t = 0; t < tries; t++)
                {
                    float a = (float)(rng.NextDouble() * Mathf.PI * 2.0);
                    float r = Mathf.Lerp(inner, outer, (float)rng.NextDouble());
                    var at = center + new Vector3(Mathf.Cos(a) * r, 0f, Mathf.Sin(a) * r);
                    at.y = ground.HeightAt(at);
                    if (accept != null && !accept(at)) continue;
                    found.Add(at);
                    break;
                }
            }
            return found;
        }

        /// <summary>한 자리를 둘러싸게 놓는다. 각을 나눠 겹치지 않는다.</summary>
        public static List<Vector3> Around(Vector3 center, int count, float radius,
                                           IKgdGround ground, float offset = 0f)
        {
            var found = new List<Vector3>(count);
            for (int i = 0; i < count; i++)
            {
                float a = offset + i / (float)count * Mathf.PI * 2f;
                var at = center + new Vector3(Mathf.Cos(a) * radius, 0f, Mathf.Sin(a) * radius);
                at.y = ground.HeightAt(at);
                found.Add(at);
            }
            return found;
        }

        /// <summary>
        /// 고도를 0~1 난이도로 바꾼다. **높이가 곧 난이도**인 게임에서 배치 규칙이
        /// 여기저기 흩어지지 않게 한 곳에 둔다.
        /// </summary>
        public static float Tier(float y, float rise, int steps)
            => Mathf.Clamp01(y / Mathf.Max(1f, rise)) * steps;
    }
}
