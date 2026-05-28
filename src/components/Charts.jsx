import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const ActivityPieChart = ({ data }) => {
  // 인원이 많아져도 겹치지 않도록 색상 팔레트 확장
  const COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f43f5e',
    '#14b8a6', '#f97316', '#0ea5e9', '#d946ef', '#2dd4bf'
  ];
  
  // 기여도 분포를 AI 종합 기여 점수(score) 기반으로 하되, 분석 전이라 점수가 0이라면 커밋 횟수를 대체값으로 사용
  const chartData = data.map(m => {
    let val = Number(m.score);
    if (isNaN(val) || val <= 0) val = Number(m.commits);
    if (isNaN(val) || val <= 0) val = 1; // 데이터가 모두 0일 때 파이차트가 터지는(검은 화면) Recharts 버그 완벽 방어
    return { name: String(m.name), value: val };
  });

  // 데이터가 아예 없을 경우 빈 차트 에러 방지
  if (!chartData || chartData.length === 0) {
    return <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>데이터가 없습니다.</div>;
  }

  return (
    <div style={{ width: '100%', height: 250 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};