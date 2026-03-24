import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Chart.js 모듈 등록
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// 1. 기여도 막대 그래프 (코드 라인 수, 커밋 수 등)
export const ContributionBarChart = ({ data }) => {
  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: '팀원별 코드 기여도 (Commits)' },
    },
  };

  const chartData = {
    labels: data.map(member => member.name),
    datasets: [
      {
        label: 'Commits',
        data: data.map(member => member.commits),
        backgroundColor: 'rgba(53, 162, 235, 0.5)',
      },
      {
        label: 'PR Reviews',
        data: data.map(member => member.reviews),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
      },
    ],
  };

  return <Bar options={options} data={chartData} />;
};

// 2. 협업 활동 파이 차트 (전체 활동 중 PR, Issue 비중 등)
export const ActivityPieChart = ({ data }) => {
  const totalCommits = data.reduce((acc, cur) => acc + cur.commits, 0);
  const totalReviews = data.reduce((acc, cur) => acc + cur.reviews, 0);
  const totalIssues = data.reduce((acc, cur) => acc + cur.issues, 0);

  const chartData = {
    labels: ['Commits', 'PR Reviews', 'Issues'],
    datasets: [
      {
        label: '# of Activities',
        data: [totalCommits, totalReviews, totalIssues],
        backgroundColor: [
          'rgba(54, 162, 235, 0.2)',
          'rgba(255, 99, 132, 0.2)',
          'rgba(255, 206, 86, 0.2)',
        ],
        borderColor: [
          'rgba(54, 162, 235, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return <Pie data={chartData} />;
};