using UnityEngine;

namespace Kgd.Play
{
    /// <summary>
    /// 클립 없이 팔다리를 잡는다. 기어오르기·막기·던지기처럼 **킷에 클립이 없는 동작**에 쓴다.
    ///
    /// **로컬 오일러 각을 쓰지 않는다.** 뼈의 로컬 축은 킷마다 다르다 — 「Z 로 -150°」로
    /// 두었더니 어떤 킷에서는 팔이 등 뒤로 꺾여 올라갔다(실제 신고). 대신 **월드 방향**을
    /// 준다: 「이 뼈가 자식 뼈를 향하는 방향이 이쪽이 되게」. 지금 방향에서 원하는 방향으로
    /// 도는 회전을 곱하므로 축이 무엇이든 결과가 같다.
    ///
    /// 뼈 이름은 Mixamo 계열(LeftArm·LeftForeArm·LeftHand…)을 먼저 찾고, 없으면 조각으로 찾는다.
    /// </summary>
    public sealed class KgdLimbs
    {
        public sealed class Chain
        {
            public Transform Upper, Lower, End;
            public bool Ok => Upper != null && Lower != null && End != null;
        }

        public readonly Chain LeftArm = new(), RightArm = new(), LeftLeg = new(), RightLeg = new();
        public Transform Spine;

        public bool Ok => LeftArm.Ok && RightArm.Ok && LeftLeg.Ok && RightLeg.Ok;

        public KgdLimbs(Transform root)
        {
            LeftArm.Upper = Find(root, "LeftArm", "Arm_L", "UpperArm_L");
            LeftArm.Lower = Find(root, "LeftForeArm", "ForeArm_L", "LowerArm_L");
            LeftArm.End = Find(root, "LeftHand", "Hand_L");
            RightArm.Upper = Find(root, "RightArm", "Arm_R", "UpperArm_R");
            RightArm.Lower = Find(root, "RightForeArm", "ForeArm_R", "LowerArm_R");
            RightArm.End = Find(root, "RightHand", "Hand_R");
            LeftLeg.Upper = Find(root, "LeftUpLeg", "UpLeg_L", "Thigh_L");
            LeftLeg.Lower = Find(root, "LeftLeg", "Leg_L", "Shin_L");
            LeftLeg.End = Find(root, "LeftFoot", "Foot_L");
            RightLeg.Upper = Find(root, "RightUpLeg", "UpLeg_R", "Thigh_R");
            RightLeg.Lower = Find(root, "RightLeg", "Leg_R", "Shin_R");
            RightLeg.End = Find(root, "RightFoot", "Foot_R");
            Spine = Find(root, "Spine1", "Spine", "Chest");
        }

        /// <summary>
        /// 한 갈래를 조준한다. 위 뼈가 <paramref name="upperDir"/> 을, 아래 뼈가 <paramref name="lowerDir"/> 을
        /// 향하게 — 둘 다 월드 방향. 위를 먼저 돌려야 아래의 시작점이 맞는다.
        /// </summary>
        public static void Aim(Chain c, Vector3 upperDir, Vector3 lowerDir)
        {
            if (!c.Ok) return;
            Aim(c.Upper, c.Lower, upperDir);
            Aim(c.Lower, c.End, lowerDir);
        }

        private static void Aim(Transform bone, Transform child, Vector3 want)
        {
            var cur = child.position - bone.position;
            if (cur.sqrMagnitude < 1e-6f || want.sqrMagnitude < 1e-6f) return;
            bone.rotation = Quaternion.FromToRotation(cur.normalized, want.normalized) * bone.rotation;
        }

        /// <summary>
        /// 기어오르는 자세. <paramref name="phase"/> 는 라디안으로 흐르고, <paramref name="facing"/> 은 벽을 향한
        /// 수평 방향. **한 팔이 위로 뻗을 때 반대쪽 다리가 무릎을 올린다** — 그래야 기어오르는 것으로 읽힌다.
        /// </summary>
        public void Climb(float phase, Vector3 facing)
        {
            facing = new Vector3(facing.x, 0f, facing.z).normalized;
            var side = Vector3.Cross(Vector3.up, facing);
            float a = Mathf.Sin(phase);   // +1: 왼팔이 높이 · 오른다리가 올라감

            Arm(LeftArm, -side, 0.5f + 0.5f * a, facing);
            Arm(RightArm, side, 0.5f - 0.5f * a, facing);
            Leg(LeftLeg, -side, 0.5f - 0.5f * a, facing);
            Leg(RightLeg, side, 0.5f + 0.5f * a, facing);
        }

        // reach 0: 낮게 잡고 있음 · 1: 머리 위로 뻗음
        private static void Arm(Chain c, Vector3 outSide, float reach, Vector3 facing)
        {
            var low = Vector3.up * 0.55f + facing * 0.35f + outSide * 0.40f;
            var high = Vector3.up * 0.92f + facing * 0.22f + outSide * 0.12f;
            var upper = Vector3.Lerp(low, high, reach);
            // 팔뚝은 벽으로 들어가며 손이 몸쪽으로 온다 — 벽을 잡는 손
            var lower = facing * 0.62f + Vector3.up * (0.25f + 0.35f * reach) - outSide * 0.18f;
            Aim(c, upper, lower);
        }

        // lift 0: 발을 아래로 딛음 · 1: 무릎을 앞으로 올림
        private static void Leg(Chain c, Vector3 outSide, float lift, Vector3 facing)
        {
            var down = Vector3.down * 0.85f + facing * 0.30f + outSide * 0.22f;
            var raised = Vector3.down * 0.30f + facing * 0.60f + outSide * 0.45f;
            var upper = Vector3.Lerp(down, raised, lift);
            // 정강이는 무릎에서 벽 쪽 아래로 — 발바닥이 벽을 민다
            var lower = Vector3.down * 0.80f + facing * (0.25f + 0.25f * lift);
            Aim(c, upper, lower);
        }

        /// <summary>
        /// 자세가 사람 몸으로 가능한가. 게이트가 부른다.
        /// 관절이 접힌 각(0 = 곧음)과, 손·무릎이 몸 **앞**(벽 쪽)에 있는지를 낸다.
        /// </summary>
        public struct Report
        {
            public float LeftElbow, RightElbow, LeftKnee, RightKnee;
            public bool HandsInFront, KneesInFront, AHandAboveShoulder;
        }

        public Report Check(Vector3 facing)
        {
            facing = new Vector3(facing.x, 0f, facing.z).normalized;
            var r = new Report
            {
                LeftElbow = Bend(LeftArm), RightElbow = Bend(RightArm),
                LeftKnee = Bend(LeftLeg), RightKnee = Bend(RightLeg),
            };
            r.HandsInFront = InFront(LeftArm, facing) && InFront(RightArm, facing);
            r.KneesInFront = KneeFront(LeftLeg, facing) && KneeFront(RightLeg, facing);
            r.AHandAboveShoulder = (LeftArm.Ok && LeftArm.End.position.y > LeftArm.Upper.position.y) ||
                                   (RightArm.Ok && RightArm.End.position.y > RightArm.Upper.position.y);
            return r;
        }

        private static float Bend(Chain c)
        {
            if (!c.Ok) return 0f;
            var a = c.Lower.position - c.Upper.position;
            var b = c.End.position - c.Lower.position;
            return Vector3.Angle(a, b);
        }

        private static bool InFront(Chain c, Vector3 facing) =>
            c.Ok && Vector3.Dot(c.End.position - c.Upper.position, facing) > 0f;

        private static bool KneeFront(Chain c, Vector3 facing) =>
            c.Ok && Vector3.Dot(c.Lower.position - c.Upper.position, facing) > -0.05f;

        private static Transform Find(Transform root, params string[] names)
        {
            foreach (var n in names)
            {
                var t = Kgd.Art.KgdKit.FindBone(root, n);
                if (t != null) return t;
            }
            return null;
        }
    }
}
