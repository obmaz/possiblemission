# Claude Code 전용 설정

@agent.md

## Claude Code 환경 규칙
- 틀린그림찾기 신규 스테이지 제작 요청 시 먼저 `.agents/skills/spot-difference-stage/SKILL.md`를 확인합니다.
- Claude Code 세션에 이미지 생성·편집이 가능한 외부 MCP/도구/모델이 연결되어 있지 않다면 작업을 진행하지 말고, 사용자에게 **"현재 AI(Claude Code) 환경에는 이미지 생성 모델이 연결되어 있지 않아 생성형 틀린그림찾기 스테이지 제작을 진행할 수 없습니다."** 라고 명확히 알리고 중단하세요.
- 코드 수정 후에는 `npm run verify:spot --prefix tools/e2e` 및 `npm test --prefix tools/e2e`로 검증 결과를 확인한 뒤 보고합니다.
