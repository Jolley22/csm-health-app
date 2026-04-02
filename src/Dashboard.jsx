import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';
import { calculateWeightedRiskScore } from './scoring';

// Parse formatted date string "M/D/YYYY" → Date object
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
};

// Get YYYY-MM key for grouping by month
const getMonthKey = (dateStr) => {
  const d = parseDate(dateStr);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Format month key to display label like "3/1/2023"
const formatMonthLabel = (key) => {
  const [year, month] = key.split('-');
  return `${parseInt(month)}/1/${year}`;
};

const COLORS = {
  Low: '#22c55e',
  Medium: '#f59e0b',
  High: '#ef4444',
};

// Distinct colors for metric lines — cycles if more metrics than colors
const METRIC_COLORS = [
  '#16a34a', // green
  '#f59e0b', // amber
  '#dc2626', // red
  '#9ca3af', // gray
  '#d97706', // orange
  '#0891b2', // cyan
  '#3b82f6', // blue
  '#f43f5e', // rose
  '#eab308', // yellow
  '#4ade80', // light green
  '#a855f7', // purple
  '#06b6d4', // teal
];
const AVERAGE_COLOR = '#1d4ed8';

const SEGMENT_COLORS = {
  '1': '#15803d',
  '2': '#4ade80',
  '3': '#a3e635',
  '4': '#fbbf24',
};

const rawPoints = { high: 5, medium: 3, low: 1 };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white border border-gray-200 rounded shadow p-3 text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span style={{ color: entry.fill }}>■</span>
          <span>{entry.name}: {entry.value.toFixed(2)}% ({entry.payload[`${entry.name}Count`]})</span>
        </div>
      ))}
      <div className="mt-1 text-gray-500">Total customers: {total > 0 ? payload[0]?.payload?.totalCount : 0}</div>
    </div>
  );
};

const MetricTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));
  return (
    <div className="bg-white border border-gray-200 rounded shadow p-3 text-sm max-w-xs">
      <p className="font-semibold mb-1">{label}</p>
      {sorted.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span style={{ color: entry.stroke || entry.color }}>—</span>
          <span>{entry.name}: <strong>{entry.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

const CustomerTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const sorted = [...payload]
    .filter(p => p.value != null)
    .sort((a, b) => b.value - a.value);
  return (
    <div className="bg-white border border-gray-200 rounded shadow p-3 text-sm max-w-xs">
      <p className="font-semibold mb-1">{label}</p>
      {sorted.map(entry => {
        const lbl = entry.value > 130 ? 'High' : entry.value >= 60 ? 'Medium' : 'Low';
        return (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span style={{ color: entry.stroke }}>—</span>
            <span>{entry.name}: <strong>{entry.value}</strong> <span className="text-gray-400">({lbl})</span></span>
          </div>
        );
      })}
    </div>
  );
};

const renderLabel = (props) => {
  const { x, y, width, height, value } = props;
  if (!value || value < 4) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="#fff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight="600"
    >
      {value.toFixed(2)}%
    </text>
  );
};

// Build month→customer snapshot map shared by all charts
const buildMonthCustomerMap = (customers, filterCSM, filterSegment, filterStatus, filterCustomer) => {
  const filtered = customers.filter(c => {
    if (filterCSM !== 'all' && c.csm !== filterCSM) return false;
    if (filterSegment !== 'all' && c.segment !== filterSegment) return false;
    if (filterStatus === 'active' && c.isActive === false) return false;
    if (filterStatus === 'inactive' && c.isActive !== false) return false;
    if (filterCustomer !== 'all' && c.id !== filterCustomer) return false;
    return true;
  });

  const monthCustomerMap = {};
  filtered.forEach(customer => {
    const seenMonths = new Set();
    customer.history.forEach(snapshot => {
      const key = getMonthKey(snapshot.date);
      if (!key || seenMonths.has(key)) return;
      seenMonths.add(key);
      if (!monthCustomerMap[key]) monthCustomerMap[key] = {};
      monthCustomerMap[key][customer.id] = snapshot;
    });
  });

  return monthCustomerMap;
};

const Dashboard = ({ customers, metricsConfig = [] }) => {
  const [filterCSM, setFilterCSM] = useState('all');
  const [filterSegment, setFilterSegment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [hiddenCustomers, setHiddenCustomers] = useState(new Set());

  // Reset dependent filters and hidden lines when upstream filters change
  useEffect(() => {
    setFilterCustomer('all');
    setHiddenCustomers(new Set());
  }, [filterCSM, filterSegment, filterStatus]);

  const csms = useMemo(() => {
    const set = new Set(customers.map(c => c.csm).filter(Boolean));
    return Array.from(set).sort();
  }, [customers]);

  const segments = useMemo(() => {
    const set = new Set(customers.map(c => c.segment).filter(Boolean));
    return Array.from(set).sort();
  }, [customers]);

  // Options for customer dropdown — respects CSM/Segment/Status but not customer filter itself
  const customerOptions = useMemo(() => customers.filter(c => {
    if (filterCSM !== 'all' && c.csm !== filterCSM) return false;
    if (filterSegment !== 'all' && c.segment !== filterSegment) return false;
    if (filterStatus === 'active' && c.isActive === false) return false;
    if (filterStatus === 'inactive' && c.isActive !== false) return false;
    return true;
  }).sort((a, b) => (a.name || '').localeCompare(b.name || '')), [customers, filterCSM, filterSegment, filterStatus]);

  const monthCustomerMap = useMemo(
    () => buildMonthCustomerMap(customers, filterCSM, filterSegment, filterStatus, filterCustomer),
    [customers, filterCSM, filterSegment, filterStatus, filterCustomer]
  );

  const sortedMonths = useMemo(
    () => Object.keys(monthCustomerMap).sort(),
    [monthCustomerMap]
  );

  // --- Stacked bar chart data ---
  const chartData = useMemo(() => {
    return sortedMonths.map(key => {
      const snapshots = Object.values(monthCustomerMap[key]);
      const total = snapshots.length;
      if (total === 0) return null;

      let lowCount = 0, mediumCount = 0, highCount = 0;
      snapshots.forEach(snapshot => {
        const { label } = calculateWeightedRiskScore(snapshot);
        if (label === 'Low') lowCount++;
        else if (label === 'Medium') mediumCount++;
        else if (label === 'High') highCount++;
      });

      const counted = lowCount + mediumCount + highCount;
      if (counted === 0) return null;

      return {
        month: formatMonthLabel(key),
        Low: parseFloat(((lowCount / counted) * 100).toFixed(2)),
        Medium: parseFloat(((mediumCount / counted) * 100).toFixed(2)),
        High: parseFloat(((highCount / counted) * 100).toFixed(2)),
        LowCount: lowCount,
        MediumCount: mediumCount,
        HighCount: highCount,
        totalCount: counted,
      };
    }).filter(Boolean);
  }, [sortedMonths, monthCustomerMap]);

  // --- By Metric line chart data ---
  const metricKeys = useMemo(
    () => (metricsConfig.length > 0 ? metricsConfig.map(m => m.key) : []),
    [metricsConfig]
  );

  const metricLabels = useMemo(() => {
    const map = {};
    metricsConfig.forEach(m => { map[m.key] = m.label; });
    return map;
  }, [metricsConfig]);

  const metricTrendData = useMemo(() => {
    if (metricKeys.length === 0) return [];

    return sortedMonths.map(key => {
      const snapshots = Object.values(monthCustomerMap[key]);
      if (snapshots.length === 0) return null;

      const point = { month: formatMonthLabel(key) };
      let metricSum = 0;
      let metricCount = 0;

      metricKeys.forEach(mKey => {
        let total = 0;
        snapshots.forEach(snap => {
          const val = snap[mKey];
          if (val && rawPoints[val.toLowerCase()] !== undefined) {
            total += rawPoints[val.toLowerCase()];
          }
        });
        point[mKey] = total;
        metricSum += total;
        metricCount++;
      });

      point['__avg'] = metricCount > 0 ? Math.round(metricSum / metricCount) : 0;
      return point;
    }).filter(Boolean);
  }, [sortedMonths, monthCustomerMap, metricKeys]);

  // --- By Customer line chart data ---
  const customerList = useMemo(() => customers.filter(c => {
    if (filterCSM !== 'all' && c.csm !== filterCSM) return false;
    if (filterSegment !== 'all' && c.segment !== filterSegment) return false;
    if (filterStatus === 'active' && c.isActive === false) return false;
    if (filterStatus === 'inactive' && c.isActive !== false) return false;
    if (filterCustomer !== 'all' && c.id !== filterCustomer) return false;
    return true;
  }), [customers, filterCSM, filterSegment, filterStatus, filterCustomer]);

  // Active customers cycle through palette; inactive = black
  const customerColors = useMemo(() => {
    const colors = {};
    let activeIdx = 0;
    customerList.forEach(c => {
      colors[c.id] = c.isActive !== false
        ? METRIC_COLORS[activeIdx++ % METRIC_COLORS.length]
        : '#222222';
    });
    return colors;
  }, [customerList]);

  // Wide-row format: { month, [customerId]: score } — keys absent = gap in line
  const customerScoreData = useMemo(() => {
    return sortedMonths.map(key => {
      const point = { month: formatMonthLabel(key) };
      const snapshotsForMonth = monthCustomerMap[key];
      customerList.forEach(c => {
        const snap = snapshotsForMonth?.[c.id];
        if (!snap) return;
        const { score } = calculateWeightedRiskScore(snap);
        if (score !== null) point[c.id] = score;
      });
      return point;
    });
  }, [sortedMonths, monthCustomerMap, customerList]);

  // --- CSM Trendline: avg score per CSM per month (ignores CSM filter, respects others) ---
  const { csmTrendData, csmList } = useMemo(() => {
    const filtered = customers.filter(c => {
      if (filterSegment !== 'all' && c.segment !== filterSegment) return false;
      if (filterStatus === 'active' && c.isActive === false) return false;
      if (filterStatus === 'inactive' && c.isActive !== false) return false;
      if (filterCustomer !== 'all' && c.id !== filterCustomer) return false;
      return true;
    });

    const monthCsmScores = {};
    const csmSet = new Set();

    filtered.forEach(c => {
      if (!c.csm) return;
      csmSet.add(c.csm);
      const seenMonths = new Set();
      c.history.forEach(snap => {
        const key = getMonthKey(snap.date);
        if (!key || seenMonths.has(key)) return;
        seenMonths.add(key);
        const { score } = calculateWeightedRiskScore(snap);
        if (score === null) return;
        if (!monthCsmScores[key]) monthCsmScores[key] = {};
        if (!monthCsmScores[key][c.csm]) monthCsmScores[key][c.csm] = [];
        monthCsmScores[key][c.csm].push(score);
      });
    });

    const months = Object.keys(monthCsmScores).sort();
    const csmListSorted = Array.from(csmSet).sort();

    const data = months.map(key => {
      const point = { month: formatMonthLabel(key) };
      csmListSorted.forEach(csm => {
        const scores = monthCsmScores[key]?.[csm];
        if (scores?.length) {
          point[csm] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        }
      });
      return point;
    });

    return { csmTrendData: data, csmList: csmListSorted };
  }, [customers, filterSegment, filterStatus, filterCustomer]);

  // --- Segment Trendline: avg score per segment per month (ignores Segment filter, respects others) ---
  const { segmentTrendData, segList } = useMemo(() => {
    const filtered = customers.filter(c => {
      if (filterCSM !== 'all' && c.csm !== filterCSM) return false;
      if (filterStatus === 'active' && c.isActive === false) return false;
      if (filterStatus === 'inactive' && c.isActive !== false) return false;
      if (filterCustomer !== 'all' && c.id !== filterCustomer) return false;
      return true;
    });

    const monthSegScores = {};
    const segSet = new Set();

    filtered.forEach(c => {
      if (!c.segment) return;
      segSet.add(c.segment);
      const seenMonths = new Set();
      c.history.forEach(snap => {
        const key = getMonthKey(snap.date);
        if (!key || seenMonths.has(key)) return;
        seenMonths.add(key);
        const { score } = calculateWeightedRiskScore(snap);
        if (score === null) return;
        if (!monthSegScores[key]) monthSegScores[key] = {};
        if (!monthSegScores[key][c.segment]) monthSegScores[key][c.segment] = [];
        monthSegScores[key][c.segment].push(score);
      });
    });

    const months = Object.keys(monthSegScores).sort();
    const segListSorted = Array.from(segSet).sort();

    const data = months.map(key => {
      const point = { month: formatMonthLabel(key) };
      segListSorted.forEach(seg => {
        const scores = monthSegScores[key]?.[seg];
        if (scores?.length) {
          point[seg] = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
        }
      });
      return point;
    });

    return { segmentTrendData: data, segList: segListSorted };
  }, [customers, filterCSM, filterStatus, filterCustomer]);

  const handleCustomerLegendClick = (data) => {
    const id = data.dataKey;
    setHiddenCustomers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const chartTitle = useMemo(() => {
    const parts = [];
    if (filterCSM !== 'all') parts.push(filterCSM);
    if (filterSegment !== 'all') parts.push(`Segment ${filterSegment}`);
    if (filterStatus !== 'all') parts.push(filterStatus === 'active' ? 'Active' : 'Inactive');
    if (filterCustomer !== 'all') {
      const c = customers.find(x => x.id === filterCustomer);
      if (c) parts.push(c.name);
    }
    return parts.length > 0 ? parts.join(' — ') : 'OVERALL';
  }, [filterCSM, filterSegment, filterStatus, filterCustomer, customers]);

  // Tick interval to avoid crowding x-axis labels
  const metricTickInterval = useMemo(() => {
    if (metricTrendData.length <= 12) return 0;
    if (metricTrendData.length <= 24) return 1;
    return Math.floor(metricTrendData.length / 12);
  }, [metricTrendData]);

  const customerTickInterval = useMemo(() => {
    if (customerScoreData.length <= 12) return 0;
    if (customerScoreData.length <= 24) return 1;
    return Math.floor(customerScoreData.length / 12);
  }, [customerScoreData]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">CSM</label>
          <select
            value={filterCSM}
            onChange={e => setFilterCSM(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All CSMs</option>
            {csms.map(csm => (
              <option key={csm} value={csm}>{csm}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Segment</label>
          <select
            value={filterSegment}
            onChange={e => setFilterSegment(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Segments</option>
            {segments.map(seg => (
              <option key={seg} value={seg}>Segment {seg}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Customer</label>
          <select
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Customers</option>
            {customerOptions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6 uppercase tracking-wide">
          {chartTitle}
        </h2>

        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            No historical data available for the selected filters.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={480}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 0, bottom: 60 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                angle={-45}
                textAnchor="end"
                interval={0}
                height={70}
                label={{ value: 'Health Score Label', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
              />
              <YAxis
                tickFormatter={v => `${v}%`}
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 12 }} />
              <Bar dataKey="Medium" stackId="a" fill={COLORS.Medium} isAnimationActive={false}>
                <LabelList content={renderLabel} />
              </Bar>
              <Bar dataKey="High" stackId="a" fill={COLORS.High} isAnimationActive={false}>
                <LabelList content={renderLabel} />
              </Bar>
              <Bar dataKey="Low" stackId="a" fill={COLORS.Low} isAnimationActive={false}>
                <LabelList content={renderLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* By Metric Line Chart */}
      {metricKeys.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 uppercase tracking-wide">
            By Metric
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Sum of raw metric points (High=5, Mid=3, Low=1) across all customers per month
          </p>

          {metricTrendData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              No historical data available for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={480}>
              <LineChart
                data={metricTrendData}
                margin={{ top: 10, right: 20, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  interval={metricTickInterval}
                  height={70}
                  label={{ value: 'Customer Health Trendline', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip content={<MetricTooltip />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ paddingBottom: 12 }}
                  formatter={(value) => value === '__avg' ? 'AVERAGE' : (metricLabels[value] || value)}
                />

                {metricKeys.map((mKey, idx) => (
                  <Line
                    key={mKey}
                    type="monotone"
                    dataKey={mKey}
                    name={metricLabels[mKey] || mKey}
                    stroke={METRIC_COLORS[idx % METRIC_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}

                {/* AVERAGE line — dashed blue */}
                <Line
                  type="monotone"
                  dataKey="__avg"
                  name="AVERAGE"
                  stroke={AVERAGE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ r: 3, fill: AVERAGE_COLOR }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* By Customer Line Chart */}
      {customerList.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 uppercase tracking-wide">
            By Customer
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Weighted risk score per customer per month — dashed black lines are inactive customers. Click legend to show/hide.
          </p>

          {customerScoreData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              No historical data available for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={520}>
              <LineChart
                data={customerScoreData}
                margin={{ top: 10, right: 220, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  interval={customerTickInterval}
                  height={70}
                  label={{ value: 'Customer Health Trendline', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis
                  domain={[0, 170]}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  ticks={[0, 25, 50, 75, 100, 125, 150, 170]}
                />
                <Tooltip content={<CustomerTooltip />} />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ paddingLeft: 16, maxHeight: 480, overflowY: 'auto', fontSize: 11 }}
                  onClick={handleCustomerLegendClick}
                  formatter={(value, entry) => (
                    <span style={{
                      color: hiddenCustomers.has(entry.dataKey) ? '#9ca3af' : '#374151',
                      cursor: 'pointer',
                      textDecoration: hiddenCustomers.has(entry.dataKey) ? 'line-through' : 'none',
                    }}>{value}</span>
                  )}
                />

                {customerList.map(c => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    name={c.name || c.id}
                    stroke={customerColors[c.id]}
                    strokeWidth={c.isActive !== false ? 1.5 : 1}
                    strokeDasharray={c.isActive !== false ? undefined : '5 3'}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    hide={hiddenCustomers.has(c.id)}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}

                {/* Threshold reference lines */}
                <ReferenceLine
                  y={60}
                  stroke="#22c55e"
                  strokeDasharray="4 2"
                  label={{ value: 'Low', position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }}
                />
                <ReferenceLine
                  y={130}
                  stroke="#ef4444"
                  strokeDasharray="4 2"
                  label={{ value: 'High', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
      {/* CSM Trendline */}
      {csmList.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 uppercase tracking-wide">
            CSM Trendline
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Average weighted risk score per CSM per month
          </p>

          {csmTrendData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              No historical data available for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={480}>
              <LineChart
                data={csmTrendData}
                margin={{ top: 10, right: 200, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  interval={customerTickInterval}
                  height={70}
                  label={{ value: 'Customer Health Trendline', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomerTooltip />} />
                <Legend
                  layout="vertical"
                  verticalAlign="middle"
                  align="right"
                  wrapperStyle={{ paddingLeft: 16, fontSize: 11 }}
                />
                {csmList.map((csm, idx) => (
                  <Line
                    key={csm}
                    type="monotone"
                    dataKey={csm}
                    name={csm}
                    stroke={METRIC_COLORS[idx % METRIC_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
                <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="4 2"
                  label={{ value: 'Low', position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }} />
                <ReferenceLine y={130} stroke="#ef4444" strokeDasharray="4 2"
                  label={{ value: 'High', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Segment Trendline */}
      {segList.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 uppercase tracking-wide">
            Customer Segment Health
          </h2>
          <p className="text-xs text-gray-500 mb-6">
            Average weighted risk score per segment per month
          </p>

          {segmentTrendData.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              No historical data available for the selected filters.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={480}>
              <LineChart
                data={segmentTrendData}
                margin={{ top: 24, right: 20, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  angle={-45}
                  textAnchor="end"
                  interval={customerTickInterval}
                  height={70}
                  label={{ value: 'Customer Health Trendline', position: 'insideBottom', offset: -10, fontSize: 12, fill: '#6b7280' }}
                />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={['auto', 'auto']} />
                <Tooltip content={<CustomerTooltip />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ paddingBottom: 12 }}
                  formatter={value => `Segment ${value}`}
                />
                {segList.map(seg => {
                  const color = SEGMENT_COLORS[seg] || METRIC_COLORS[parseInt(seg, 10) % METRIC_COLORS.length];
                  return (
                    <Line
                      key={seg}
                      type="monotone"
                      dataKey={seg}
                      name={seg}
                      stroke={color}
                      strokeWidth={2}
                      dot={{ r: 3, fill: color }}
                      activeDot={{ r: 5 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    >
                      <LabelList
                        position="top"
                        style={{ fontSize: 9, fill: color, fontWeight: 500 }}
                        formatter={v => (v != null ? v.toFixed(1) : '')}
                      />
                    </Line>
                  );
                })}
                <ReferenceLine y={60} stroke="#22c55e" strokeDasharray="4 2"
                  label={{ value: 'Low', position: 'insideTopRight', fontSize: 10, fill: '#22c55e' }} />
                <ReferenceLine y={130} stroke="#ef4444" strokeDasharray="4 2"
                  label={{ value: 'High', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
