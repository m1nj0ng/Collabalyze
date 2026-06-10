import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export const ActivityPieChart = ({ data, metric = 'score' }) => {
  // 인원이 많아져도 겹치지 않도록 색상 팔레트 확장
  const COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f43f5e',
    '#14b8a6', '#f97316', '#0ea5e9', '#d946ef', '#2dd4bf'
  ];
  
  // 1. 사람마다 고정된 색상과 순서를 보장하기 위해 '종합 점수' 기준으로 원본 데이터를 내림차순 정렬
  const sortedByScore = [...data].sort((a, b) => {
    const scoreA = (isNaN(Number(a.score)) || Number(a.score) <= 0) ? Number(a.commits) : Number(a.score);
    const scoreB = (isNaN(Number(b.score)) || Number(b.score) <= 0) ? Number(b.commits) : Number(b.score);
    return scoreB - scoreA;
  });

  // 2. 점수 순위에 따라 팀원별 고유 색상 매핑
  const colorMap = {};
  sortedByScore.forEach((m, idx) => { colorMap[m.name] = COLORS[idx % COLORS.length]; });

  // 3. 현재 선택된 메트릭(score, commits 등) 기준 데이터 구성
  let chartData = sortedByScore.map(m => {
    let val = Number(m[metric]);
    // score 탭일 때만 점수가 0이면 커밋 수로 임시 대체 표출
    if (metric === 'score' && (isNaN(val) || val <= 0)) val = Number(m.commits);
    if (isNaN(val) || val < 0) val = 0;
    return { name: String(m.name), value: val };
  }).filter(item => item.value > 0);

  // 4. 현재 보고 있는 지표에서 1등이 무조건 범례와 차트의 맨 앞에 오도록 내림차순 정렬
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
    return <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>데이터가 없습니다.</div>;
  }

  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isOthers ? '#cbd5e1' : colorMap[entry.name]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.8rem', paddingTop: '15px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};