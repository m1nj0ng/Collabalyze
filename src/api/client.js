import axios from 'axios';

// Flask 서버의 기본 URL 설정 (로컬 개발 환경 기준)
const API_BASE_URL = 'http://localhost:5000/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 응답 인터셉터 (에러 처리 등을 중앙화하기 위해 사용)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// 데이터 요청 함수 예시
// 분석 시작 요청
export const startAnalysis = async (repoUrl) => {
  return client.post('/analyze', { repo_url: repoUrl });
};

// 분석 상태 및 결과 조회
export const getAnalysisResult = async (analysisId) => {
  return client.get(`/result/${analysisId}`);
};

// 특정 사용자 상세 데이터 조회
export const getUserDetail = async (userId) => {
  return client.get(`/detail/${userId}`);
};

export default client;