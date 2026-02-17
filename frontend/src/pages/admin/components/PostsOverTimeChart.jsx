import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import ChartCard from './ChartCard';
import AdminTooltip from './AdminTooltip';
import { CHART_COLORS, CHART_FONT } from './chartTheme';

export default function PostsOverTimeChart({ data }) {
  if (!data?.length) {
    return <ChartCard title="Posts Over Time"><em>No post data yet</em></ChartCard>;
  }

  return (
    <ChartCard title="Posts Over Time">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="patinaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.patina} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.patina} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.stone} />
          <XAxis dataKey="date" tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <Tooltip content={<AdminTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            name="Posts"
            stroke={CHART_COLORS.patina}
            strokeWidth={2}
            fill="url(#patinaGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
