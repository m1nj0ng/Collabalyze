import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Brush
} from 'recharts';

const ComparePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [timeUnit, setTimeUnit] = useState('monthly');
  
  const members = location.state?.members || [];

  const [visibleMembers, setVisibleMembers] = useState(
    members.map(m => m.name)
  );

  const toggleVisibility = (name) => {
    setVisibleMembers(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // 컴포넌트 마운트 시 최상단 이동
  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!members || members.length < 2) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: '"Inter", sans-serif' }}>
        <h2 style={{ color: '#ef4444' }}>잘못된 접근입니다.</h2>
        <p>대시보드에서 비교할 팀원을 2명 이상 선택해주세요.</p>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>돌아가기</button>
      </div>
    );
  }

  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // 멤버 페르소나 및 점수 가져오기
  const getMemberPersona = (member) => {
    const { score = 0, collaborationScore = 0, backendCodeScore = 0, commits = 0, pullRequests = 0, reviews = 0, issues = 0 } = member;
    if (!score) return { label: '분석 대기 중', color: '#64748b', bg: '#f1f5f9' };

    const totalActivities = commits + pullRequests + reviews + issues;

    if (backendCodeScore >= 90 && score >= 85) return { label: '핵심 아키텍트', color: '#4f46e5', bg: '#eef2ff' };
    if ((reviews > 0 && reviews / (totalActivities || 1) >= 0.25) || collaborationScore >= 90) return { label: '전문 리뷰어', color: '#075985', bg: '#e0f2fe' };
    if (issues > 0 && issues / (totalActivities || 1) >= 0.2) return { label: '버그 헌터', color: '#991b1b', bg: '#fee2e2' };
    if (pullRequests > 0 && pullRequests / (totalActivities || 1) >= 0.2) return { label: '핵심 기여자', color: '#166534', bg: '#dcfce7' };
    if (score >= 80) return { label: '올라운더', color: '#0d9488', bg: '#ecfdf5' };
    if (commits > 0 && commits / (totalActivities || 1) >= 0.75) return { label: '코드 머신', color: '#854d0e', bg: '#fef9c3' };
    
    return { label: '안정적 협업자', color: '#0369a1', bg: '#e0f2fe' };
  };

  // 단일 레이더 데이터 연산
  const getRadarData = (m) => {
    const teamMembers = members || [m];

    const maxCommits = Math.max(...teamMembers.map(mem => (mem.commits || 0) + (mem.pullRequests || 0)), 1);
    const maxReviews = Math.max(...teamMembers.map(mem => mem.reviews || 0), 1);
    const maxIssues = Math.max(...teamMembers.map(mem => mem.issues || 0), 1);
    const maxBackendScore = Math.max(...teamMembers.map(mem => mem.backendCodeScore || 0), 1);
    const maxCollabScore = Math.max(...teamMembers.map(mem => mem.collaborationScore || 0), 1);

    const { commits = 0, pullRequests = 0, reviews = 0, issues = 0, score = 0, backendCodeScore = 0, collaborationScore = 0 } = m;
    
    const base = 15;
    const scale = 85;
    
    const implementation = base + (((commits + pullRequests) / maxCommits) * scale);
    const design = base + (((backendCodeScore || 0) / maxBackendScore) * scale);
    const communication = base + ((reviews / maxReviews) * 0.7 + ((collaborationScore || 0) / maxCollabScore) * 0.3) * scale;
    const documentation = base + (((collaborationScore || 0) / maxCollabScore) * 0.6 + (((pullRequests + issues) / (maxCommits + maxIssues))) * 0.4) * scale;
    const problemSolving = base + ((issues / maxIssues) * scale);

    return [
      { subject: '구현력', value: Math.min(100, Math.round(implementation)) },
      { subject: '설계 능력', value: Math.min(100, Math.round(design)) },
      { subject: '소통/리뷰', value: Math.min(100, Math.round(communication)) },
      { subject: '문서화', value: Math.min(100, Math.round(documentation)) },
      { subject: '문제해결', value: Math.min(100, Math.round(problemSolving)) },
    ];
  };

  // 1. 합쳐진 레이더 데이터 (오버랩)
  const combinedRadarData = useMemo(() => {
    const radarDataList = members.map(m => getRadarData(m));
    const subjects = ['구현력', '설계 능력', '소통/리뷰', '문서화', '문제해결'];
    return subjects.map((subject, index) => {
      const row = { subject, fullMark: 100 };
      members.forEach((m, mIdx) => {
        row[m.name] = radarDataList[mIdx][index].value;
      });
      return row;
    });
  }, [members]);

  // 타임라인 병합 및 정렬 헬퍼
  const generateTimeline = (commits) => {
    const monthlyCounts = {}; const weeklyCounts = {}; const dailyCounts = {};
    (commits || []).forEach(c => {
      const targetDate = c.date || c.created_at || c.timestamp;
      if (!targetDate) return;
      let d = new Date(targetDate);
      if (isNaN(d.getTime()) && typeof targetDate === 'string') d = new Date(targetDate.replace(' ', 'T'));
      if (isNaN(d.getTime())) return;

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
      
      const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
      
      const dCopy = new Date(d.getTime());
      const day = dCopy.getDay();
      const diffToMonday = dCopy.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dCopy.setDate(diffToMonday));
      const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      weeklyCounts[weekKey] = (weeklyCounts[weekKey] || 0) + 1;
    });
    
    return {
      monthly: Object.keys(monthlyCounts).sort().map(key => ({ date: `${key.split('-')[0].substring(2)}년 ${key.split('-')[1]}월`, commits: monthlyCounts[key] })),
      weekly: Object.keys(weeklyCounts).sort().map(key => ({ date: `${key.split('-')[1]}/${key.split('-')[2]} 주`, commits: weeklyCounts[key] })),
      daily: Object.keys(dailyCounts).sort().map(key => ({ date: `${key.split('-')[1]}/${key.split('-')[2]}`, commits: dailyCounts[key] }))
    };
  };

  // 2. 합쳐진 타임라인 데이터 (멀티 라인)
  const mergedTimelineData = useMemo(() => {
    const timelines = members.map(m => generateTimeline(m.rawCommits || []));
    const merged = {};

    ['monthly', 'weekly', 'daily'].forEach(period => {
      const allDatesSet = new Set();
      timelines.forEach(t => {
        (t[period] || []).forEach(d => allDatesSet.add(d.date));
      });
      const allDates = Array.from(allDatesSet).sort();
      
      merged[period] = allDates.map(date => {
        const row = { date };
        members.forEach((m, mIdx) => {
          const found = (timelines[mIdx][period] || []).find(d => d.date === date);
          row[m.name] = found ? found.commits : 0;
        });
        return row;
      });
    });
    return merged;
  }, [members]);

  const timelineScrollRef = useRef(null);
  const currentTimelineData = mergedTimelineData[timeUnit] || [];

  // 데이터나 시간 단위가 변경될 때 가장 최근 데이터(오른쪽 끝)로 자동 스크롤
  useEffect(() => {
    if (timelineScrollRef.current) {
      timelineScrollRef.current.scrollLeft = timelineScrollRef.current.scrollWidth;
    }
  }, [currentTimelineData, timeUnit]);

  const getTopFiles = (changedFiles) => {
    const files = changedFiles || [];
    if (!files.length) return [];
    const counts = {};
    files.forEach(f => {
      const ext = f.includes('.') ? f.split('.').pop() : f.split('/').pop();
      const name = f.includes('.') ? `*.${ext}` : ext;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
  };

  const generateAnalysisText = (m) => {
    const p = getMemberPersona(m).label;
    const tf = getTopFiles(m.changedFiles);
    const fileStr = tf.length > 0 ? `${tf[0]} 파일` : '주요 소스코드';
    
    const commits = m.commits || 0;
    const prs = m.pullRequests || 0;
    const reviews = m.reviews || 0;
    const issues = m.issues || 0;

    // 팀 내 상대 평가 기준 계산
    const teamMembers = members || [m];
    const maxCommits = Math.max(...teamMembers.map(mem => mem.commits || 0), 1);
    const maxPRs = Math.max(...teamMembers.map(mem => mem.pullRequests || 0), 1);
    const maxReviews = Math.max(...teamMembers.map(mem => mem.reviews || 0), 1);
    const maxIssues = Math.max(...teamMembers.map(mem => mem.issues || 0), 1);
    const totalTeamCommits = teamMembers.reduce((sum, mem) => sum + (mem.commits || 0), 0);
    const totalTeamPRs = teamMembers.reduce((sum, mem) => sum + (mem.pullRequests || 0), 0);

    // 개인 내부 비율(Commit 유형) 계산
    let featCount = 0, refactorCount = 0, fixCount = 0, otherCount = 0;
    (m.rawCommits || []).forEach(c => {
      const msg = (c.message || c.commit_summary || '').toLowerCase();
      if (/^feat(\(.*?\))?:/.test(msg)) featCount++;
      else if (/^refactor(\(.*?\))?:/.test(msg)) refactorCount++;
      else if (/^fix(\(.*?\))?:/.test(msg)) fixCount++;
      else otherCount++;
    });
    const maxTypeCount = Math.max(featCount, refactorCount, fixCount, otherCount);
    const isFixDominant = fixCount > 0 && fixCount === maxTypeCount;

    let expertise = `${fileStr}을 중심으로 맡은 바 기능 구현에 성실히 기여했습니다.`;
    if (p === '핵심 아키텍트') expertise = `백엔드 정적 코드 분석에서 팀 내 최고 품질을 보여주며, ${fileStr}의 구조적 설계와 최적화에 크게 기여했습니다.`;
    else if (refactorCount > featCount && refactorCount > 0) expertise = `팀 내 기여를 넘어, 본인의 전체 작업 중에서도 새로운 기능 구현보다 ${fileStr} 중심의 코드 구조 개선(리팩토링)에 더 많은 리소스를 쏟아붓는 장인 정신을 보여줍니다.`;
    else if (commits >= maxCommits * 0.3) expertise = `단일 언어나 파일에 국한되지 않고 ${fileStr} 등 다양한 계층의 코드를 안정적으로 다루며 팀 프로젝트의 전반적인 완성도를 튼튼하게 높였습니다.`;

    let collaboration = `총 ${prs + reviews}건의 PR과 리뷰를 통해 팀원들과 안정적으로 작업 내역을 공유하고 있습니다.`;
    if (reviews >= prs * 2 && reviews > 0) collaboration = `본인의 기능을 개발하는 것보다 동료들의 코드를 검수하고 소통하는 데 2배 이상의 리소스를 할애하며, 팀의 기술 상향 평준화를 위해 이타적으로 헌신하고 있습니다.`;
    else if (reviews >= maxReviews * 0.7 && reviews > 0) collaboration = `팀 내 최고 수준인 총 ${reviews}회의 리뷰를 동료들에게 남기며, 프로젝트 코드 품질 향상을 이끄는 중추적인 역할을 수행했습니다.`;
    else if (reviews === 0 && prs === 0) collaboration = `현재 개인 브랜치 위주의 직접 커밋 비중이 높습니다. 향후 PR 생성 및 리뷰 참여를 조금씩 늘려간다면 팀 전체의 소통과 성장에 큰 도움이 될 것입니다.`;

    let habit = `주어진 요구사항과 개발 마일스톤을 묵묵하고 안정적으로 수행하는 성향입니다.`;
    if (isFixDominant) habit = `새로운 작업을 벌이기보다 본인이 맡은 파트의 안정성을 확보하고 버그를 완벽히 찾아내 정비하는 데 가장 많은 에너지를 집중하는 신중한 작업 습관을 가졌습니다.`;
    else if (issues >= maxIssues * 0.6 && issues > 0) habit = `팀에서 가장 주도적으로 총 ${issues}건의 이슈 트래킹에 참여하며, 문제 상황을 능동적으로 발굴하는 독보적인 버그 헌터 성향을 가졌습니다.`;

    return {
      codeAnalysis: `${p} 성향의 개발 활동이 감지되었습니다.`,
      commitAnalysis: "정량적 활동 지표와 참여 기록을 기반으로 분석된 협업 매너입니다.",
      expertise,
      collaboration,
      habit
    };
  };

  const maxStats = useMemo(() => ({
    score: Math.max(...members.map(m => m.score || 0), 0),
    commits: Math.max(...members.map(m => m.commits || 0), 0),
    pullRequests: Math.max(...members.map(m => m.pullRequests || 0), 0),
    reviews: Math.max(...members.map(m => m.reviews || 0), 0),
    issues: Math.max(...members.map(m => m.issues || 0), 0),
  }), [members]);

  // 카드 컴포넌트 분리
  const MemberCard = ({ member, color, isVisible, onToggle }) => {
    const p = getMemberPersona(member);
    return (
      <div style={{ padding: '25px', backgroundColor: isVisible ? '#ffffff' : '#f8fafc', opacity: isVisible ? 1 : 0.6, borderRadius: '16px', border: `1px solid ${isVisible ? color : '#cbd5e1'}40`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'relative', transition: 'all 0.2s' }}>
        <button
          onClick={() => onToggle(member.name)}
          style={{
            position: 'absolute', top: '20px', right: '20px',
            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer',
            backgroundColor: isVisible ? `${color}15` : '#f1f5f9',
            color: isVisible ? color : '#94a3b8',
            border: `1px solid ${isVisible ? color : '#e2e8f0'}`,
            transition: 'all 0.2s'
          }}
        >
          {isVisible ? '표시됨' : '숨김'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', backgroundColor: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {member.name[0]}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>{member.name}</h2>
            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: p.color, backgroundColor: p.bg, padding: '4px 10px', borderRadius: '20px', display: 'inline-block', marginTop: '6px' }}>{p.label}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[{ label: 'Score', val: member.score || 0 }, { label: 'Commits', val: member.commits || 0 }, { label: 'PRs', val: member.pullRequests || 0 }, { label: 'Reviews', val: member.reviews || 0 }].map(stat => (
            <div key={stat.label} style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>{stat.label}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#1e293b' }}>{stat.val}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '40px 20px', fontFamily: '"Inter", sans-serif', color: '#1e293b' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <div>
            <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer', margin: 0, color: '#1e293b', fontSize: '1.75rem', fontWeight: '800' }}>Collabalyze</h1>
            <p style={{ margin: '8px 0 0 0', color: '#64748b' }}>두 팀원의 협업 패턴 및 역량 비교</p>
          </div>
          <button onClick={() => navigate(-1)} style={{ padding: '10px 18px', backgroundColor: '#1e293b', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
            ← 대시보드로 돌아가기
          </button>
        </header>

        {/* 멤버 요약 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
          {members.map((m, idx) => (
            <MemberCard key={m.id || idx} member={m} color={COLORS[idx % COLORS.length]} isVisible={visibleMembers.includes(m.name)} onToggle={toggleVisibility} />
          ))}
        </div>

        {/* 차트 영역 (레이더 차트 & 타임라인 병합) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px' }}>
          
          {/* 레이더 차트 */}
          <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#1e293b' }}>역량 밸런스 비교</h3>
            <div style={{ width: '100%', height: '350px' }}>
              <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={combinedRadarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  {members.map((m, idx) => (
                    visibleMembers.includes(m.name) && (
                      <Radar key={m.id || idx} name={m.name} dataKey={m.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} fill={COLORS[idx % COLORS.length]} fillOpacity={0.3} />
                    )
                  ))}
                  <Legend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 활동 타임라인 */}
          <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
               <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>활동 타임라인 비교</h3>
               <div style={{ display: 'flex', gap: '8px' }}>
                 {['monthly', 'weekly', 'daily'].map(unit => (
                   <button key={unit} onClick={() => setTimeUnit(unit)} style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: timeUnit === unit ? '#f1f5f9' : '#fff', color: timeUnit === unit ? '#0f172a' : '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}>
                     {unit === 'monthly' ? '월별' : unit === 'weekly' ? '주별' : '일별'}
                   </button>
                 ))}
               </div>
            </div>
          <div style={{ width: '100%', height: '350px' }}>
              <ResponsiveContainer>
              <LineChart data={mergedTimelineData[timeUnit]} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} minTickGap={30} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Legend verticalAlign="top" height={30} iconType="circle" />
                  {members.map((m, idx) => (
                    visibleMembers.includes(m.name) && (
                      <Line key={m.id || idx} type="monotone" dataKey={m.name} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{ r: 4, fill: COLORS[idx % COLORS.length], strokeWidth: 0 }} />
                    )
                  ))}
                <Brush 
                  dataKey="date" 
                  height={20} 
                  stroke="#a5b4fc" 
                  fill="#f1f5f9" 
                  travellerWidth={8} 
                  startIndex={Math.max(0, (mergedTimelineData[timeUnit]?.length || 0) - 14)}
                  tickFormatter={() => ''} // 브러시 내부 텍스트 숨김
                />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* NLP 분석 결과 다중 보기 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', marginTop: '30px' }}>
          {members.map((m, idx) => {
            if (!visibleMembers.includes(m.name)) return null;
            const dyn = generateAnalysisText(m);
            const codeAnalysis = m.codeAnalysis || dyn.codeAnalysis;
            const commitAnalysis = m.commitAnalysis || dyn.commitAnalysis;
            const expertise = m.analysis?.expertise || dyn.expertise;
            const collaboration = m.analysis?.collaboration || dyn.collaboration;
            const habit = m.analysis?.habit || dyn.habit;
            return (
              <div key={m.id || idx} style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', borderTop: `4px solid ${COLORS[idx % COLORS.length]}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{m.name}의 협업 스타일</h3>
              
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>🛠 개발 스타일</p>
                <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{codeAnalysis}</p>
                <p style={{ margin: '4px 0 0 0', color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{expertise}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>총 기여 {m.score || 0}점</span>
                <span style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>총 커밋 {m.commits || 0}회</span>
                {(m.score || 0) > 0 && (m.score || 0) === maxStats.score && <span style={{ padding: '4px 10px', backgroundColor: '#fef9c3', color: '#854d0e', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #fde047' }}>점수 1위</span>}
                {(m.commits || 0) > 0 && (m.commits || 0) === maxStats.commits && <span style={{ padding: '4px 10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #bbf7d0' }}>커밋 1위</span>}
              </div>
              </div>
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>💬 협업 매너</p>
                <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{commitAnalysis}</p>
                <p style={{ margin: '4px 0 0 0', color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{collaboration}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>코드 리뷰 {m.reviews || 0}회</span>
                <span style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>PR 생성 {m.pullRequests || 0}건</span>
                {(m.reviews || 0) > 0 && (m.reviews || 0) === maxStats.reviews && <span style={{ padding: '4px 10px', backgroundColor: '#e0f2fe', color: '#0369a1', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #bae6fd' }}>리뷰 1위</span>}
                {(m.pullRequests || 0) > 0 && (m.pullRequests || 0) === maxStats.pullRequests && <span style={{ padding: '4px 10px', backgroundColor: '#eef2ff', color: '#4f46e5', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #c7d2fe' }}>PR 1위</span>}
              </div>
              </div>
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>⏱ 작업 습관</p>
                <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{habit}</p>
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600', border: '1px solid #e2e8f0' }}>참여 이슈 {m.issues || 0}건</span>
                {(m.issues || 0) > 0 && (m.issues || 0) === maxStats.issues && <span style={{ padding: '4px 10px', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '700', border: '1px solid #fecaca' }}>이슈 처리 1위</span>}
              </div>
              </div>
            </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default ComparePage;
