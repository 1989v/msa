using UnityEngine;

namespace Kgd.Field
{
    /// <summary>
    /// 재료 한 종류의 성질. 게임이 표로 만들어 <see cref="KgdFieldWorld"/> 에 넘긴다.
    ///
    /// **성질과 값을 여기서 가른다.** 「빛을 막는가 · 액체인가 · 빛나는가」는 세계가 어떻게
    /// 도는지를 정하므로 패키지가 알아야 하고, 「각질은 회색」·「끌로 1.2초」는 게임의 값이라
    /// 게임이 채운다. 색을 패키지가 들면 게임마다 팔레트를 고쳐야 한다.
    /// </summary>
    public struct KgdFieldKind
    {
        /// <summary>몸을 막는가. 액체는 막지 않는다.</summary>
        public bool Solid;

        /// <summary>빛과 시야를 막는가. 갓처럼 차 있어도 빛은 지나는 것이 있다.</summary>
        public bool Opaque;

        /// <summary>액체 — 수면을 따로 뜨고 충돌하지 않는다.</summary>
        public bool Liquid;

        /// <summary>스스로 내는 빛 0~15.</summary>
        public byte Glow;

        /// <summary>위를 보는 면 · 선 면 · 아래를 보는 면의 색. 등치면은 법선의 기울기로 섞는다.</summary>
        public Color Top, Side, Bottom;

        /// <summary>맨손으로 한 칸 캐는 데 걸리는 초. 0 이면 즉시, 음수면 캘 수 없다(심핵).</summary>
        public float Hardness;

        /// <summary>공기인가 — id 0 은 항상 공기다.</summary>
        public bool Empty => !Solid && !Liquid;

        /// <summary>한 색에서 위·옆·아래를 뽑는다. 세 면을 따로 고를 이유가 없을 때 쓴다.</summary>
        public static KgdFieldKind Solidly(Color c, float hardness, float topLift = 1.06f,
                                           float bottomDrop = 0.72f)
            => new()
            {
                Solid = true,
                Opaque = true,
                Hardness = hardness,
                Top = c * topLift,
                Side = c,
                Bottom = c * bottomDrop,
            };
    }
}
