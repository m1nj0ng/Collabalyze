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
export const fetchProjectStats = async (repoUrl) => {
  // 실제 백엔드 연동 시: return client.get(`/stats?repo=${repoUrl}`);
  // 현재는 테스트를 위해 모의 데이터 반환 코드를 주석으로 남기거나 App.jsx에서 처리
  return client.get('/stats'); 
};

export default client;