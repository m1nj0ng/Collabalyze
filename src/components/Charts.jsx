import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const ActivityPieChart = ({ data, metric = 'score' }) => {
  // 인원이 많아져도 겹치지 않도록 색상 팔레트 확장
  const COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f43f5e',
    '#14b8a6', '#f97316', '#0ea5e9', '#d946ef', '#2dd4bf'
  ];
  
  // 선택된 메트릭 기준 파이차트 구성 (값이 0인 팀원은 제외)
  let chartData = data.map(m => {
    let val = Number(m[metric]);
    // score 탭일 때만 점수가 0이면 커밋 수로 임시 대체 표출
    if (metric === 'score' && (isNaN(val) || val <= 0)) val = Number(m.commits);
    if (isNaN(val) || val < 0) val = 0;
    return { name: String(m.name), value: val };
  }).filter(item => item.value > 0);

  // 데이터 내림차순 정렬 (기여도가 높은 순)
  chartData.sort((a, b) => b.value - a.value);

  // 인원이 많을 경우 가독성을 위해 상위 6명만 보여주고 나머지는 '그 외 N명'으로 묶음
  const MAX_SLICES = 7;
  if (chartData.length > MAX_SLICES) {
    const topData = chartData.slice(0, MAX_SLICES - 1);
    const others = chartData.slice(MAX_SLICES - 1);
    const othersSum = others.reduce((sum, item) => sum + item.value, 0);
    
    chartData = [
      ...topData,
      { name: `그 외 ${others.length}명`, value: othersSum, isOthers: true }
    ];
  }

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
              <Cell key={`cell-${index}`} fill={entry.isOthers ? '#cbd5e1' : COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};