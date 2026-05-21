import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockData = {
  // '이번 주'의 커밋 20개를 일별로 분배
  daily: [
    { date: '월', commits: 3 }, { date: '화', commits: 5 }, { date: '수', commits: 2 },
    { date: '목', commits: 6 }, { date: '금', commits: 4 }, { date: '토', commits: 0 },
    { date: '일', commits: 0 }
  ],
  // '5월'의 커밋 60개를 주별로 분배
  weekly: [
    { date: '4주 전', commits: 10 }, { date: '3주 전', commits: 18 }, 
    { date: '2주 전', commits: 12 }, { date: '이번 주', commits: 20 }
  ],
  // 프로젝트 총 커밋 420개를 월별로 분배
  monthly: [
    { date: '1월', commits: 80 }, { date: '2월', commits: 95 }, { date: '3월', commits: 75 },
    { date: '4월', commits: 110 }, { date: '5월', commits: 60 }
  ]
};

const ActivityTimeline = () => {
  // 기본 단위를 'monthly'로 변경하여 전체적인 흐름을 먼저 보여줍니다.
  const [timeUnit, setTimeUnit] = useState('monthly');
  const data = mockData[timeUnit];

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
        <select 
          value={timeUnit} 
          onChange={(e) => setTimeUnit(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem', color: '#475569', outline: 'none', cursor: 'pointer', backgroundColor: '#fff' }}
        >
          <option value="monthly">월별 (총 420 커밋)</option>
          <option value="weekly">주별 (최근 60 커밋)</option>
          <option value="daily">일별 (최근 20 커밋)</option>
        </select>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
            <Line type="monotone" dataKey="commits" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 6, stroke: '#c7d2fe', strokeWidth: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', marginTop: '15px', fontWeight: '500' }}>
        {timeUnit === 'monthly' && '프로젝트 전체 기간의 월별 커밋 추이입니다. 4월에 가장 활발했습니다.'}
        {timeUnit === 'weekly' && '최근 한 달간의 주별 커밋 추이입니다. 이번 주 활동량이 가장 많습니다.'}
        {timeUnit === 'daily' && '최근 한 주간의 일별 커밋 추이입니다. 주 중반에 활동이 집중됩니다.'}
      </p>
    </div>
  );
};

export default ActivityTimeline;