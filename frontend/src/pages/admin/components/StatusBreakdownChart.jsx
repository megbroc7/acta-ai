import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import ChartCard from './ChartCard';
import AdminTooltip from './AdminTooltip';
import { STATUS_COLORS } from './chartTheme';

const LABELS = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  published: 'Published',
  rejected: 'Rejected',
};

export default function StatusBreakdownChart({ data }) {
  const chartData = Object.entries(LABELS)
    .map(([key, name]) => ({ name, value: data?.[key] || 0 }))
    .filter((d) => d.value > 0);

  if (!chartData.length) {
    return <ChartCard title="Post Status Breakdown"><em>No posts yet</em></ChartCard>;
  }

  const colors = Object.values(STATUS_COLORS);

  return (
    <ChartCard title="Post Status Breakdown">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            dataKey="value"
            stroke="none"
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<AdminTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            formatter={(value) => <span style={{ fontSize: 12, fontFamily: '"Inter", sans-serif' }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
