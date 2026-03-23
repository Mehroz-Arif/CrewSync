import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "oklch(0.45 0.18 260)",   // primary
  "oklch(0.68 0.16 180)",   // accent/teal
  "oklch(0.65 0.2 330)",    // chart-3 pink
  "oklch(0.75 0.15 85)",    // chart-4 yellow
  "oklch(0.60 0.20 30)",    // chart-5 orange
  "oklch(0.55 0.15 140)",   // green
  "oklch(0.50 0.2 290)",    // violet
  "oklch(0.70 0.12 50)",    // warm orange
];

type BarChartData = { month: string; count: number }[];

type BarChartCardProps = {
  title: string;
  subtitle?: string;
  data: BarChartData;
  barColor?: string;
  emptyMessage?: string;
};

export function BarChartCard({
  title,
  subtitle,
  data,
  barColor = CHART_COLORS[0],
  emptyMessage = "No data to display",
}: BarChartCardProps) {
  const hasData = data.some((d) => d.count > 0);

  return (
    <div className="bg-card border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-heading font-semibold text-sm">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="count" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

type PieData = { name: string; count: number }[];

type PieChartCardProps = {
  title: string;
  subtitle?: string;
  data: PieData;
  emptyMessage?: string;
};

export function PieChartCard({
  title,
  subtitle,
  data,
  emptyMessage = "No data to display",
}: PieChartCardProps) {
  const hasData = data.length > 0 && data.some((d) => d.count > 0);

  return (
    <div className="bg-card border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-heading font-semibold text-sm">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              dataKey="count"
              nameKey="name"
              strokeWidth={2}
              stroke="var(--card)"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

type ListItem = { name: string; count: number };

type RankingListCardProps = {
  title: string;
  subtitle?: string;
  data: ListItem[];
  emptyMessage?: string;
  valueLabel?: string;
};

export function RankingListCard({
  title,
  subtitle,
  data,
  emptyMessage = "No data yet",
  valueLabel = "",
}: RankingListCardProps) {
  return (
    <div className="bg-card border rounded-xl p-5 space-y-4">
      <div>
        <h3 className="font-heading font-semibold text-sm">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      {data.length > 0 ? (
        <div className="space-y-2">
          {data.map((item, i) => (
            <div
              key={item.name}
              className="flex items-center gap-3 text-sm"
            >
              <span className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <span className="flex-1 truncate">{item.name}</span>
              <span className="text-muted-foreground font-medium tabular-nums">
                {item.count}{valueLabel ? ` ${valueLabel}` : ""}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
