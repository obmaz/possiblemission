---
name: spot-difference-stage
description: >-
  Creates and validates a generative-illustration Spot the Difference stage (`photo-set`)
  matching the project standard (20 images, 18+ disjoint regions, >=9 diffs per pair),
  verifies pixel parity across pairs with automated test cases, and blocks execution
  if the active AI environment lacks an image-generation model.
---

# 틀린그림찾기 생성형 스테이지 제작 스킬 (`spot-difference-stage`)

새로운 틀린그림찾기 테마 스테이지(`photo-set`)를 **생성형 이미지**로 제작하고, 완성된 이미지 풀에 서로 비교 시 틀리거나 누락된 차이가 없는지 테스트 케이스로 검증할 때 사용합니다.

## 0. 필수 사전 게이트: 이미지 생성 모델 유무 확인 (Mandatory)

작업을 시작하기 전에 **반드시** 아래 조건을 먼저 확인하세요.

1. 현재 AI 환경에 **이미지 생성·편집 모델 또는 전용 도구/서브에이전트**(예: `image-generator` 서브에이전트, 이미지 생성 MCP/API)가 실제로 존재하고 호출 가능한지 점검합니다.
2. **사용 가능한 이미지 생성 모델이 없다면 절대 다음 단계로 진행하지 마세요.**
   - 아래 문구와 같이 사용자에게 명확히 알리고 즉시 작업을 종료합니다:
     > "현재 AI 환경에는 이미지 생성 모델(또는 이미지 생성 도구)이 없어 생성형 이미지 기반 틀린그림찾기 스테이지 제작을 진행할 수 없습니다. 이미지 생성이 가능한 AI 모델/도구가 연결된 환경에서 요청해 주세요."
3. **금지 우회**:
   - SVG/Canvas 도형 합성, CSS 필터, 기존 `cafe`/`camp` 이미지 복사·재편집, 저작권 불명 외부 이미지 다운로드, placeholder 이미지로 임의 대체하는 행위는 금지됩니다.

## 1. 현재 프로젝트 기준 갯수 (Standard Spec)

`js/games/spot-stages.js` 및 `cafe` 스테이지 기준 스펙입니다. 신규 `photo-set` 스테이지는 아래 수량을 반드시 충족해야 합니다.

| 항목 | 기준 값 | 비고 |
| --- | --- | --- |
| 이미지 풀 수량 | **20장** | `<stage>-01.jpg` ~ `<stage>-20.jpg` |
| 이미지 해상도·형식 | **1200 × 896** JPEG | `quality=88`, 4:3 비율(`BASE_W=1200, BASE_H=896`) |
| 독립 차이 영역(`REGIONS`) | **최소 18개 이상** | 모든 영역의 `box: [x0, y0, x1, y1]`은 **서로 겹치지 않아야(disjoint)** 함 |
| 난이도별 정답 수 | 쉬움 **5곳**(90초) / 보통 **7곳**(80초) / 어려움 **9곳**(75초) | `SPOT_DIFFICULTIES` 기준 |
| 페어 최소 차이 갯수 | **임의의 2장(20C2 = 190쌍) 모두 ≥ 9개** | `hard` 난이도 9곳 보장 (권장 9~16개) |
| 쉬움(`easy`)용 명확 차이 | **`subtle: false` 영역 ≥ 5개** | 권장 14개 이상 |

> [!IMPORTANT]
> **런타임 렌더링 일치 규칙 (`js/games/spot-difference.js`)**
> 게임은 두 이미지 중 왼쪽 이미지를 기준으로 오른쪽 버퍼를 초기화한 뒤, 해당 라운드에 선택된 `anomalies`의 `box` 영역만 오른쪽 이미지에서 페더링 복사(`copyBoxFeathered`)합니다.
> 따라서 **각 영역 `box`가 서로 겹치지 않아야(disjoint)** 하며, `box` 바깥쪽 배경 픽셀은 모든 20장에서 동일하게 유지되어야 "화면에는 다른데 오답 처리되는" 버그가 발생하지 않습니다.

## 2. 제작 절차

### Step 1. 베이스 일러스트 1장 + 생성형 변형 4~5장 생성
1. `image-generator` 등을 사용해 **1200×896(또는 4:3)** 크기의 **베이스 일러스트 1장**을 생성합니다.
   - 선명한 윤곽선(셀 셰이딩 등)이 있고, 화면 전역에 서로 거리가 떨어진 **소품/배경 오브젝트 18개 이상**을 배치합니다.
2. 동일 베이스 이미지를 참조(image-to-image / edit)로 주고, 구도·카메라·조명·선 굵기를 유지한 **변형 일러스트 4~5장**(`v1`~`v5`)을 생성합니다.
   - 각 변형마다 서로 다른 소품들의 색상·종류·상태(예: 소품 교체, 색상 변경, 장식 추가/제거)를 10여 곳씩 바꾸되, 인접 오브젝트와 경계가 겹치지 않게 편집합니다.
   - 생성 후 **반드시 이미지를 직접 열어 확인**하고, 캐릭터 얼굴 왜곡·전체 색감 변조·배경 shift(구도 틀어짐)가 있으면 해당 변형을 재생성합니다.

### Step 2. `REGIONS` 정의 및 20장 풀 + 매니페스트 빌드
1. 각 변형 이미지와 베이스 이미지의 픽셀 차이를 비교해 18개 이상 영역의 **정규화 비중복 박스 `[x0, y0, x1, y1]`**, 한국어 라벨(`label`), `subtle` 여부를 JSON 설정 파일로 작성합니다.
2. [scripts/build_photo_set.py](./scripts/build_photo_set.py)를 실행해 20장의 조합 이미지와 매니페스트(`js/games/spot-<stageId>-manifest.js`), 대표 썸네일(`assets/images/spot-<stageId>.jpg`)을 생성합니다.
   - 스크립트는 자동으로 박스 비중복 검사, 190쌍 해밍 거리(`min_pair >= 9`) 최적화, 영역별 `worst_l2` 검사를 수행합니다.
3. 생성된 샘플 이미지(`01`, `04`, `08`, `15` 등)를 직접 열어 패치 경계 잘림·잔상·어색한 크기가 없는지 육안 검수합니다. (이상이 있으면 박스를 쪼개거나 변형 소스를 교정 후 재빌드)

### Step 3. 게임 레지스트리 등록
1. [js/games/spot-stages.js](../../../../js/games/spot-stages.js)의 `SPOT_STAGES` 배열에 스테이지 메타데이터 추가 (`kind: 'photo-set'`).
2. [js/games/spot-<stageId>-manifest.js](../../../../js/games/)에서 export한 `REGIONS`/`IMAGES` 상수를 [js/games/spot-difference.js](../../../../js/games/spot-difference.js) 상단 `PHOTO_SET_STAGES`에 등록.

### Step 4. 서로 비교 시 틀린 곳이 없는지 전수 검토 & 테스트 실행 (필수)
1. 틀린그림찾기 전수 비교 테스트 케이스 실행:
   ```bash
   npm run verify:spot --prefix tools/e2e
   ```
   - 20장 이상 여부 및 모든 이미지 `1200×896` 해상도 확인
   - 18개 이상 영역 및 모든 영역 `box` 비중복(disjoint) 확인
   - 20C2 = 190개 모든 쌍의 차이 갯수 `>= 9` 확인
   - **전수 픽셀 비교 검토**:
     - `states`가 같은 영역 및 `box` 바깥 배경에서 의도치 않은 픽셀 차이가 없는지(`worstBgMeanL2 <= 2.5`, `maxSameStateMeanL2 <= 3.0`)
     - `states`가 다른 영역에서는 실제로 눈에 보이는 색차가 존재하는지(`minActiveDiffL2 >= 3.0`, `maxDelta >= 45`)
2. 전체 플레이 E2E 회귀 테스트 실행:
   ```bash
   npm test --prefix tools/e2e
   ```
   - `cafe` / 신규 스테이지 모두 쉬움(5곳)·어려움(9곳) 1:1 픽셀 일치 및 클릭 클리어 통과 확인 (`consoleErrors: []`).
