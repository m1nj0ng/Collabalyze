import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockTimeline = [
  { date: '05-10', commits: 5 }, { date: '05-11', commits: 12 }, { date: '05-12', commits: 8 },
  { date: '05-13', commits: 15 }, { date: '05-14', commits: 20 }, { date: '05-15', commits: 10 }
];

const ActivityTimeline = () => (
  <div style={{ width: '100%', height: 250 }}>
    <ResponsiveContainer>
      <LineChart data={mockTimeline}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="commits" stroke="#0969da" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
    <p style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', marginTop: '10px' }}>
      최근 7일간 개발 생산성이 주 중반(14일)에 집중되는 경향을 보입니다.
    </p>
  </div>
);
export default ActivityTimeline;