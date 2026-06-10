import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import IssueStatisticsTable from '../components/IssueStatisticsTable';

const MainPage = () => {
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'external'
  const [selectedOwner, setSelectedOwner] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [displayedRepos, setDisplayedRepos] = useState([]);
  const [selectedRepoUrl, setSelectedRepoUrl] = useState('');
  const [isFetchingExternal, setIsFetchingExternal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isJiraLinked, setIsJiraLinked] = useState(false);
  const [workspaceGoals, setWorkspaceGoals] = useState(() => {
    const saved = localStorage.getItem('workspaceGoals');
    return saved ? JSON.parse(saved) : {};
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('');

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

  // 분석 기록(history)에 로컬 스토리지에 캐시된 세부 통계(스냅샷) 데이터를 덧붙여 반환
  const historyWithStats = useMemo(() => {
    return history.map(h => {
      let stats = h.stats || null;
      if (!stats && h.id) {
        const snap = localStorage.getItem(`snapshot_${h.id}`);
        if (snap) {
          try {
            const parsed = JSON.parse(snap);
            const dData = parsed.dashboardData || [];
            if (dData.length > 0) {
              stats = {
                members: dData.length,
                commits: dData.reduce((acc, m) => acc + (m.commits || 0), 0)
              };
            }
          } catch (e) {}
        }
      }
      return { ...h, stats };
    });
  }, [history]);
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
      const myGithubId = localStorage.getItem("github_id");
      // 본인의 깃허브 아이디와 일치하는 조직이 있다면 그것을 최우선으로 선택 (목표가 안 보이는 착시 방지)
      if (myGithubId && myProjects[myGithubId]) {
        setSelectedOwner(myGithubId);
      } else {
        setSelectedOwner(Object.keys(myProjects)[0]);
      }
    }
  }, [myProjects, activeTab, selectedOwner]);

  const handleFetchExternalRepos = async (urlToFetch) => {
    const targetUrl = typeof urlToFetch === 'string' ? urlToFetch.trim() : externalUrl.trim();
    if (!targetUrl) {
      alert('GitHub 프로젝트 또는 리포지토리 URL을 입력해주세요.');
      return false;
    }
    try {
      setIsFetchingExternal(true);
      setDisplayedRepos([]);
      setSelectedRepoUrl('');

      // 입력된 URL 파싱 (https://github.com/owner/repo 형식 등)
      let cleanUrl = targetUrl.replace('https://github.com/', '').replace('.git', '');
      const parts = cleanUrl.split('/');
      const owner = parts[0];
      const repoName = parts.length >= 2 ? parts[1] : null;

      let repos = [];

      if (owner) {
        // owner(조직/유저명)를 추출하여 해당 계정의 전체 공개 레포지토리 목록 직접 조회
        const response = await axios.get(`https://api.github.com/users/${owner}/repos?sort=updated&per_page=100`);
        repos = response.data.map(repo => ({
          name: repo.full_name,
          repo_name: repo.name,
          url: repo.html_url,
          description: repo.description,
          private: repo.private
        }));
      }

      if (repos.length > 0) {
        setDisplayedRepos(repos);
        // 특정 리포지토리가 URL에 명시된 경우 목록에서 해당 리포 자동 선택
        if (repoName) {
          const exactUrl = `https://github.com/${owner}/${repoName}`;
          const matched = repos.find(r => r.url.toLowerCase() === exactUrl.toLowerCase());
          if (matched) {
            setSelectedRepoUrl(matched.url);
          } else {
            setSelectedRepoUrl(exactUrl); // API 조회 한도 초과 등으로 목록에 없더라도 강제 선택 처리
          }
        } else if (repos.length === 1) {
          setSelectedRepoUrl(repos[0].url);
        }
        setSearchQuery('');
        setExternalUrl(targetUrl); // 입력창 동기화
        
        // 최근 검색 기록 업데이트 (같은 조직(owner) 중복 제거 및 최상단 배치, 최대 15개 유지)
        setExternalHistory(prev => {
          // 기존에 저장된 URL들에서도 owner만 추출해서 비교
          const filteredPrev = prev.filter(url => {
            const prevOwner = url.replace('https://github.com/', '').replace('.git', '').split('/')[0];
            return prevOwner.toLowerCase() !== owner.toLowerCase();
          });
          const newHistory = [owner, ...filteredPrev];
          return newHistory.slice(0, 15);
        });
        return true;
      } else {
        alert('공개된 리포지토리를 찾을 수 없습니다.');
        return false;
      }
    } catch (error) {
      console.error("외부 리포지토리를 처리하는데 실패했습니다:", error);
      alert('리포지토리를 찾을 수 없습니다. URL이나 저장소 이름을 다시 확인해주세요.');
      return false;
    } finally {
      setIsFetchingExternal(false);
    }
  };

  // 모달 안에서 프로젝트 추가/조회 성공 시 리포지토리 목록 창으로 전환
  const handleFetchAndShowRepos = async (url) => {
    const success = await handleFetchExternalRepos(url);
    if (success) {
      setIsRepoModalOpen(true);
    }
  };

  // 관리 패널에서 개별 기록 삭제
  const removeExternalHistory = (urlToRemove) => {
    setExternalHistory(prev => prev.filter(url => url !== urlToRemove));
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

  const handleDeleteHistoryByUrl = (e, url) => {
    e.stopPropagation();
    if (window.confirm('이 프로젝트의 모든 분석 기록을 한 번에 삭제하시겠습니까?')) {
      setHistory(prevHistory => prevHistory.filter(item => item.url !== url));
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
    let result = displayedRepos;
    
    if (searchQuery) {
      result = result.filter(repo =>
        (repo.repo_name || repo.name).toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // 과거 분석 기록이 있는 리포지토리를 목록 상단으로 정렬
    return [...result].sort((a, b) => {
      const hasHistoryA = historyWithStats.some(h => h.url === a.url);
      const hasHistoryB = historyWithStats.some(h => h.url === b.url);
      if (hasHistoryA && !hasHistoryB) return -1;
      if (!hasHistoryA && hasHistoryB) return 1;
      return 0;
    });
  }, [displayedRepos, searchQuery, historyWithStats]);

  // 최근 분석 기록을 리포지토리 URL 기준으로 묶어서 고유하게 보여주기 위한 처리
  const groupedHistory = useMemo(() => {
    const groups = {};
    historyWithStats.forEach(item => {
      if (!groups[item.url]) {
        groups[item.url] = { ...item, count: 1, allRecords: [item] };
      } else {
        groups[item.url].count += 1;
        groups[item.url].allRecords.push(item);
      }
    });
    return Object.values(groups);
  }, [historyWithStats]);

  const currentWorkspaceKey = activeTab === 'my' ? selectedOwner : (externalUrl.split('/').pop() || 'external');

  return (
    <div className="main-container" style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '40px 20px', fontFamily: '"Inter", sans-serif' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

        /* 예쁜 커스텀 스크롤바 디자인 */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; border: 2px solid transparent; background-clip: padding-box; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #94a3b8; }
      `}</style>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer', fontSize: '3rem', fontWeight: '800', color: '#1e293b', marginBottom: '10px', letterSpacing: '-0.025em' }}>Collabalyze</h1>
          {isLoggedIn && (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={handleLogout} style={{ marginTop: '20px', padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>
                로그아웃
              </button>
            </div>
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

                {activeTab === 'my' ? (
                  <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>내 프로젝트 관리</h2>
                    
                    <div style={{ marginBottom: '25px' }}>
                      <label htmlFor="owner-select" style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>조직(계정) 선택</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <select id="owner-select" value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}>
                          <option value="">-- 조직 선택 --</option>
                          {Object.keys(myProjects).map(owner => (
                            <option key={owner} value={owner}>{owner}</option>
                          ))}
                        </select>
                        <button onClick={() => setIsRepoModalOpen(true)} disabled={!selectedOwner} style={{ padding: '12px 20px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: !selectedOwner ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                          워크스페이스 열기
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>연결된 내 조직 목록</label>
                      <div className="custom-scrollbar" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                        {Object.keys(myProjects).length > 0 ? Object.keys(myProjects).map((owner, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderBottom: idx === Object.keys(myProjects).length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '0.95rem', color: '#334155', fontWeight: '600' }}>{owner}</span>
                            <button onClick={() => { setSelectedOwner(owner); setIsRepoModalOpen(true); }} style={{ padding: '6px 12px', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                              워크스페이스 열기
                            </button>
                          </div>
                        )) : (
                          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>연결된 조직(계정)이 없습니다.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h2 style={{ margin: '0 0 20px 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: '700' }}>외부 프로젝트 관리</h2>
                    
                    <div style={{ marginBottom: '25px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>새 외부 프로젝트 검색 및 추가</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <input type="text" placeholder="https://github.com/owner 또는 owner/repo" value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFetchAndShowRepos(externalUrl)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }} />
                        <button onClick={() => handleFetchAndShowRepos(externalUrl)} disabled={isFetchingExternal} style={{ padding: '12px 20px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: isFetchingExternal ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                          {isFetchingExternal ? '확인 중...' : '워크스페이스 열기'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#334155' }}>저장된 워크스페이스 기록</label>
                      <div className="custom-scrollbar" style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#ffffff' }}>
                        {externalHistory.length > 0 ? externalHistory.map((url, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 15px', borderBottom: idx === externalHistory.length - 1 ? 'none' : '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '0.95rem', color: '#334155', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '6px', color: '#64748b', display: 'flex' }}>
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                              </span>
                              {url.replace('https://github.com/', '').replace('.git', '').split('/')[0]}
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button onClick={() => handleFetchAndShowRepos(url)} disabled={isFetchingExternal} style={{ padding: '6px 12px', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: isFetchingExternal ? 'not-allowed' : 'pointer' }}>
                                워크스페이스 열기
                              </button>
                              <button onClick={() => removeExternalHistory(url)} style={{ padding: '6px 12px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}>
                                삭제
                              </button>
                            </div>
                          </div>
                        )) : (
                          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>저장된 외부 프로젝트 기록이 없습니다.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#475569', margin: 0, fontWeight: '600' }}>최근 분석 기록 (최근 30개)</h3>
          </div>
          <div className="custom-scrollbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px', maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
              {groupedHistory.map((item, idx) => (
                <div 
                  key={item.url || idx} 
                  style={{ 
                    padding: '18px', 
                    backgroundColor: '#ffffff', 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (window.confirm(`'${item.name || '알 수 없는 프로젝트'}'의 최신 데이터를 수집하여 다시 분석하시겠습니까?`)) {
                      navigate('/loading', { state: { repoUrl: item.url } });
                    }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <strong style={{ color: '#1e293b', fontSize: '1.05rem', wordBreak: 'break-all', lineHeight: '1.3' }}>{item.name || '알 수 없는 프로젝트'}</strong>
                      {item.count > 1 && <span style={{ padding: '2px 6px', backgroundColor: '#eef2ff', color: '#4f46e5', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.count}건</span>}
                    </div>
                    <button 
                      onClick={(e) => handleDeleteHistoryByUrl(e, item.url)}
                      style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; e.currentTarget.style.color = '#b91c1c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      삭제
                    </button>
                  </div>
                  
                  <span style={{ fontSize: '0.85rem', color: '#64748b', wordBreak: 'break-all', lineHeight: '1.4' }}>{(item.url || '').replace('https://github.com/', '')}</span>
                  
                  <div className="custom-scrollbar" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', paddingRight: '4px', marginTop: '4px', cursor: 'default' }}>
                    {(item.allRecords || []).map((record, rIdx) => (
                      <div 
                        key={record.id || rIdx}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid transparent', transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c7d2fe'; e.currentTarget.style.backgroundColor = '#eef2ff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap' }}>{record.date || '날짜 없음'}</span>
                          {record.stats && (
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', color: '#64748b' }}>
                              <span>👥 {record.stats.members}명</span>
                              <span>💻 {record.stats.commits}건</span>
                            </div>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                          {rIdx === 0 && <span style={{ fontSize: '0.65rem', backgroundColor: '#4f46e5', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap', flexShrink: 0 }}>최신</span>}
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (record.projectId) {
                                navigate('/dashboard', { state: { projectId: record.projectId, repoUrl: record.url, historyId: record.id } });
                              } else {
                                navigate('/loading', { state: { repoUrl: record.url } });
                              }
                            }}
                            style={{ padding: '4px 10px', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}
                          >
                            결과 보기
                          </button>
                          <button 
                            onClick={(e) => handleDeleteHistory(e, record.id, record.url, record.date)}
                            style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 프로젝트 워크스페이스 관리 모달 */}
        {isRepoModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', animation: 'fadeIn 0.2s ease-out', backdropFilter: 'blur(4px)' }} onClick={() => { setIsRepoModalOpen(false); setIsEditingGoal(false); }}>
            <div style={{ backgroundColor: '#ffffff', padding: '0', borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', animation: 'slideUp 0.3s ease-out' }} onClick={e => e.stopPropagation()}>

              {/* 헤더 */}
              <div style={{ padding: '24px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ padding: '6px', backgroundColor: '#eef2ff', color: '#4f46e5', borderRadius: '8px', display: 'flex' }}>
                      <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    </span>
                    {activeTab === 'my' ? selectedOwner : (externalUrl.split('/').pop() || '선택한')} 워크스페이스
                  </h2>
                  <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>해당 조직(계정)의 저장소를 관리하고 분석을 진행하세요.</p>
                </div>
                <button onClick={() => { setIsRepoModalOpen(false); setIsEditingGoal(false); }} style={{ background: 'none', border: 'none', fontSize: '2rem', cursor: 'pointer', color: '#94a3b8', lineHeight: '1', padding: '0' }}>&times;</button>
              </div>

              {/* 내용 */}
              <div className="custom-scrollbar" style={{ padding: '30px', overflowY: 'auto', flex: 1, backgroundColor: '#fcfcfd' }}>
                {/* 통계 요약 대시보드 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
                  <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>총 리포지토리</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#0f172a' }}>{displayedRepos.length}<span style={{ fontSize: '1rem', color: '#94a3b8', marginLeft: '4px', fontWeight: '600' }}>개</span></div>
                  </div>
                  <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>공개(Public) 상태</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#10b981' }}>{(displayedRepos || []).filter(r => r && !r.private).length}<span style={{ fontSize: '1rem', color: '#94a3b8', marginLeft: '4px', fontWeight: '600' }}>개</span></div>
                  </div>
                  <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>과거 분석 이력</div>
                    <div style={{ fontSize: '2rem', fontWeight: '800', color: '#4f46e5' }}>{(displayedRepos || []).filter(repo => repo && (historyWithStats || []).some(h => h?.url === repo?.url)).length}<span style={{ fontSize: '1rem', color: '#94a3b8', marginLeft: '4px', fontWeight: '600' }}>개 프로젝트</span></div>
                  </div>
                </div>

                {/* 워크스페이스 목표 및 방향 */}
                <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isEditingGoal ? '10px' : '0' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      워크스페이스 목표
                    </h3>
                    {!isEditingGoal && (
                      <button 
                        onClick={() => { setTempGoal(workspaceGoals[currentWorkspaceKey] || ''); setIsEditingGoal(true); }}
                        style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      >
                        수정
                      </button>
                    )}
                  </div>
                  
                  {isEditingGoal ? (
                    <div>
                      <textarea 
                        value={tempGoal} 
                        onChange={(e) => setTempGoal(e.target.value)} 
                        placeholder="이번 스프린트의 목표나 프로젝트의 주요 방향성을 자유롭게 작성해보세요."
                        style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #4f46e5', backgroundColor: '#ffffff', fontSize: '0.95rem', outline: 'none', resize: 'vertical', fontFamily: 'inherit', color: '#0f172a', boxSizing: 'border-box', boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.15)' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                        <button onClick={() => setIsEditingGoal(false)} style={{ padding: '6px 14px', backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>취소</button>
                        <button onClick={() => { setWorkspaceGoals(prev => ({ ...prev, [currentWorkspaceKey]: tempGoal })); setIsEditingGoal(false); }} style={{ padding: '6px 14px', backgroundColor: '#4f46e5', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>저장</button>
                      </div>
                    </div>
                  ) : (
                    workspaceGoals[currentWorkspaceKey] ? (
                      <div style={{ marginTop: '15px', color: '#475569', fontSize: '0.95rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{workspaceGoals[currentWorkspaceKey]}</div>
                    ) : (
                      <div style={{ marginTop: '15px', color: '#94a3b8', fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => { setTempGoal(''); setIsEditingGoal(true); }}>아직 설정된 목표가 없습니다. 우측 상단의 '수정' 버튼을 눌러 조직의 방향성을 추가해보세요.</div>
                    )
                  )}
                </div>

                {/* 2차원 이슈 통계 필터 (더미 데이터) */}
                <div style={{ marginBottom: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: '700' }}>워크스페이스 업무 현황 (Preview)</h3>
                    <button 
                      onClick={() => setIsJiraLinked(!isJiraLinked)}
                      style={{ padding: '6px 14px', backgroundColor: isJiraLinked ? '#16a34a' : '#0052CC', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isJiraLinked ? '#15803d' : '#0047b3'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isJiraLinked ? '#16a34a' : '#0052CC'}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.53 2c0 2.39-1.89 4.34-4.25 4.34-2.35 0-4.25-1.95-4.25-4.34zm0 8.68c0 2.39-1.89 4.34-4.25 4.34-2.35 0-4.25-1.95-4.25-4.34zm8.5 0c0 2.39-1.89 4.34-4.25 4.34-2.36 0-4.25-1.95-4.25-4.34zm0 8.68c0 2.39-1.89 4.34-4.25 4.34-2.36 0-4.25-1.95-4.25-4.34z"/>
                      </svg>
                      {isJiraLinked ? 'Jira 연동 해제' : 'Jira 연동'}
                    </button>
                  </div>
                  {isJiraLinked ? (
                    <IssueStatisticsTable data={[
                      { name: 'Alice', issues: 24 },
                      { name: 'Bob', issues: 15 },
                      { name: 'Charlie', issues: 31 },
                      { name: 'Dave', issues: 8 },
                      { name: 'Eve', issues: 12 }
                    ]} />
                  ) : (
                    <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b' }}>
                      <p style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: '600', color: '#475569' }}>Jira를 연동하여 업무 현황을 불러오세요.</p>
                      <p style={{ margin: 0, fontSize: '0.85rem' }}>팀원별 구체적인 이슈 진행 상태가 이 곳에 표시됩니다.</p>
                    </div>
                  )}
                </div>

                {/* 리포지토리 리스트 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: '700' }}>대상 리포지토리 선택</h3>
                  <input type="text" placeholder="리포지토리 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none', width: '250px', backgroundColor: '#ffffff' }} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px', paddingBottom: '10px' }}>
                  {filteredRepos.length > 0 ? filteredRepos.map((repo, idx) => {
                    const lastAnalysis = (historyWithStats || []).find(h => h?.url === repo?.url);
                    return (
                      <div key={idx} onClick={() => setSelectedRepoUrl(repo.url)} style={{ padding: '20px', borderRadius: '12px', border: selectedRepoUrl === repo.url ? '2px solid #4f46e5' : '1px solid #e2e8f0', backgroundColor: selectedRepoUrl === repo.url ? '#eef2ff' : '#ffffff', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: selectedRepoUrl === repo.url ? '0 4px 6px rgba(79, 70, 229, 0.1)' : 'none', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <strong style={{ color: '#1e293b', fontSize: '1.05rem', wordBreak: 'break-all', lineHeight: '1.3' }}>{repo.repo_name || repo.name}</strong>
                          {repo.private && <span style={{ fontSize: '0.7rem', padding: '3px 8px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '12px', fontWeight: 'bold' }}>Private</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4', textAlign: 'left' }}>{repo.description || '설명이 없습니다.'}</p>
                        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px dashed #e2e8f0', fontSize: '0.8rem', color: '#64748b', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: lastAnalysis ? '#4f46e5' : '#64748b', fontWeight: '600' }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: lastAnalysis ? '#4f46e5' : '#cbd5e1' }}></span>
                            <span style={{ whiteSpace: 'nowrap' }}>{lastAnalysis ? lastAnalysis.date : '분석 기록 없음'}</span>
                          </div>
                          {lastAnalysis && lastAnalysis.stats && (
                            <div style={{ display: 'flex', gap: '8px', fontSize: '0.75rem' }}>
                              <span style={{ backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>👥 {lastAnalysis.stats.members}명</span>
                              <span style={{ backgroundColor: '#f1f5f9', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>💻 {lastAnalysis.stats.commits}건</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }) : <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#94a3b8', backgroundColor: '#f1f5f9', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>검색 결과가 없습니다.</div>}
                </div>
                
              </div>

              {/* 과거 분석 기록 */}
              {selectedRepoUrl && (historyWithStats || []).filter(h => h?.url === selectedRepoUrl).length > 0 && (
                <div style={{ padding: '0 30px 20px 30px', backgroundColor: '#fcfcfd' }}>
                  <div style={{ padding: '20px', backgroundColor: '#f1f5f9', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <h3 style={{ margin: '0 0 15px 0', fontSize: '1.05rem', color: '#334155', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      선택한 프로젝트의 과거 분석 기록 ({(historyWithStats || []).filter(h => h?.url === selectedRepoUrl).length}건)
                    </h3>
                    <div className="custom-scrollbar" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '10px' }}>
                      {(historyWithStats || []).filter(h => h?.url === selectedRepoUrl).map((item, idx) => (
                        <div 
                          key={item.id || idx} 
                          style={{ padding: '12px 16px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#4f46e5'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(79, 70, 229, 0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: '700', whiteSpace: 'nowrap' }}>{item.date}</span>
                            {item.stats ? (
                              <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: '#64748b' }}>
                                <span style={{ backgroundColor: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>👥 {item.stats.members}명</span>
                                <span style={{ backgroundColor: '#f8fafc', padding: '3px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>💻 {item.stats.commits}건</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>세부 통계 없음</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.projectId) {
                                  navigate('/dashboard', { state: { projectId: item.projectId, repoUrl: item.url, historyId: item.id } });
                                } else {
                                  navigate('/loading', { state: { repoUrl: item.url } });
                                }
                              }}
                              style={{ padding: '4px 10px', backgroundColor: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}
                            >
                              결과 보기
                            </button>
                            <button 
                              onClick={(e) => handleDeleteHistory(e, item.id, item.url, item.date)}
                              style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600', whiteSpace: 'nowrap' }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 푸터 */}
              <div style={{ padding: '20px 30px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '0.95rem' }}>
                  {selectedRepoUrl ? <span>선택됨: <strong style={{ color: '#4f46e5' }}>{selectedRepoUrl.split('/').slice(-2).join('/')}</strong></span> : "분석할 리포지토리를 클릭하여 선택하세요."}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setIsRepoModalOpen(false)} style={{ padding: '12px 24px', backgroundColor: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }}>닫기</button>
                  <button onClick={handleStartAnalysis} disabled={!selectedRepoUrl} style={{ padding: '12px 30px', backgroundColor: selectedRepoUrl ? '#4f46e5' : '#94a3b8', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: selectedRepoUrl ? 'pointer' : 'not-allowed', transition: 'all 0.2s', boxShadow: selectedRepoUrl ? '0 4px 6px -1px rgba(79, 70, 229, 0.4)' : 'none' }}>데이터 수집 및 분석 시작</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainPage;