import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LabelList, ResponsiveContainer
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

const Dashboard = ({ customers }) => {
  const [filterCSM, setFilterCSM] = useState('all');
  const [filterSegment, setFilterSegment] = useState('all');

  // Derive unique CSMs and segments from customer data
  const csms = useMemo(() => {
    const set = new Set(customers.map(c => c.csm).filter(Boolean));
    return Array.from(set).sort();
  }, [customers]);

  const segments = useMemo(() => {
    const set = new Set(customers.map(c => c.segment).filter(Boolean));
    return Array.from(set).sort();
  }, [customers]);

  const chartData = useMemo(() => {
    // Apply filters
    const filtered = customers.filter(c => {
      if (filterCSM !== 'all' && c.csm !== filterCSM) return false;
      if (filterSegment !== 'all' && c.segment !== filterSegment) return false;
      return true;
    });

    // For each customer, collect one snapshot per month (most recent)
    // monthData: { monthKey: { customerId: snapshot } }
    const monthCustomerMap = {};

    filtered.forEach(customer => {
      // Build a map of monthKey → most recent snapshot for this customer
      // history is ordered newest first, so first entry per month wins
      const seenMonths = new Set();

      customer.history.forEach(snapshot => {
        const key = getMonthKey(snapshot.date);
        if (!key || seenMonths.has(key)) return;
        seenMonths.add(key);

        if (!monthCustomerMap[key]) monthCustomerMap[key] = {};
        monthCustomerMap[key][customer.id] = snapshot;
      });
    });

    // Sort months chronologically
    const sortedMonths = Object.keys(monthCustomerMap).sort();

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
        // Incomplete not counted in chart
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
  }, [customers, filterCSM, filterSegment]);

  const chartTitle = useMemo(() => {
    const parts = [];
    if (filterCSM !== 'all') parts.push(filterCSM);
    if (filterSegment !== 'all') parts.push(`Segment ${filterSegment}`);
    return parts.length > 0 ? parts.join(' — ') : 'OVERALL';
  }, [filterCSM, filterSegment]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-4">
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
      </div>

      {/* Chart */}
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
              {/* Stack order: Medium (bottom), High (middle), Low (top) — matching the image */}
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
    </div>
  );
};

export default Dashboard;
