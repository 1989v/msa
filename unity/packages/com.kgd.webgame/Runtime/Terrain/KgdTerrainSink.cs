using UnityEngine;

namespace Kgd.Terrain
{
    /// <summary>
    /// 지형을 그리고 막는 쪽. 게임마다 메시 빌더도 충돌 구조도 달라서, 패키지는
    /// **무엇을 놓을지만 정하고 어떻게 놓을지는 게임이 정한다.**
    ///
    /// 이 인터페이스가 없으면 패키지가 게임의 MeshBuilder·Chunk 타입을 알아야 하고,
    /// 그러면 다음 게임이 이 지형을 쓰려면 그 타입부터 복사해 와야 한다.
    /// </summary>
    public interface IKgdTerrainSink
    {
        /// <summary>회전한 상자 하나. 좌표는 고지대 중심 기준 로컬이다.</summary>
        void Box(Vector3 center, Vector3 size, Quaternion rotation, Color color);

        /// <summary>바닥에 눕힌 사각 하나. 좌표는 로컬이다.</summary>
        void Quad(Vector3 center, float width, float depth, Color color);

        /// <summary>막는 원판 하나. 좌표는 **월드**다 — 충돌은 대개 전역 격자에 들어간다.</summary>
        void Blocker(Vector3 worldPosition, float radius);

        /// <summary>이 자리의 바닥색. 고지대 윗면이 주변 지면과 이어져 보이게 쓴다.</summary>
        Color GroundColorAt(Vector3 worldPosition);
    }

    /// <summary>고지대에 쓰는 색. 게임의 팔레트를 그대로 넘긴다.</summary>
    public struct KgdPlateauPalette
    {
        /// <summary>절벽 옆면.</summary>
        public Color Cliff;

        /// <summary>절벽 끝 윗입술 — 옆면보다 밝아야 높이가 실루엣으로 읽힌다.</summary>
        public Color Lip;

        /// <summary>비탈과 그 위로 이어지는 길.</summary>
        public Color Ramp;

        public static KgdPlateauPalette Default => new()
        {
            Cliff = new Color(0.42f, 0.44f, 0.47f),
            Lip = new Color(0.62f, 0.64f, 0.68f),
            Ramp = new Color(0.52f, 0.40f, 0.30f),
        };
    }
}
