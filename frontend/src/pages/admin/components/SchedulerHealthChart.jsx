import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import ChartCard from './ChartCard';
import AdminTooltip from './AdminTooltip';
import { CHART_COLORS, CHART_FONT } from './chartTheme';

export default function SchedulerHealthChart({ data }) {
  if (!data?.length) {
    return <ChartCard title="Scheduler Health"><em>No execution data yet</em></ChartCard>;
  }

  return (
    <ChartCard title="Scheduler Health">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.stone} />
          <XAxis dataKey="date" tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <Tooltip content={<AdminTooltip />} />
          <Legend
            verticalAlign="bottom"
            iconType="square"
            formatter={(value) => <span style={{ fontSize: 12, fontFamily: '"Inter", sans-serif' }}>{value}</span>}
          />
          <Bar dataKey="success" name="Success" stackId="a" fill={CHART_COLORS.patina} radius={[0, 0, 0, 0]} />
          <Bar dataKey="failure" name="Failure" stackId="a" fill={CHART_COLORS.sienna} radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
