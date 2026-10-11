# 기준선 결정 — 세트 교체 커밋에 넣을 `EVAL_BASELINE_KO/EN` (TG5.2, 배포 전)

2026-10-11. 결론: **배포 전 검색 파드 안에서 잰 v3 값(C ko 0.7364 · en 0.7097)을 임시 기준선으로 둔다.**
`cronjob-eval.yaml` 주석에 「임시값 — 배포 뒤 첫 정기 실행 값으로 갱신」을 적었다.

## 선택지와 `gate()` 동작

`live-eval.py` `gate()` 는 기준선 env 가 비면 그 언어를 재기만 하고 통과시킨다(`if base[lang] and …`).
첫 실행에 실패하지 않게 하는 별도 장치(초회 모드·자동 기준선)는 없다 — 빈 기준선이 유일한 기존 방식이다.

같은 `gate()` 에 세 기준선을 넣고 두 입력(참고 측정값, 0.04 남짓 떨어진 값)을 줬다(스크래치패드, 네트워크 없음):

| 기준선 (ko / en) | 입력 C .7364 / .7097 | 입력 C .70 / .67 |
|---|---|---|
| v2 그대로 .7767 / .7140 | exit 1 — 「C ko 0.7364 < 기준선 0.7767 - 0.03」 | exit 1 |
| v3 참고 측정 .7364 / .7097 | exit 0 | exit 1 — ko·en 둘 다 회귀 |
| 비움 | exit 0 | **exit 0** |

- v2 기준선을 두면 회귀가 없어도 첫 실행이 ko 에서 실패한다(눈금 차 −0.04, 대부분 새 사례가 어려운 탓).
- 비우면 첫 실행은 통과하지만 기준선을 다시 넣을 때까지 게이트가 열려 있다. 갱신을 잊으면 영영 열린 채로 남고,
  그동안 떨어져도 초록불이다.
- 참고 측정값을 두면 같은 값은 통과하고 0.03 넘게 떨어지면 잡힌다.

## 참고 측정값을 기준선으로 써도 되는 근거

- **클러스터 안 실행 값이다.** 로컬 공개 API 경유(엣지)가 아니라 검색 파드 encoder 컨테이너 안에서 C 를 `localhost:8083`
  (CronJob 은 Service `search:8083`, 같은 앱)로 불렀다. A·B 도 같은 OpenSearch·인코더를 불렀다.
- **같은 스크립트·같은 세트다.** 실행(10:18 KST)에 쓴 `live-eval.py` 는 커밋 `1c712c563` 의 것(파일 수정 10:09)이고,
  레포 세트 `judgments-attractions-2026-10-11.json` 은 실행에 쓴 초안 `s36b/judgments-attractions-v3-draft.json`(10:17)과
  JSON 값이 같다(직렬화만 한 질의 한 줄로 바꿈, 왕복 비교 단언 통과).
- **v2 교체 선례와 같다.** v2 커밋 `82611eafa` 도 배포 전에 잰 v2 값(.7767 / .7140)을 세트 파일과 한 커밋에 넣었다.

## 남는 차이와 처리

- 실행 위치(검색 파드 vs Job 파드)와 날짜(색인 드리프트)가 다르다. v2 에서 색인 드리프트로 ±0.02 움직인 적이 있고
  허용폭이 0.03 이라, 첫 정기 실행이 기준선 아래로 0.03 넘게 나오면 Job 이 Failed 로 남는다 — 그때는 회귀인지 드리프트인지
  `C · v2 150 질의만` 줄(v2 기준선 대비)로 먼저 가른다.
- **배포 뒤 할 일(이 묶음 밖)**: 첫 정기 실행(또는 Q5 조건의 수동 Job) 로그의 C ko·en 으로 env 두 줄과 주석의 「임시값」 줄을
  바꾸고, `verifications/first-run.md` 에 의도별 표·판정 줄·소요 시간을 남긴다.

## 소요 시간 (SR-5.2 의 900초 비교)

v2 정기 실행 69초(시작 대기 20초 포함) × 228/150 × 1.5 ≈ 157초. 파드 안 실측 68.4초 + 대기 20초 ≈ 88초.
`activeDeadlineSeconds: 900` 보다 작아 기준선 커밋을 멈출 사유가 없다.

## 렌더 확인 (로컬, 클러스터 접근 없음)

```
$ kubectl kustomize k8s/overlays/oci-arm -o <스크래치패드>/render-split   # exit 0
ConfigMap search-eval-84tffmkfbb 키: judgments-attractions-2026-10-11.json · live-eval.py (173,544 바이트)
  두 키 값이 레포 파일과 바이트 동일(ruby YAML 로 읽어 File.read 와 비교)
CronJob search-eval: command … /eval/judgments-attractions-2026-10-11.json · volume configMap search-eval-84tffmkfbb
  EVAL_BASELINE_KO "0.7364" · EVAL_BASELINE_EN "0.7097"
렌더 전체에서 judgments-attractions-2026-10-05 등장 0회
```

형식 검사(`check_format`, 네트워크 없음): 옛 `2026-10-05.json` 위반 450 · 새 `2026-10-11.json` 위반 0.
옛 파일과 CronJob 이 짝이 어긋나면 첫 실행이 형식 위반으로 멈추므로 세트 파일·CronJob 파일명·기준선은 한 커밋이어야 한다.
