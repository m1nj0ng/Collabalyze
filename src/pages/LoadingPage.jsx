import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const LoadingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const repoUrl = location.state?.repoUrl;

  const [statusMessage, setStatusMessage] = useState('프로젝트 생성 중...');
  const [error, setError] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [projectId, setProjectId] = useState(null);

  // React StrictMode로 인해 useEffect가 두 번 실행되어 API가 중복 호출되는 것을 방지
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!repoUrl) {
      setError('분석할 리포지토리 URL이 없습니다.');
      return;
    }

    if (hasStarted.current) return; // 이미 API 호출이 시작되었다면 중복 실행 방지
    hasStarted.current = true;

    const startAnalysis = async () => {
      try {
        setStatusMessage('프로젝트 생성 중...');
        // 1. 프로젝트 생성 API
        const projectRes = await axios.post('http://3.39.190.222:5000/api/projects', { repo_url: repoUrl });
        const pid = projectRes.data.project_id;
        setProjectId(pid);

        setStatusMessage('데이터 수집 작업 등록 중...');
        // 2. 데이터 수집 시작 API
        const collectRes = await axios.post(`http://3.39.190.222:5000/api/projects/${pid}/collect`);
        setTaskId(collectRes.data.task_id);
      } catch (err) {
        setError('API 요청 중 오류가 발생했습니다.');
      }
    };

    startAnalysis();
  }, [repoUrl]);

  // 3. 작업 상태 Polling (재귀적 setTimeout 사용)
  useEffect(() => {
    if (!taskId || !projectId) return;

    let isMounted = true;
    let pollTimer = null;

    const pollStatus = async () => {
      if (!isMounted) return;
      try {
        const statusRes = await axios.get(`http://3.39.190.222:5000/api/projects/tasks/${taskId}`);
        const state = statusRes.data.state;

        if (state === 'PENDING' || state === 'STARTED') {
          setStatusMessage('GitHub 데이터 수집 중...');
          pollTimer = setTimeout(pollStatus, 3000); // 3초 뒤 다시 호출
        } else if (state === 'SUCCESS') {
          // 작업 중 에러 발생 여부 확인
          if (statusRes.data.result && statusRes.data.result.error) {
            if (isMounted) setError(`데이터 수집 중 오류가 발생했습니다: ${statusRes.data.result.error}`);
            return;
          }

          // 4. 완료 시 로컬 스토리지에 분석 기록 저장 및 Dashboard로 리다이렉트
          const savedHistory = JSON.parse(localStorage.getItem('analysisHistory') || '[]');
          const newHistoryId = Date.now();
          const newHistoryItem = {
            id: newHistoryId,
            projectId: projectId, // 이 프로젝트 ID를 통해 과거 기록을 바로 조회합니다.
            name: repoUrl.split('/').pop(),
            url: repoUrl,
            date: new Date().toLocaleString('ko-KR', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            })
          };

          const newHistoryList = [newHistoryItem, ...savedHistory];
          // 30개를 초과하는 오래된 기록의 스냅샷 캐시 데이터 삭제
          if (newHistoryList.length > 30) {
            const removedItems = newHistoryList.slice(30);
            removedItems.forEach(item => localStorage.removeItem(`snapshot_${item.id}`));
          }
          
          localStorage.setItem('analysisHistory', JSON.stringify(newHistoryList.slice(0, 30)));

          if (isMounted) {
            navigate('/dashboard', { state: { projectId, repoUrl, historyId: newHistoryId } });
          }
        } else if (state === 'FAILURE') {
          if (isMounted) setError('데이터 수집에 실패했습니다 (상태: FAILURE).');
        } else {
          pollTimer = setTimeout(pollStatus, 3000);
        }
      } catch (err) {
        if (isMounted) setError('작업 상태 조회 중 오류가 발생했습니다.');
      }
    };

    pollStatus(); // 첫 상태 확인 시작

    return () => {
      isMounted = false; // 컴포넌트 언마운트 시 메모리 누수 방지
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [taskId, projectId, repoUrl, navigate]);

  return (
    <div className="loading-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', fontFamily: '"Inter", sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#ffffff', padding: '50px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
        <div className="spinner-box" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
          <h2 style={{ fontSize: '1.5rem', color: error ? '#ef4444' : '#1e293b', marginBottom: '15px', fontWeight: '700' }}>
            {error ? '분석 실패' : '데이터 분석 중'}
          </h2>
        <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '30px' }}>
            {error ? error : statusMessage}
        </p>
        {repoUrl && (
          <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem', color: '#4f46e5', fontWeight: '600', marginBottom: '30px', wordBreak: 'break-all' }}>
            {repoUrl}
          </div>
        )}
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}>
          분석 취소 및 홈으로
        </button>
      </div>
    </div>
  );
};

export default LoadingPage;