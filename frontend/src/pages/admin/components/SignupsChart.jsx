import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';
import AdminTooltip from './AdminTooltip';
import { CHART_COLORS, CHART_FONT } from './chartTheme';

export default function SignupsChart({ data }) {
  if (!data?.length) {
    return <ChartCard title="User Signups"><em>No signup data yet</em></ChartCard>;
  }

  return (
    <ChartCard title="User Signups">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.stone} />
          <XAxis dataKey="date" tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <Tooltip content={<AdminTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            name="Signups"
            stroke={CHART_COLORS.bronze}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ fill: CHART_COLORS.bronze, r: 3 }}
            activeDot={{ r: 5, fill: CHART_COLORS.bronzeLight }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
