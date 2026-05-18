import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export const ActivityPieChart = ({ data }) => {
  // 인원이 많아져도 겹치지 않도록 색상 팔레트 확장
  const COLORS = [
    '#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f43f5e',
    '#14b8a6', '#f97316', '#0ea5e9', '#d946ef', '#2dd4bf'
  ];
  
  const chartData = data.map(m => ({ name: m.name, value: m.commits }));

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