import { useId, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { reasonDistributionView } from '../returns/dashboardAnalytics';
import type { DashboardAnalytics as DashboardAnalyticsData } from '../returns/types';

const REASON_COLORS = ['#43c764', '#478ce8', '#f2b633', '#ef6548', '#7659d6', '#aeb8c4', '#35a7a0', '#d875b1', '#bc8b52', '#6da353', '#7d8ca3'];
const tooltipStyle = { background: '#111820', border: '1px solid #33404d', borderRadius: 6, color: '#f5f7f9', fontSize: 12 };

function Panel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return <section className={`analytics-panel ${className}`} aria-label={title} tabIndex={0}><h2>{title}</h2>{children}</section>;
}

export function DashboardAnalytics({ data }: { data: DashboardAnalyticsData }) {
  const gradientId = useId().replace(/:/g, '');
  const reasons = reasonDistributionView(data.reasonsDistribution);
  const totalReasons = reasons.reduce((sum, item) => sum + item.count, 0);
  const timeline = data.returnsOverTime.map((point) => ({ ...point, label: formatChartDate(point.date) }));
  const routes = data.topRoutes.map((route) => ({ ...route, displayCode: truncate(route.routeCode, 13) }));
  return <div className="analytics-grid">
    <Panel title="Returns Over Time" className="analytics-panel--timeline">
      {timeline.length === 0 ? <p className="analytics-panel__empty">No timeline data.</p> : <>
        <div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><AreaChart accessibilityLayer={false} data={timeline} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#43c764" stopOpacity={0.34}/><stop offset="100%" stopColor="#43c764" stopOpacity={0.02}/></linearGradient></defs>
          <CartesianGrid stroke="#202c36" vertical={false}/><XAxis dataKey="label" stroke="#768390" tick={{ fill: '#9ca7b2', fontSize: 11 }} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} stroke="#768390" tick={{ fill: '#9ca7b2', fontSize: 11 }} tickLine={false} axisLine={false}/>
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#f5f7f9' }} formatter={(value) => [Number(value), 'Returns']}/>
          <Area type="monotone" dataKey="count" name="Returns" stroke="#4cdb6d" strokeWidth={2.4} fill={`url(#${gradientId})`} dot={{ r: 3.5, fill: '#0d141a', stroke: '#63e783', strokeWidth: 2.2 }} activeDot={{ r: 5 }}/>
        </AreaChart></ResponsiveContainer></div>
        <p className="sr-only">{timeline.map((point) => `${point.date}: ${point.count} returns`).join('. ')}</p>
      </>}
    </Panel>
    <Panel title="Reasons Distribution" className="analytics-panel--reasons">
      {reasons.length === 0 ? <div className="donut-empty"><div className="donut-empty__ring"><strong>0</strong><span>Total</span></div><p>No reasons in this period.</p></div> : <div className="reasons-layout">
        <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer={false}><Pie data={reasons} dataKey="count" nameKey="label" innerRadius="56%" outerRadius="90%" paddingAngle={1} stroke="#111820">{reasons.map((item, index) => <Cell key={item.reason} fill={REASON_COLORS[index % REASON_COLORS.length]}/>)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value, _name, item) => [`${Number(value)} (${item.payload.percentage.toFixed(0)}%)`, item.payload.label]}/></PieChart></ResponsiveContainer><div className="donut-total"><strong>{totalReasons}</strong><span>Total</span></div></div>
        <ul className="reason-list">{reasons.map((item, index) => <li key={item.reason}><span className="reason-list__dot" style={{ background: REASON_COLORS[index % REASON_COLORS.length] }}/><span className="reason-list__label">{item.label}</span><span>{item.percentage.toFixed(0)}% ({item.count})</span></li>)}</ul>
      </div>}
    </Panel>
    <Panel title="Top Routes by Returns" className="analytics-panel--routes">
      {routes.length === 0 ? <p className="analytics-panel__empty">No route returns in this period.</p> : <>
        <div className="chart-frame"><ResponsiveContainer width="100%" height="100%"><BarChart accessibilityLayer={false} data={routes} layout="vertical" margin={{ top: 8, right: 30, left: 2, bottom: 0 }}><CartesianGrid stroke="#202c36" horizontal={false}/><XAxis type="number" allowDecimals={false} stroke="#768390" tick={{ fill: '#9ca7b2', fontSize: 11 }} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="displayCode" width={85} tick={{ fill: '#dce2e8', fontSize: 11 }} tickLine={false} axisLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value), 'Returns']} labelFormatter={(_label, payload) => payload[0] ? `${payload[0].payload.routeCode} — ${payload[0].payload.routeName}` : ''}/><Bar dataKey="count" name="Returns" fill="#4fc465" radius={[0, 3, 3, 0]} barSize={17}/></BarChart></ResponsiveContainer></div>
        <ul className="sr-only">{routes.map((route) => <li key={route.routeId}>{route.routeCode} — {route.routeName}: {route.count} returns</li>)}</ul>
      </>}
    </Panel>
  </div>;
}

function formatChartDate(isoDate: string) { return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`)); }
function truncate(value: string, max: number) { return value.length > max ? `${value.slice(0, max - 1)}…` : value; }
