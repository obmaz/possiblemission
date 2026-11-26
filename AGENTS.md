# Codex / 범용 AI 에이전트 설정

@[agent.md](./agent.md)

## Codex / 범용 에이전트 환경 규칙
- 공통 프로젝트 규칙은 반드시 루트 `agent.md`를 따릅니다.
- `.agents/skills/spot-difference-stage/SKILL.md` 실행 전 이미지 생성/편집 도구(`image-generator` 등)를 실제로 호출할 수 있는지 확인합니다. 도구가 없으면 즉시 중단하고 진행 불가를 알립니다.
- 작업 완료 전 `npm run verify:spot --prefix tools/e2e`와 `npm test --prefix tools/e2e`를 실행해 실패가 없는지 확인합니다.
