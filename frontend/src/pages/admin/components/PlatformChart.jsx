import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import ChartCard from './ChartCard';
import AdminTooltip from './AdminTooltip';
import { CHART_COLORS, CHART_FONT } from './chartTheme';

const PLATFORM_COLORS = {
  wordpress: CHART_COLORS.patina,
  shopify: CHART_COLORS.bronze,
  wix: CHART_COLORS.sienna,
};

export default function PlatformChart({ data }) {
  if (!data?.length) {
    return <ChartCard title="Sites by Platform"><em>No sites yet</em></ChartCard>;
  }

  const chartData = data.map((d) => ({
    ...d,
    platformLabel: d.platform.charAt(0).toUpperCase() + d.platform.slice(1),
    fill: PLATFORM_COLORS[d.platform] || CHART_COLORS.patina,
  }));

  return (
    <ChartCard title="Sites by Platform">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.stone} />
          <XAxis dataKey="platformLabel" tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ ...CHART_FONT, fill: CHART_COLORS.textSecondary }} tickLine={false} />
          <Tooltip content={<AdminTooltip />} />
          <Bar dataKey="count" name="Sites" radius={[0, 0, 0, 0]}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
