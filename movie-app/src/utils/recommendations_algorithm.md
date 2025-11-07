# FilmNavi 추천 알고리즘 설계서

## 목적
- 사용자 평점·좋아요 신호로 감독 선호도를 추정하고, 영화 품질(가중 평균 평점)·장르 친화도를 결합해 맞춤 랭킹을 생성한다.

## 데이터 모델
- 사용자 상호작용
  - 좋아요: `number[]` (영화 ID 집합)
  - 리뷰/평점: `reviewsByMovie[movieId]`에서 `user.name`과 일치하는 항목의 `rating`
- 영화 메타(Movie)
  - 기본: `id`, `title`, `year`, `genres[]`, `posterUrl?`
  - 감독: `director` (필수)
  - 품질: `avgRating?`(0~10), `voteCount?`
- 전역 통계
  - 전체 평균 평점 `C`(없으면 6.5), 최소 표본 임계치 `m`(기본 150)

## 핵심 지표와 수식
- 영화 가중 평균 평점 (IMDb 방식)
  - R = 영화 평균 평점, v = 투표 수, C = 전역 평균, m = 임계치  
  - WR = (v/(v+m))·R + (m/(v+m))·C
- 좋아요 신뢰도 (Wilson 하한, z≈1.28)
  - p = likes/seen, n = seen  
  - wlb = (p + z²/2n − z·sqrt(p(1−p)/n + z²/4n²)) / (1 + z²/n)
- 사용자 평점 편차(수축)
  - 사용자 개인 평균 μ_u, 감독별 평균 μ_{u,d}, 표본 n  
  - Δ = μ_{u,d} − μ_u  
  - Δ̂ = (n/(n+c))·Δ, c≈3  
  - r = tanh(Δ̂/0.7) ∈ [-1, 1]
- 장르 친화도
  - GenreAffinity = |영화 장르 ∩ 선호 장르| / |선호 장르| (선택 장르 없으면 0)
- 감독 선호 점수
  - q = normalize(감독 좋아요 영화들의 평균 WR, 0~1)  
  - S_dir = w_r·r + w_l·wlb + w_q·q  (기본 w_r=0.5, w_l=0.3, w_q=0.2)
- 최종 영화 점수
  - score(movie) = α·S_dir(u, director(movie)) + β·normalize(WR) + γ·GenreAffinity  
  - 기본 α=0.5, β=0.35, γ=0.15

## 알고리즘 파이프라인
1. 전역 평균 C와 임계 m 결정, 각 영화의 WR 계산
2. 사용자 개인 평균 평점 μ_u 계산(본인이 남긴 리뷰 평균)
3. 사용자 신호 수집(좋아요/리뷰 존재) 영화만 대상으로 감독별 통계 누적
   - likes, seen, ratingSum/count, 좋아요 영화의 WR 합
4. 감독별 r(수축된 평점 편차), wlb(좋아요 신뢰도), q(평균 WR 정규화)로 S_dir 산출
5. 후보(미시청) 영화에 대해 최종 score 계산 → 내림차순 정렬
6. 개인 신호가 없으면 WR 기반 상위 N으로 폴백
7. 확장 시 MMR 등으로 다양성 재순위화(옵션)

## 하이퍼파라미터 권장값
- Wilson z: 1.2816(80% 하한) 또는 1.96(95%)
- 평점 수축 c: 3
- IMDb 임계 m: 150 (데이터 규모 커지면 ↑)
- 가중치
  - 감독 내부: w_r=0.5, w_l=0.3, w_q=0.2
  - 최종: α=0.5, β=0.35, γ=0.15

## 콜드 스타트/희소성
- 사용자 데이터 부족: S_dir=0 처리 → WR+장르로 추천
- 영화 표본 부족: m↑로 수축 강화, 과대평가 방지
- 감독 정보 없음: “미상” 그룹으로 묶어 영향 최소화

## 다양성(선택)
- MMR = λ·rel − (1−λ)·max_sim
  - rel: 최종 점수, sim: 장르 자카드/감독 동일 여부
  - λ≈0.7

## 평가
- 오프라인: 최근 상호작용 홀드아웃 → Hit@K, nDCG@K, MAP
- 온라인(A/B): CTR, 좋아요율, 모달 오픈율, 체류/시청시간
- 민감도: c, m, α/β/γ, z 스윕

## 구현 위치
- 추천 엔진: `movie-app/src/utils/recommendations.ts`
- 호출/렌더: `movie-app/src/screens/MovieScreen.tsx`
- 타입/메타: `movie-app/src/types.ts`
- 상세뷰 감독 표기: `movie-app/src/components/MovieDetailModal.tsx`

## 예시 TypeScript 스니펫
```ts
// 핵심 유틸
function wilsonLowerBound(likes: number, seen: number, z = 1.2816) { /* ... */ }
function imdbWeightedRating(R?: number, v?: number, C = 6.5, m = 150) { /* ... */ }

// 감독 점수 결합(수축·정규화 포함)
const W = { rating: 0.5, like: 0.3, quality: 0.2 } as const;
function directorScore({ r, wlb, q }: { r: number; wlb: number; q: number }) {
  return W.rating * r + W.like * wlb + W.quality * q;
}

// 최종 영화 점수
const WEIGHT = { director: 0.5, quality: 0.35, genre: 0.15 } as const;
function finalScore(sDir: number, wrNorm: number, genreAff: number) {
  return WEIGHT.director * sDir + WEIGHT.quality * wrNorm + WEIGHT.genre * genreAff;
}
```

## 운영 팁
- 전역 통계/WR: 일배치
- 사용자 선호: 이벤트 기반 갱신(좋아요/리뷰 시)
- 탐색 5~10% 삽입(ε-greedy/Thompson)
- 장르/감독 키 표준화(케이싱/동의어)

