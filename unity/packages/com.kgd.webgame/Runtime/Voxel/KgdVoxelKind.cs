using UnityEngine;

namespace Kgd.Voxel
{
    /// <summary>
    /// 블록 한 종류의 성질. 게임이 표로 만들어 <see cref="KgdVoxelWorld"/> 에 넘긴다.
    ///
    /// **성질과 값을 여기서 가른다.** 「막는가 · 빛을 통과시키는가 · 액체인가」는 지형이
    /// 어떻게 도는지를 정하므로 패키지가 알아야 하고, 「돌은 회색」·「곡괭이로 1.2초」는
    /// 게임의 값이라 게임이 채운다. 색을 패키지가 들면 게임마다 팔레트를 고쳐야 한다.
    /// </summary>
    public struct KgdVoxelKind
    {
        /// <summary>몸을 막는가. 액체는 막지 않는다.</summary>
        public bool Solid;

        /// <summary>빛과 시야를 막는가. 유리·잎처럼 solid 지만 빛은 통과하는 것이 있다.</summary>
        public bool Opaque;

        /// <summary>액체 — 따로 그리고 충돌하지 않는다. 윗면이 한 칸보다 낮다.</summary>
        public bool Liquid;

        /// <summary>스스로 내는 빛 0~15. 횃불이 14, 용암이 15.</summary>
        public byte Glow;

        /// <summary>윗면 · 옆면 · 아랫면 색. 세 면을 갈라야 블록 하나가 입체로 읽힌다.</summary>
        public Color Top, Side, Bottom;

        /// <summary>맨손으로 캐는 데 걸리는 초. 0 이면 즉시, 음수면 캘 수 없다(바닥돌).</summary>
        public float Hardness;

        /// <summary>공기인가 — id 0 은 항상 공기다.</summary>
        public bool Empty => !Solid && !Liquid;

        public Color FaceColor(int dir) => dir switch
        {
            2 => Top,       // +Y
            3 => Bottom,    // -Y
            _ => Side,
        };

        /// <summary>한 색에서 위·옆·아래를 뽑는다. 세 면을 따로 고를 이유가 없을 때 쓴다.</summary>
        public static KgdVoxelKind Solidly(Color c, float hardness, float topLift = 1.06f,
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
