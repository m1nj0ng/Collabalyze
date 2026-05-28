import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip
} from 'recharts';

const ComparePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [timeUnit, setTimeUnit] = useState('monthly');
  
  // 컴포넌트 마운트 시 최상단 이동
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const members = location.state?.members;
  if (!members || members.length !== 2) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: '"Inter", sans-serif' }}>
        <h2 style={{ color: '#ef4444' }}>잘못된 접근입니다.</h2>
        <p>대시보드에서 비교할 팀원 2명을 선택해주세요.</p>
        <button onClick={() => navigate(-1)} style={{ padding: '10px 20px', background: '#1e293b', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>돌아가기</button>
      </div>
    );
  }

  const [m1, m2] = members;
  const COLORS = ['#4f46e5', '#10b981']; // m1: Indigo, m2: Emerald

  // 멤버 페르소나 및 점수 가져오기
  const getMemberPersona = (member) => {
    if (member.score >= 95) return { label: '핵심 아키텍트', color: '#4f46e5', bg: '#eef2ff' };
    if (member.score >= 90) return { label: '핵심 기여자', color: '#166534', bg: '#dcfce7' };
    if (member.issues >= 15) return { label: '버그 헌터', color: '#991b1b', bg: '#fee2e2' };
    if (member.reviews >= 25) return { label: '전문 리뷰어', color: '#075985', bg: '#e0f2fe' };
    if (member.commits >= 100) return { label: '코드 머신', color: '#854d0e', bg: '#fef9c3' };
    if (!member.score) return { label: '분석 대기 중', color: '#64748b', bg: '#f1f5f9' };
    return { label: '안정적 협업자', color: '#0369a1', bg: '#e0f2fe' };
  };

  // 단일 레이더 데이터 연산
  const getRadarData = (m) => [
    { subject: '구현력', value: Math.min(100, (m.commits || 0) * 1.5 + 50) },
    { subject: '설계 능력', value: Math.min(100, (m.score || 60) + 10) },
    { subject: '소통/리뷰', value: Math.min(100, (m.reviews || 0) * 3 + 50) },
    { subject: '문서화', value: 75 },
    { subject: '문제해결', value: Math.min(100, (m.issues || 0) * 4 + 50) },
  ];

  // 1. 합쳐진 레이더 데이터 (오버랩)
  const combinedRadarData = useMemo(() => {
    const r1 = getRadarData(m1);
    const r2 = getRadarData(m2);
    return r1.map((item, i) => ({
      subject: item.subject,
      [m1.name]: item.value,
      [m2.name]: r2[i].value,
      fullMark: 100
    }));
  }, [m1, m2]);

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
    const t1 = generateTimeline(m1.rawCommits || []);
    const t2 = generateTimeline(m2.rawCommits || []);
    const merged = {};

    ['monthly', 'weekly', 'daily'].forEach(period => {
      const d1 = t1[period] || [];
      const d2 = t2[period] || [];
      const allDates = Array.from(new Set([...d1.map(d => d.date), ...d2.map(d => d.date)])).sort();
      
      merged[period] = allDates.map(date => {
        const val1 = d1.find(d => d.date === date)?.commits || 0;
        const val2 = d2.find(d => d.date === date)?.commits || 0;
        return { date, [m1.name]: val1, [m2.name]: val2 };
      });
    });
    return merged;
  }, [m1, m2]);

  // 카드 컴포넌트 분리
  const MemberCard = ({ member, color }) => {
    const p = getMemberPersona(member);
    return (
      <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', border: `1px solid ${color}40`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
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

        {/* 멤버 요약 카드 (나란히) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
          <MemberCard member={m1} color={COLORS[0]} />
          <MemberCard member={m2} color={COLORS[1]} />
        </div>

        {/* 차트 영역 (레이더 차트 & 타임라인 병합) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px' }}>
          
          {/* 레이더 차트 */}
          <div style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#1e293b' }}>역량 밸런스 비교</h3>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={combinedRadarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={m1.name} dataKey={m1.name} stroke={COLORS[0]} strokeWidth={2} fill={COLORS[0]} fillOpacity={0.3} />
                  <Radar name={m2.name} dataKey={m2.name} stroke={COLORS[1]} strokeWidth={2} fill={COLORS[1]} fillOpacity={0.3} />
                  <Legend verticalAlign="top" height={30} iconType="circle" />
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
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer>
                <LineChart data={mergedTimelineData[timeUnit]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                  <Legend verticalAlign="top" height={30} iconType="circle" />
                  <Line type="monotone" dataKey={m1.name} stroke={COLORS[0]} strokeWidth={3} dot={{ r: 4, fill: COLORS[0], strokeWidth: 0 }} />
                  <Line type="monotone" dataKey={m2.name} stroke={COLORS[1]} strokeWidth={3} dot={{ r: 4, fill: COLORS[1], strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* NLP 분석 결과 나란히 보기 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginTop: '30px' }}>
          {[m1, m2].map((m, idx) => (
            <div key={m.id} style={{ padding: '25px', backgroundColor: '#ffffff', borderRadius: '16px', borderTop: `4px solid ${COLORS[idx]}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b' }}>{m.name}의 협업 스타일</h3>
              
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>🛠 개발 스타일</p>
                <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{m.codeAnalysis || "코드 분석 결과가 아직 제공되지 않았습니다."}</p>
                <p style={{ margin: '4px 0 0 0', color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{m.analysis?.expertise}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>💬 협업 매너</p>
                <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{m.commitAnalysis || "커밋 히스토리를 분석 중입니다."}</p>
                <p style={{ margin: '4px 0 0 0', color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{m.analysis?.collaboration}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#1e293b', fontWeight: '700' }}>⏱ 작업 습관</p>
                <p style={{ margin: 0, color: '#475569', lineHeight: '1.6', fontSize: '0.9rem' }}>{m.analysis?.habit || "작업 습관을 파악 중입니다."}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default ComparePage;