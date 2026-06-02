import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const MainPage = () => {
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'external'
  const [selectedOwner, setSelectedOwner] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [displayedRepos, setDisplayedRepos] = useState([]);
  const [selectedRepoUrl, setSelectedRepoUrl] = useState('');
  const [isFetchingExternal, setIsFetchingExternal] = useState(false);

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

  // 내 리포지토리 목록을 owner 기준으로 그룹화
  const myProjects = useMemo(() => {
    const groups = {};
    userRepos.forEach(repo => {
      const fullName = repo.full_name || repo.name || "";
      const parts = fullName.split('/');
      const owner = parts[0];
      const name = parts.length > 1 ? parts.slice(1).join('/') : fullName;
      
      if (owner) {
        if (!groups[owner]) groups[owner] = [];
        groups[owner].push({
          name: fullName,
          repo_name: name,
          url: repo.html_url || repo.url
        });
      }
    });
    return groups;
  }, [userRepos]);

  const fetchUserRepos = async (userId) => {
    try {
      // Axios를 사용하여 직접 백엔드 API에서 사용자의 리포지토리 목록 호출
      const response = await axios.get(`http://3.39.190.222:5000/api/users/${userId}/repos`);
      if (response.data && response.data.repos) {
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

  // 선택된 탭이나 오너(Owner)가 바뀔 때 표시할 리포지토리 목록 갱신
  useEffect(() => {
    if (activeTab === 'my' && selectedOwner && myProjects[selectedOwner]) {
      setDisplayedRepos(myProjects[selectedOwner]);
      setSelectedRepoUrl(''); // 명시적 선택 유도를 위해 빈값 초기화
    } else if (activeTab === 'my') {
      setDisplayedRepos([]);
      setSelectedRepoUrl('');
    }
  }, [activeTab, selectedOwner, myProjects]);

  // 데이터 로드 시 기본 오너 선택
  useEffect(() => {
    if (activeTab === 'my' && !selectedOwner && Object.keys(myProjects).length > 0) {
      setSelectedOwner(Object.keys(myProjects)[0]);
    }
  }, [myProjects, activeTab, selectedOwner]);

  const handleFetchExternalRepos = async () => {
    if (!externalUrl.trim()) return alert('GitHub 프로젝트 또는 리포지토리 URL을 입력해주세요.');
    try {
      setIsFetchingExternal(true);
      setDisplayedRepos([]);
      setSelectedRepoUrl('');

      const response = await axios.post('http://3.39.190.222:5000/api/github/owner-repos', {
        owner_url: externalUrl.trim()
      });

      if (response.data && response.data.repos) {
        setDisplayedRepos(response.data.repos);
        // 응답에 선택된 리포지토리가 있으면 자동 선택
        const autoSelected = response.data.repos.find(r => r.selected);
        if (autoSelected) {
          setSelectedRepoUrl(autoSelected.url);
        }
      }
    } catch (error) {
      console.error("외부 리포지토리 목록을 가져오는데 실패했습니다:", error);
      alert('리포지토리를 불러오는데 실패했습니다. URL을 확인해주세요.');
    } finally {
      setIsFetchingExternal(false);
    }
  };

  const handleLogin = () => {
    // 백엔드 인증 페이지로 이동
    window.location.href = 'http://3.39.190.222:5000/api/auth/github';
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRepos([]);
    setActiveTab('my');
    setSelectedOwner('');
    setExternalUrl('');
    setDisplayedRepos([]);
    setSelectedRepoUrl('');
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

  const handleDeleteHistory = (e, id, url, date) => {
    e.stopPropagation(); // 부모 div의 클릭 이벤트(페이지 이동)가 발생하지 않도록 방지
    if (window.confirm('이 분석 기록을 삭제하시겠습니까?')) {
      setHistory(prevHistory => prevHistory.filter(item => {
        // 고유 ID가 있으면 ID로 비교하고, 없으면(기존 데이터) URL과 날짜 조합으로 비교하여 삭제합니다.
        if (item.id && id) return item.id !== id;
        return !(item.url === url && item.date === date);
      }));
    }
  };

  const handleStartAnalysis = () => {
    if (!isLoggedIn) {
      return alert('분석을 진행하려면 먼저 GitHub로 로그인해주세요.');
    }
    if (!selectedRepoUrl) return alert('연결된 리포지토리를 선택해주세요.');

    // 분석 기록 저장은 LoadingPage에서 완료 시점에 처리되므로 여기서는 제거합니다.
    goToAnalysis(selectedRepoUrl);
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
              <div className="project-selection-area" style={{ textAlign: 'left' }}>
                <div style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '8px', marginBottom: '25px', fontSize: '0.95rem', fontWeight: '500' }}>
                  ✓ GitHub 계정이 연결되었습니다.
                </div>
                
                <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', color: '#1e293b', fontWeight: '700' }}>분석할 프로젝트 선택</h2>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <button onClick={() => setActiveTab('my')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: activeTab === 'my' ? '2px solid #4f46e5' : '1px solid #cbd5e1', backgroundColor: activeTab === 'my' ? '#eef2ff' : '#ffffff', color: activeTab === 'my' ? '#4f46e5' : '#64748b', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                    내 GitHub 프로젝트
                  </button>
                  <button onClick={() => setActiveTab('external')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: activeTab === 'external' ? '2px solid #4f46e5' : '1px solid #cbd5e1', backgroundColor: activeTab === 'external' ? '#eef2ff' : '#ffffff', color: activeTab === 'external' ? '#4f46e5' : '#64748b', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}>
                    외부 public 프로젝트 불러오기
                  </button>
                </div>

                <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {activeTab === 'my' ? (
                    <div>
                      <label htmlFor="owner-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>내 GitHub 프로젝트</label>
                      <select id="owner-select" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)} style={{ padding: '12px', width: '100%', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}>
                        <option value="">-- 프로젝트 선택 --</option>
                        {Object.keys(myProjects).map(owner => (
                          <option key={owner} value={owner}>{owner}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>외부 public 프로젝트 URL</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="text" placeholder="https://github.com/owner 또는 owner/repo" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }} />
                        <button onClick={handleFetchExternalRepos} disabled={isFetchingExternal} style={{ padding: '12px 20px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: isFetchingExternal ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                          {isFetchingExternal ? '불러오는 중...' : '리포지토리 불러오기'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>연결된 GitHub 리포지토리</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <select value={selectedRepoUrl} onChange={(e) => setSelectedRepoUrl(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}>
                      <option value="">-- 분석할 리포지토리 선택 --</option>
                      {displayedRepos.map((repo, idx) => (
                        <option key={idx} value={repo.url}>{repo.repo_name || repo.name}</option>
                      ))}
                    </select>
                    <button onClick={handleStartAnalysis} style={{ padding: '12px 30px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      분석 시작
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0' }}>
                <button className="github-login-btn" onClick={handleLogin} style={{ padding: '14px 28px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '600', cursor: 'pointer', width: '100%', transition: 'background 0.2s' }}>
                  GitHub로 로그인하여 시작하기
                </button>
                <p style={{ marginTop: '20px', color: '#64748b', fontSize: '0.95rem' }}>로그인 후 내 프로젝트를 선택하거나 외부 프로젝트를 불러올 수 있습니다.</p>
              </div>
            )}
          </div>
        </div>

        {isLoggedIn && history.length > 0 && (
          <div className="history-section" style={{ marginTop: '40px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#475569', marginBottom: '15px', fontWeight: '600' }}>최근 분석 기록</h3>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              {history.map((item, idx) => (
                <div 
                  key={item.id || idx} 
                  onClick={() => {
                    if (item.projectId) {
                      navigate('/dashboard', { state: { projectId: item.projectId, repoUrl: item.url } });
                    } else {
                      navigate('/loading', { state: { repoUrl: item.url } });
                    }
                  }}
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
                    onClick={(e) => handleDeleteHistory(e, item.id, item.url, item.date)}
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