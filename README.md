# ImageForge

[![CI](https://github.com/replworks/imageforge/actions/workflows/ci.yml/badge.svg)](https://github.com/replworks/imageforge/actions/workflows/ci.yml)
[![Build and deploy](https://github.com/replworks/imageforge/actions/workflows/deploy.yml/badge.svg)](https://github.com/replworks/imageforge/actions/workflows/deploy.yml)
[![update-changelog](https://github.com/replworks/imageforge/actions/workflows/update-changelog.yml/badge.svg)](https://github.com/replworks/imageforge/actions/workflows/update-changelog.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

![https://if.repl.net](https://if.repl.net/og.png)

ImageForge는 공개 페이지와 운영자 전용 Purge 도구를 함께 제공하는 프로젝트입니다. `img.repl.net`에서 제공되는 이미지 캐시를 빠르게 Purge하고, 운영자는 Cloudflare Purge API를 통해 즉시 정리할 수 있습니다.

이 프로젝트는 공개 랜딩 페이지와 보호된 `/purge` 콘솔을 분리해 운영자 인증을 유지하면서도, 이미지 갱신 직후 캐시를 신속하게 정리할 수 있도록 설계되었습니다.

## 소개

ImageForge는 다음 기능을 제공합니다.

- 공개 페이지 `/` 제공
- 운영자 전용 `/purge` 콘솔 제공
- Cloudflare Access JWT 검증을 통한 접근 제어
- 정확한 URL Purge 및 prefix Purge 지원
- 허용된 서비스 목록 기반 검증
- Vite + Hono 기반의 웹 애플리케이션

## 주요 기능

- 공개 랜딩 페이지와 반응형 UI
- `/health` 헬스 체크 엔드포인트
- 운영자 전용 보호 영역
- 단일 URL 캐시 Purge
- prefix 기반 전체 경로 캐시 Purge
- 서비스 allowlist 적용
- Cloudflare API 호출을 위한 안전한 검증 로직
- TypeScript 기반 코드와 Vitest 테스트

## 기술 스택

- Node.js 24
- TypeScript
- Hono
- Vite
- Tailwind CSS v4
- Vitest
- `jose`를 이용한 Cloudflare Access JWT 검증

## 프로젝트 구조

```text
.
├── index.html                 # 공개 랜딩 페이지
├── purge/
│   └── index.html             # 운영자 콘솔 진입점
├── src/
│   ├── access.ts              # JWT 검증 로직
│   ├── app.ts                 # Hono 라우팅 및 앱 구성
│   ├── config.ts              # 환경 변수 검증
│   ├── purge.ts               # purge 입력 검증 및 API 호출
│   ├── access.test.ts         # 인증 관련 테스트
│   ├── app.test.ts            # 라우팅/보호 구역 테스트
│   └── purge.test.ts          # purge 로직 테스트
├── scripts/
│   └── purge-boundary-probe.mjs
├── .github/
│   └── workflows/
│       ├── ci.yml             # CI 검증
│       └── deploy.yml         # Docker 이미지 빌드 및 Coolify 배포
├── Dockerfile                 # 프로덕션 이미지 빌드
├── LICENSE                    # MIT 라이선스
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
├── README.md
└── package-lock.json
```

## 요구 사항

- Node.js 24.x
- npm
- Cloudflare Access 설정
- Cloudflare Zone ID
- Cache Purge 권한이 있는 Cloudflare API Token

## 환경 변수

앱 실행 전 아래 환경 변수를 설정하세요. 예시 파일은 [.env.example](./.env.example)에 정리되어 있습니다.

```bash
PORT=3000
SERVICES=images,avatars,products
IMAGE_HOST=img.repl.net
CF_ZONE_ID=your-zone-id
CF_API_TOKEN=your-cloudflare-api-token
CF_ACCESS_TEAM_DOMAIN=your-team-domain
CF_ACCESS_AUD=your-access-audience
```

주의 사항:

- `SERVICES`는 콤마로 구분된 서비스 목록입니다.
- `IMAGE_HOST`는 프로토콜 없이 호스트명만 입력해야 합니다.
- `CF_API_TOKEN`은 저장소에 커밋하지 않고, 배포 환경 변수로 관리하는 것이 안전합니다.
- 동작용어는 `무효화`가 아니라 `Purge`로 통일합니다.

## 로컬 실행

의존성 설치:

```bash
npm install
```

개발 서버 실행:

```bash
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

빌드 결과 실행:

```bash
npm start
```

## 로컬에서 `/purge` 화면 테스트하기

`/purge`는 Cloudflare Access 인증이 걸려 있어서, `npm run dev`로 띄운 로컬 서버에 그냥 접속하면 항상 401이 뜹니다. UI/동작만 로컬에서 확인하려면 두 가지를 같이 사용하세요.

1. **Cloudflare Access 인증 우회** — `.env`에 다음을 추가합니다.

   ```bash
   CF_ACCESS_DEV_BYPASS=1
   ```

   이 값이 정확히 `1`일 때만 `/purge` 라우트의 Cloudflare Access JWT 검증을 건너뜁니다. 로컬 개발 전용이며, 배포 환경 변수에는 절대 설정하면 안 됩니다. 기본값은 꺼짐(`0`)입니다.

2. **Vite dev 서버 + 백엔드를 같이 실행** — Vite(`npm run dev`)는 화면만 서빙하고, `/purge/catalog`·`/purge/execute` 요청은 로컬 Hono 서버로 프록시됩니다. 그래서 백엔드도 같이 떠 있어야 합니다.

   한 터미널에서 빌드와 두 서버를 모두 실행:

   ```bash
   npm run dev:purge
   ```

   또는 직접 두 터미널로 나눠서:

   ```bash
   npm run build
   node --env-file-if-exists=.env build/server.js   # 터미널 1: 백엔드
   npm run dev                                      # 터미널 2: Vite
   ```

   이후 `http://localhost:5173/purge/`로 접속하면 운영자 콘솔이 보이고, 서비스 목록도 정상적으로 로드됩니다.

   `npm run dev:purge`는 백엔드를 백그라운드로 띄우고 Vite를 포그라운드로 실행합니다. `Ctrl+C`로 Vite를 끈 뒤에도 백엔드 프로세스가 남아있을 수 있으니, 필요하면 `pkill -f build/server.js`로 정리하세요.

### 실제 Cloudflare 연동을 켜고 끄기

`CF_ACCESS_DEV_BYPASS`는 로그인(접근 제어)만 우회할 뿐, "실행" 버튼을 눌렀을 때 실제 Cloudflare Purge API로 요청이 나가는지와는 무관합니다. `CF_ZONE_ID`/`CF_API_TOKEN`은 둘 다 필수 환경 변수라서 비워두면 서버가 기동하지 않으므로, 연동을 끄고 싶을 때는 **값을 더미 문자열로 바꿔치기**하세요.

- 실제 Cloudflare와 연동해서 테스트: `.env`에 실제 `CF_ZONE_ID`/`CF_API_TOKEN`을 넣습니다.
- 디자인/동작만 확인(실제 캐시에 영향 주지 않음): `CF_ZONE_ID=dummy-zone-id`, `CF_API_TOKEN=dummy-token`처럼 가짜 값을 넣습니다. 서버는 정상적으로 기동하지만, "실행"을 눌러도 Cloudflare가 인증 실패로 거절해서 실제 캐시는 지워지지 않습니다.

## 사용 가능한 스크립트

```bash
npm run dev                 # Vite 개발 서버 실행
npm run dev:purge           # 빌드 + 백엔드(백그라운드) + Vite를 한 번에 실행
npm run build               # 타입 체크 및 프로덕트 빌드
npm start                   # 컴파일된 앱 실행
npm test                    # Vitest 테스트 실행
npm run typecheck           # TypeScript 검사
npm run probe:purge-boundary # 실제 업스트림 purge 동작 확인용 프로브 실행
```

## 테스트

프로젝트는 Vitest를 사용합니다.

```bash
npm test
```

테스트는 다음 항목을 검증합니다.

- 공개 페이지 동작
- 보호된 경로 접근 제어
- JWT 검증
- URL purge 입력 검증
- prefix purge 검증 및 확인 흐름

## 보안 사항

- `/purge` 구역은 Cloudflare Access JWT 검증으로 보호됩니다.
- 보호된 모든 요청은 JWT를 검증한 뒤 처리됩니다.
- Cloudflare API 호출은 서버측 Purge executor에서만 수행됩니다.
- 비밀 값은 저장소에 커밋하지 않고 배포 환경 변수로 관리해야 합니다.

## 배포

이 프로젝트는 공개 페이지와 보호된 Purge 앱을 하나의 서비스로 배포하는 구조를 가정합니다. 보호된 경로는 Cloudflare Access 레이어를 통해 접근을 제한하고, 운영자는 인증된 상태에서만 `/purge` 콘솔을 사용할 수 있습니다.

### Docker

프로젝트에는 `Dockerfile`이 포함되어 있으며, 다음처럼 빌드할 수 있습니다.

```bash
docker build -t imageforge .
docker run --rm --env-file .env -p 3000:3000 imageforge
```

`npm start`를 실행하는 컨테이너 구조로 구성되며, `NODE_ENV=production` 환경에서 동작합니다.

### GitHub Actions + Coolify

이 저장소에는 다음 워크플로우가 포함되어 있습니다.

- `.github/workflows/ci.yml`
  - PR 및 main 브랜치 push 시 실행
  - `npm ci`, `npm run typecheck`, `npm test`, `npm run build` 검증
- `.github/workflows/deploy.yml`
  - GitHub Release 또는 수동 트리거 시 실행
  - `linux/arm64` Docker 이미지를 빌드해 GHCR에 푸시
  - Coolify에 배포 이미지 정보를 반영

배포 환경에서는 `COOLIFY_API_URL`, `COOLIFY_APPLICATION_UUID`, `COOLIFY_API_TOKEN` 같은 시크릿을 설정해 두는 것을 권장합니다.

## 라이선스

이 프로젝트는 MIT 라이선스를 사용합니다.

자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.

## 기여 방법

기여를 환영합니다. 변경을 제안하고 싶다면 아래 절차를 따라 주세요.

1. 저장소를 fork 합니다.
2. 기능 브랜치를 생성합니다.
3. 변경 사항을 구현합니다.
4. 필요한 테스트를 추가하거나 수정합니다.
5. Pull Request를 생성합니다.

## 감사의 말

이 프로젝트는 다음 오픈소스와 서비스에 기반합니다.

- Hono
- Vite
- Tailwind CSS
- Cloudflare Access
- Cloudflare Cache Purge API
