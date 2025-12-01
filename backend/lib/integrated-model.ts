import { Movie, Review } from "./types";

// 논문에서 제시한 하이퍼파라미터 (4.1 실험 환경 참조)
const CONSTANTS = {
  K: 40, // 잠재 요인 벡터 차원 수
  GAMMA1: 0.002, // 학습률 (Biases)
  GAMMA2: 0.001, // 학습률 (Factors)
  GAMMA3: 0.001, // 학습률 (Implicit Weights)
  GAMMA4: 0.003, // 학습률 (Content Weights)
  LAMBDA: 0.002, // 정규화 계수 (과적합 방지)
  EPOCHS: 20, // 학습 반복 횟수 (실시간성을 위해 적절히 조정)
};

type Vector = Float32Array;

// 벡터 연산 헬퍼
const vecDot = (v1: Vector, v2: Vector): number => {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) sum += v1[i] * v2[i];
  return sum;
};

const vecAdd = (v1: Vector, v2: Vector, scale: number = 1): void => {
  for (let i = 0; i < v1.length; i++) v1[i] += v2[i] * scale;
};

const initVec = (size: number): Vector => {
  const v = new Float32Array(size);
  for (let i = 0; i < size; i++) v[i] = (Math.random() - 0.5) * 0.1;
  return v;
};

export class IntegratedRecommendationModel {
  // Model Parameters (논문 수식 14 참조)
  // b_u, b_i: 편향
  // M_j: 영화 잠재 벡터 (Item Latent Vector)
  // S_i: 사용자 명시적 잠재 벡터 (User Explicit Vector)
  // W_j: 영화 암묵적 영향 벡터 (Item Implicit Weight)
  // Y_i: 사용자 콘텐츠 선호 벡터 (User Content Preference)
  // H_c: 콘텐츠 속성 벡터 (Content Feature Vector)

  private userBias: Map<number, number> = new Map();
  private itemBias: Map<number, number> = new Map();
  private globalBias: number = 0;

  private M: Map<number, Vector> = new Map();
  private S: Map<number, Vector> = new Map();
  private W: Map<number, Vector> = new Map();
  private Y: Map<number, Vector> = new Map();
  private H: Map<string, Vector> = new Map(); // Content ID (Genre, Director, Actor) -> Vector

  private trained = false;

  // 데이터 캐시
  private userImplicitSet: Map<number, number[]> = new Map(); // N(i)
  private movieContentSet: Map<number, string[]> = new Map(); // R(j)

  constructor() {}

  // 1. 데이터 전처리 및 초기화
  public initialize(
    movies: Movie[],
    reviews: Review[],
    likes: { userId: number; movieId: number }[]
  ) {
    this.globalBias =
      reviews.reduce((sum, r) => sum + r.rating, 0) / (reviews.length || 1);

    // 1-1. 사용자 Implicit Set N(i) 구성 (리뷰했거나 좋아요한 영화)
    const addUserInteraction = (uid: number, mid: number) => {
      if (!this.userImplicitSet.has(uid)) this.userImplicitSet.set(uid, []);
      const set = this.userImplicitSet.get(uid)!;
      if (!set.includes(mid)) set.push(mid);
    };

    reviews.forEach((r) => addUserInteraction(r.userId, r.movieId));
    likes.forEach((l) => addUserInteraction(l.userId, l.movieId));

    // 1-2. 영화 Content Set R(j) 구성 (장르, 감독, 배우)
    movies.forEach((m) => {
      const contents: string[] = [];
      // 장르 (prefix: g_)
      m.genres.forEach((g) => contents.push(`g_${g}`));
      // 감독 (prefix: d_)
      if (m.director && m.director !== "미상") contents.push(`d_${m.director}`);
      // 배우 (prefix: a_, 상위 3명만 사용)
      m.cast?.slice(0, 3).forEach((c) => contents.push(`a_${c.id}`));

      this.movieContentSet.set(m.id, contents);

      // 영화 관련 벡터 초기화
      if (!this.itemBias.has(m.id)) this.itemBias.set(m.id, 0);
      if (!this.M.has(m.id)) this.M.set(m.id, initVec(CONSTANTS.K));
      if (!this.W.has(m.id)) this.W.set(m.id, initVec(CONSTANTS.K));

      // 콘텐츠 벡터 초기화
      contents.forEach((c) => {
        if (!this.H.has(c)) this.H.set(c, initVec(CONSTANTS.K));
      });
    });

    // 1-3. 사용자 관련 벡터 초기화
    this.userImplicitSet.forEach((_, uid) => {
      if (!this.userBias.has(uid)) this.userBias.set(uid, 0);
      if (!this.S.has(uid)) this.S.set(uid, initVec(CONSTANTS.K));
      if (!this.Y.has(uid)) this.Y.set(uid, initVec(CONSTANTS.K));
    });
  }

  // 2. 학습 (SGD)
  public train(reviews: Review[]) {
    if (reviews.length === 0) return;
    console.log(`[IntegratedModel] Start training... (${reviews.length} reviews)`);

    for (let epoch = 0; epoch < CONSTANTS.EPOCHS; epoch++) {
      let totalError = 0;

      // 각 평점 데이터에 대해 학습
      for (const review of reviews) {
        const u = review.userId;
        const i = review.movieId;
        const r_ui = review.rating;

        // 필요한 데이터가 없으면 스킵
        if (!this.M.has(i) || !this.S.has(u)) continue;

        // --- 전처리 계산 ---
        
        // Implicit Feedback Sum: sum_{k in N(u)} W_k
        const Nu = this.userImplicitSet.get(u) || [];
        const sqrtNu = Math.sqrt(Nu.length) || 1;
        const sumW = new Float32Array(CONSTANTS.K);
        for (const k of Nu) {
          const Wk = this.W.get(k);
          if (Wk) vecAdd(sumW, Wk);
        }
        // Normalize
        for (let k = 0; k < CONSTANTS.K; k++) sumW[k] /= sqrtNu;

        // Content Feature Sum: sum_{c in R(i)} H_c
        const Ri = this.movieContentSet.get(i) || [];
        const sqrtRi = Math.sqrt(Ri.length) || 1;
        const sumH = new Float32Array(CONSTANTS.K);
        for (const c of Ri) {
          const Hc = this.H.get(c);
          if (Hc) vecAdd(sumH, Hc);
        }
        // Normalize
        for (let k = 0; k < CONSTANTS.K; k++) sumH[k] /= sqrtRi;

        // --- 예측 평점 계산 (식 14) ---
        // p_u = S_u + sumW
        const p_u = new Float32Array(CONSTANTS.K);
        const Su = this.S.get(u)!;
        const Yu = this.Y.get(u)!;
        for (let k = 0; k < CONSTANTS.K; k++) p_u[k] = Su[k] + sumW[k];

        const Mi = this.M.get(i)!;
        
        const bu = this.userBias.get(u) || 0;
        const bi = this.itemBias.get(i) || 0;

        // Prediction = mu + bu + bi + (Yu . sumH) + (Mi . p_u)
        const pred = this.globalBias + bu + bi + vecDot(Yu, sumH) + vecDot(Mi, p_u);
        const error = r_ui - pred;
        totalError += error * error;

        // --- 파라미터 업데이트 (식 8 & 15 변형) ---
        
        // Update Biases
        this.userBias.set(u, bu + CONSTANTS.GAMMA1 * (error - CONSTANTS.LAMBDA * bu));
        this.itemBias.set(i, bi + CONSTANTS.GAMMA1 * (error - CONSTANTS.LAMBDA * bi));

        // Update User Vectors (Yu, Su)
        // Yu <- Yu + gamma * (error * sumH - lambda * Yu)
        for (let k = 0; k < CONSTANTS.K; k++) {
          const oldYu = Yu[k];
          Yu[k] += CONSTANTS.GAMMA2 * (error * sumH[k] - CONSTANTS.LAMBDA * oldYu);
        }

        // Su <- Su + gamma * (error * Mi - lambda * Su)
        for (let k = 0; k < CONSTANTS.K; k++) {
          const oldSu = Su[k];
          Su[k] += CONSTANTS.GAMMA2 * (error * Mi[k] - CONSTANTS.LAMBDA * oldSu);
        }

        // Update Item Vector (Mi)
        // Mi <- Mi + gamma * (error * p_u - lambda * Mi)
        for (let k = 0; k < CONSTANTS.K; k++) {
          const oldMi = Mi[k];
          Mi[k] += CONSTANTS.GAMMA2 * (error * p_u[k] - CONSTANTS.LAMBDA * oldMi);
        }

        // Update Implicit Weights (W_j for j in N(u))
        const wStep = error * (1 / sqrtNu); // 공통 계산 부분
        for (const j of Nu) {
          const Wj = this.W.get(j);
          if (!Wj) continue;
          for (let k = 0; k < CONSTANTS.K; k++) {
            // Wj <- Wj + gamma * (error * |N(u)|^-0.5 * Mi - lambda * Wj)
            // 주의: 논문에서는 Mi를 곱하는데, 여기서는 업데이트 전의 Mi여야 정확하지만 SGD 특성상 근사함
            Wj[k] += CONSTANTS.GAMMA3 * (wStep * Mi[k] - CONSTANTS.LAMBDA * Wj[k]);
          }
        }

        // Update Content Weights (H_c for c in R(i))
        const hStep = error * (1 / sqrtRi);
        for (const c of Ri) {
          const Hc = this.H.get(c);
          if (!Hc) continue;
          for (let k = 0; k < CONSTANTS.K; k++) {
            // Hc <- Hc + gamma * (error * |R(i)|^-0.5 * Yu - lambda * Hc)
            Hc[k] += CONSTANTS.GAMMA4 * (hStep * Yu[k] - CONSTANTS.LAMBDA * Hc[k]);
          }
        }
      }
    }
    this.trained = true;
    console.log("[IntegratedModel] Training completed.");
  }

  // 3. 예측 (Prediction)
  public predict(userId: number, movieId: number): number {
    if (!this.trained) return this.globalBias;

    const bu = this.userBias.get(userId) || 0;
    const bi = this.itemBias.get(movieId) || 0;
    
    // 콜드 스타트 처리 (기존 SVD++과 달리 콘텐츠 정보가 있으므로 예측 가능)
    const Yu = this.Y.get(userId) || new Float32Array(CONSTANTS.K); 
    const Su = this.S.get(userId) || new Float32Array(CONSTANTS.K);
    const Mi = this.M.get(movieId) || new Float32Array(CONSTANTS.K);

    // Implicit Sum
    const Nu = this.userImplicitSet.get(userId) || [];
    const sqrtNu = Math.sqrt(Nu.length) || 1;
    const sumW = new Float32Array(CONSTANTS.K);
    for (const k of Nu) {
      const Wk = this.W.get(k);
      if (Wk) vecAdd(sumW, Wk);
    }
    for (let k = 0; k < CONSTANTS.K; k++) sumW[k] /= sqrtNu;

    // Content Sum
    const Ri = this.movieContentSet.get(movieId) || [];
    const sqrtRi = Math.sqrt(Ri.length) || 1;
    const sumH = new Float32Array(CONSTANTS.K);
    for (const c of Ri) {
      const Hc = this.H.get(c);
      if (Hc) vecAdd(sumH, Hc);
    }
    for (let k = 0; k < CONSTANTS.K; k++) sumH[k] /= sqrtRi;

    // p_u = Su + sumW
    const p_u = new Float32Array(CONSTANTS.K);
    for(let k=0; k<CONSTANTS.K; k++) p_u[k] = Su[k] + sumW[k];

    const dotContent = vecDot(Yu, sumH);
    const dotCollab = vecDot(Mi, p_u);

    let score = this.globalBias + bu + bi + dotContent + dotCollab;

    // 점수 범위 클리핑 (1~10)
    return Math.max(1, Math.min(10, score));
  }
}

// 싱글톤 인스턴스 (메모리 상주)
export const recommendationModel = new IntegratedRecommendationModel();