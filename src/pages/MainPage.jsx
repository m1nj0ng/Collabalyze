import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserRepos } from '../api/client';

const MainPage = () => {
  const [repoUrl, setRepoUrl] = useState('');
  // 상태를 localStorage에서 초기화하거나 기본값으로 설정
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    // isLoggedIn 키 대신 실제 데이터인 user_id가 있는지로 판단하는 것이 더 정확합니다.
    return !!localStorage.getItem('user_id');
  });
  const [userRepos, setUserRepos] = useState(() => {
    const savedUserRepos = localStorage.getItem('userRepos');
    return savedUserRepos ? JSON.parse(savedUserRepos) : [];
  });
  const [history, setHistory] = useState(() => {
    const savedHistory = localStorage.getItem('analysisHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const navigate = useNavigate();

  // 컴포넌트 마운트 시 URL 파라미터 확인 (소셜 로그인 후 복귀 처리)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("user_id");
    const githubId = params.get("github_id");
    const profileImage = params.get("profile_image");

    if (userId) {
      localStorage.setItem("user_id", userId);
      if (githubId) localStorage.setItem("github_id", githubId);
      if (profileImage) localStorage.setItem("profile_image", profileImage);
      
      setIsLoggedIn(true);
      
      // URL 정리
      window.history.replaceState({}, document.title, "/");
      
      // 로그인 성공 후 레포지토리 목록 가져오기
      fetchUserRepos(userId);
    } else if (isLoggedIn) {
      // 이미 로그인 상태라면 로컬 저장소의 ID로 레포지토리 갱신
      const savedUserId = localStorage.getItem("user_id");
      if (savedUserId) fetchUserRepos(savedUserId);
    }
  }, []);

  const fetchUserRepos = async (userId) => {
    try {
      const response = await getUserRepos(userId);
      if (response.data.status === 'success') {
        setUserRepos(response.data.repos);
      }
    } catch (error) {
      console.error("레포지토리 목록을 가져오는데 실패했습니다:", error);
      if (error.response?.status === 401) handleLogout();
    }
  };

  // isLoggedIn 상태가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  // userRepos 상태가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('userRepos', JSON.stringify(userRepos));
  }, [userRepos]);

  // history 상태가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('analysisHistory', JSON.stringify(history));
  }, [history]);

  const handleLogin = () => {
    // 백엔드 인증 페이지로 이동
    // 상대 경로를 사용하면 Vercel 프록시를 통해 전달될 수 있습니다.
    window.location.href = '/api/auth/github';
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRepos([]);
    // 분석 기록(history)은 초기화하지 않고 유지합니다.
    // 전체 삭제(clear) 대신 인증 및 유저 정보만 선택적으로 삭제합니다.
    localStorage.removeItem('user_id');
    localStorage.removeItem('github_id');
    localStorage.removeItem('profile_image');
    localStorage.removeItem('userRepos');
    alert('로그아웃 되었습니다.');
  };

  const goToAnalysis = (url) => {
    navigate('/loading', { state: { repoUrl: url } });
  };

  const handleDeleteHistory = (e, url) => {
    e.stopPropagation(); // 부모 div의 클릭 이벤트(페이지 이동)가 발생하지 않도록 방지
    if (window.confirm('이 분석 기록을 삭제하시겠습니까?')) {
      setHistory(prevHistory => prevHistory.filter(item => item.url !== url));
    }
  };

  const handleStartAnalysis = () => {
    if (!isLoggedIn) {
      return alert('분석을 진행하려면 먼저 GitHub로 로그인해주세요.');
    }
    if (!repoUrl) return alert('리포지토리를 선택하거나 URL을 입력해주세요.');

    // 분석 시작 시 현재 리포지토리를 최근 분석 기록에 추가
    const newHistoryItem = {
      name: repoUrl.split('/').pop(), // URL에서 리포지토리 이름 추출
      url: repoUrl,
      date: new Date().toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true // 오전/오후 표시로 가독성 향상
      }), 
    };

    // 이미 기록에 있는 항목이라면 제거하고, 새로운 항목을 가장 최근으로 추가
    setHistory(prevHistory => {
      const filteredHistory = prevHistory.filter(item => item.url !== repoUrl);
      // 최대 5개 정도의 기록만 유지하도록 제한할 수도 있습니다. (예: .slice(0, 4))
      return [newHistoryItem, ...filteredHistory];
    });
    goToAnalysis(repoUrl);
  };

  return (
    <div className="main-container" style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer', fontSize: '3rem', fontWeight: '800', color: '#1e293b', marginBottom: '10px', letterSpacing: '-0.025em' }}>Collabalyze</h1>
          {isLoggedIn && (
            <button onClick={handleLogout} style={{ marginTop: '20px', padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
              로그아웃
            </button>
          )}
        </header>

        <div style={{ backgroundColor: '#ffffff', padding: '40px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
          <div className="login-section" style={{ textAlign: 'center' }}>
            {isLoggedIn ? (
              <div className="repo-selection-area">
                <div style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '25px', fontSize: '0.95rem', fontWeight: '500' }}>
                  ✓ GitHub 계정이 연결되었습니다.
                </div>
                <div style={{ textAlign: 'left', marginBottom: '25px' }}>
                  <label htmlFor="repo-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>내 리포지토리 선택</label>
                  <select 
                    id="repo-select"
                    value={repoUrl} 
                    onChange={(e) => setRepoUrl(e.target.value)}
                    style={{ padding: '12px', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}
                  >
                    <option value="">-- 분석할 리포지토리 선택 --</option>
                    {userRepos.map((repo, idx) => (
                      <option key={idx} value={repo.url}>{repo.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <button className="github-login-btn" onClick={handleLogin} style={{ padding: '14px 28px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', width: '100%', transition: 'background 0.2s' }}>
                GitHub로 로그인하여 시작하기
              </button>
            )}
          </div>

          <div className="input-section" style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid #f1f5f9' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>URL 입력</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="https://github.com/username/repo" 
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
              />
              <button onClick={handleStartAnalysis} style={{ padding: '12px 24px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>
                분석 시작
              </button>
            </div>
          </div>
        </div>

        {isLoggedIn && history.length > 0 && (
          <div className="history-section" style={{ marginTop: '40px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '15px', fontWeight: '600' }}>최근 분석 기록</h3>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {history.map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => navigate('/dashboard', { state: { repoUrl: item.url, fromHistory: true } })}
                  style={{ 
                    padding: '16px 20px', 
                    borderBottom: idx === history.length - 1 ? 'none' : '1px solid #f1f5f9', 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ color: '#4f46e5', fontWeight: '600' }}>{item.name}</span>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{item.date}</span>
                  </div>
                  <button 
                    onClick={(e) => handleDeleteHistory(e, item.url)}
                    style={{ 
                      padding: '6px 10px', 
                      backgroundColor: 'transparent', 
                      color: '#94a3b8', 
                      border: 'none', 
                      borderRadius: '4px', 
                      fontSize: '0.8rem', 
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainPage;
