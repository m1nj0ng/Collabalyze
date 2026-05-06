import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const LoadingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const repoUrl = location.state?.repoUrl;

  useEffect(() => {
    // 3초 후 대시보드로 이동 (데이터를 분석하는 척하는 연출)
    const timer = setTimeout(() => {
      navigate('/dashboard');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

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
        <h2 style={{ fontSize: '1.5rem', color: '#1e293b', marginBottom: '15px', fontWeight: '700' }}>데이터 분석 중</h2>
        <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '30px' }}>
          GitHub 리포지토리의 커밋 히스토리와 <br />협업 패턴을 분석하여 인사이트를 도출하고 있습니다.
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