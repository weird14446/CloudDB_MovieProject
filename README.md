# FilmNavi (CloudDB Movie Project)
영화 데이터를 모아서 추천/리뷰/좋아요를 제공하는 풀스택 데모입니다. Next.js 기반 백엔드(API)와 Vite + React 프론트엔드, MySQL을 사용합니다.

## 기술 스택
- Backend: Next.js 14 (App Router), TypeScript, mysql2
- Frontend: React + Vite + TypeScript
- DB: MySQL 8
- 배포/개발: Docker Compose, VS Code Dev Container

## 빠르게 실행하기 (Docker Compose)
1. TMDB API 키를 준비하고 필요한 환경 변수를 셋업합니다.
   ```bash
   export TMDB_API_KEY=<TMDB에서 발급받은 키>
   export ADMIN_IMPORT_TOKEN=root-import   # 선택, 기본값 동일
   ```
2. 빌드 및 실행:
   ```bash
   docker compose build
   docker compose up -d
   ```
3. 접속:
   - 프론트엔드: http://localhost:8080
   - 백엔드 API: http://localhost:3000
   - MySQL: 포트 3307 (계정 `movieapp` / `moviepass`, DB `movieapp`)
4. DB 초기화: 컨테이너에 들어가 필요한 스키마/데이터를 직접 주입합니다.
   ```bash
   docker compose exec db bash
   mysql -u movieapp -pmoviepass movieapp < your_dump.sql
   ```
   참고 스크립트: `backend/sql` (제약 추가, 기본 사용자 등).

## 로컬 개발 (컨테이너 없이)
- Backend:
  ```bash
  cd backend
  npm install
  DB_HOST=localhost DB_USER=movieapp DB_PASSWORD=moviepass DB_NAME=movieapp \
  TMDB_API_KEY=<키> ADMIN_IMPORT_TOKEN=root-import npm run dev
  ```
- Frontend:
  ```bash
  cd movie-app
  npm install
  VITE_API_BASE_URL=http://localhost:3000/api \
  VITE_TMDB_API_KEY=<키> \
  VITE_ADMIN_IMPORT_TOKEN=root-import \
  npm run dev -- --host --port 5173
  ```

## VS Code Dev Container
`Dev Containers: Reopen in Container`로 열면 `.devcontainer/docker-compose.dev.yml` 기반 환경이 올라갑니다. 포트(3000, 5173, 8080, 3307)가 호스트로 포워딩되며 `postCreateCommand`가 두 패키지 의존성을 설치합니다.

## 주요 환경 변수
- 공통: `TMDB_API_KEY` (필수), `ADMIN_IMPORT_TOKEN` (관리용 토큰, 기본 `root-import`)
- 백엔드: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- 프론트엔드(Vite): `VITE_API_BASE_URL` (기본 `/api`), `VITE_TMDB_API_KEY`, `VITE_ADMIN_IMPORT_TOKEN`
