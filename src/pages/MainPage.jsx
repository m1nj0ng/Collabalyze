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
  const [searchQuery, setSearchQuery] = useState('');

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
  const [externalHistory, setExternalHistory] = useState(() => {
    const savedExternal = localStorage.getItem('externalHistory');
    return savedExternal ? JSON.parse(savedExternal) : [];
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
          url: repo.html_url || repo.url,
          description: repo.description,
          private: repo.private
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

  // externalHistory 상태가 변경될 때마다 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('externalHistory', JSON.stringify(externalHistory));
  }, [externalHistory]);

  // 선택된 탭이나 오너(Owner)가 바뀔 때 표시할 리포지토리 목록 갱신
  useEffect(() => {
    if (activeTab === 'my' && selectedOwner && myProjects[selectedOwner]) {
      setDisplayedRepos(myProjects[selectedOwner]);
      setSelectedRepoUrl(''); // 명시적 선택 유도를 위해 빈값 초기화
      setSearchQuery(''); // 탭 이동 시 검색어 초기화
    } else if (activeTab === 'my') {
      setDisplayedRepos([]);
      setSelectedRepoUrl('');
      setSearchQuery('');
    }
  }, [activeTab, selectedOwner, myProjects]);

  // 데이터 로드 시 기본 오너 선택
  useEffect(() => {
    if (activeTab === 'my' && !selectedOwner && Object.keys(myProjects).length > 0) {
      setSelectedOwner(Object.keys(myProjects)[0]);
    }
  }, [myProjects, activeTab, selectedOwner]);

  const handleFetchExternalRepos = async (urlToFetch) => {
    const targetUrl = typeof urlToFetch === 'string' ? urlToFetch.trim() : externalUrl.trim();
    if (!targetUrl) return alert('GitHub 프로젝트 또는 리포지토리 URL을 입력해주세요.');
    try {
      setIsFetchingExternal(true);
      setDisplayedRepos([]);
      setSelectedRepoUrl('');

      const response = await axios.post('http://3.39.190.222:5000/api/github/owner-repos', {
        owner_url: targetUrl
      });

      if (response.data && response.data.repos) {
        setDisplayedRepos(response.data.repos);
        // 응답에 선택된 리포지토리가 있으면 자동 선택
        const autoSelected = response.data.repos.find(r => r.selected);
        if (autoSelected) {
          setSelectedRepoUrl(autoSelected.url);
        }
        setSearchQuery('');
        setExternalUrl(targetUrl); // 입력창 동기화
        
        // 최근 검색 기록 업데이트 (중복 제거 및 최상단 배치, 최대 5개 유지)
        setExternalHistory(prev => {
          const newHistory = [targetUrl, ...prev.filter(url => url !== targetUrl)];
          return newHistory.slice(0, 5);
        });
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
    setSearchQuery('');
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

  // 검색 필터링 적용된 리포지토리 목록
  const filteredRepos = useMemo(() => {
    if (!searchQuery) return displayedRepos;
    return displayedRepos.filter(repo =>
      (repo.repo_name || repo.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [displayedRepos, searchQuery]);

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
                        <input type="text" placeholder="https://github.com/owner 또는 owner/repo" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFetchExternalRepos(externalUrl)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }} />
                        <button onClick={() => handleFetchExternalRepos(externalUrl)} disabled={isFetchingExternal} style={{ padding: '12px 20px', backgroundColor: '#1e293b', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: isFetchingExternal ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                          {isFetchingExternal ? '불러오는 중...' : '리포지토리 불러오기'}
                        </button>
                      </div>
                      
                      {externalHistory.length > 0 && (
                        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>최근 검색:</span>
                          {externalHistory.map((url, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleFetchExternalRepos(url)}
                              style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                            >
                              {url}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <label style={{ margin: 0, fontWeight: '600', color: '#334155' }}>연결된 GitHub 리포지토리 ({filteredRepos.length})</label>
                    <input type="text" placeholder="리포지토리 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none', width: '200px' }} />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px', maxHeight: '280px', overflowY: 'auto', padding: '4px' }}>
                    {filteredRepos.length > 0 ? filteredRepos.map((repo, idx) => {
                      // 현재 리포지토리 URL과 일치하는 분석 기록 찾기 (history는 최신순이므로 가장 첫 번째가 최근 기록)
                      const lastAnalysis = history.find(h => h.url === repo.url);
                      
                      return (
                        <div 
                          key={idx} 
                          onClick={() => setSelectedRepoUrl(repo.url)}
                          style={{ 
                            padding: '16px', 
                            borderRadius: '10px', 
                            border: selectedRepoUrl === repo.url ? '2px solid #4f46e5' : '1px solid #e2e8f0', 
                            backgroundColor: selectedRepoUrl === repo.url ? '#eef2ff' : '#ffffff', 
                            cursor: 'pointer', 
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <strong style={{ color: '#1e293b', fontSize: '1rem', wordBreak: 'break-all', lineHeight: '1.3' }}>{repo.repo_name || repo.name}</strong>
                            {repo.private && <span style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '4px', fontWeight: 'bold' }}>Private</span>}
                          </div>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                            {repo.description || '설명이 없습니다.'}
                          </p>
                          <div style={{ marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', fontSize: '0.75rem', color: lastAnalysis ? '#4f46e5' : '#94a3b8', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {lastAnalysis ? (
                              <>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4f46e5' }}></span>
                                최근 분석: {lastAnalysis.date}
                              </>
                            ) : (
                              <>
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#cbd5e1' }}></span>
                                분석 기록 없음
                              </>
                            )}
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '30px', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                        검색 결과가 없습니다.
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleStartAnalysis} disabled={!selectedRepoUrl} style={{ padding: '12px 30px', backgroundColor: selectedRepoUrl ? '#4f46e5' : '#94a3b8', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: selectedRepoUrl ? 'pointer' : 'not-allowed', transition: 'background 0.2s', width: '100%' }}>
                      선택한 프로젝트 분석 시작
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' }}>
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
                    padding: '18px', 
                    backgroundColor: '#ffffff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <strong style={{ color: '#1e293b', fontSize: '1.05rem', wordBreak: 'break-all', lineHeight: '1.3' }}>{item.name}</strong>
                    <button 
                      onClick={(e) => handleDeleteHistory(e, item.id, item.url, item.date)}
                      style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      기록 삭제
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', wordBreak: 'break-all' }}>{item.url.replace('https://github.com/', '')}</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.date}</span>
                  </div>
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