import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';
import AdminTooltip from './AdminTooltip';
import { CHART_COLORS, CHART_FONT } from './chartTheme';

export default function CostEstimateChart({ data }) {
  if (!data?.length) {
    return <ChartCard title="Estimated AI Cost"><em>No cost data yet</em></ChartCard>;
  }

  return (
    <ChartCard title="Estimated AI Cost">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.stone} />
          <XAxis dataKey="month" tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <YAxis
            tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<AdminTooltip formatter={(v) => `$${v.toFixed(2)}`} />} />
          <Bar dataKey="estimated_usd" name="Est. Cost" fill={CHART_COLORS.bronze} radius={[0, 0, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
