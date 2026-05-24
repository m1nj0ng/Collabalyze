import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const timeUnitConfig = {
  monthly: { label: '월별', summary: '프로젝트 전체 기간의 월별 커밋 추이입니다.' },
  weekly: { label: '주별', summary: '최근 한 달간의 주별 커밋 추이입니다.' },
  daily: { label: '일별', summary: '최근 한 주간의 일별 커밋 추이입니다.' },
};

const ActivityTimeline = ({ timelineData }) => {
  // 기본 단위를 'monthly'로 변경하여 전체적인 흐름을 먼저 보여줍니다.
  const [timeUnit, setTimeUnit] = useState('monthly');
  
  // 백엔드 데이터가 없을 경우를 대비한 안전한 빈 데이터 처리
  const safeData = timelineData || { monthly: [], weekly: [], daily: [] };
  const data = safeData[timeUnit] || [];
  const summary = timeUnitConfig[timeUnit]?.summary;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px', gap: '8px' }}>
        {Object.keys(timeUnitConfig).map(key => (
          <button
            key={key}
            onClick={() => setTimeUnit(key)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: timeUnit === key ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
              backgroundColor: timeUnit === key ? '#eef2ff' : '#ffffff',
              color: timeUnit === key ? '#4f46e5' : '#475569',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {timeUnitConfig[key].label}
          </button>
        ))}
      </div>
      <div style={{ width: '100%', height: 220 }}>
        {data.length > 0 ? (
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
              <Line type="monotone" dataKey="commits" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#c7d2fe', strokeWidth: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
            타임라인 데이터가 없습니다. (백엔드 연동 필요)
          </div>
        )}
      </div>
      <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', marginTop: '15px', fontWeight: '500' }}>
        {summary}
      </p>
    </div>
  );
};

export default ActivityTimeline;