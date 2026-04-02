import React, { useMemo, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
};

const getMonthKey = (dateStr) => {
  const d = parseDate(dateStr);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (key) => {
  const [year, month] = key.split('-');
  return `${parseInt(month)}/${year.slice(2)}`;
};

const MissingEvals = ({ customers, isAdmin }) => {
  const [filterCSM, setFilterCSM] = useState('all');
  const [monthsBack, setMonthsBack] = useState(12);

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const months = useMemo(() => {
    const result = [];
    const start = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
    let d = new Date(start);
    while (
      d.getFullYear() < now.getFullYear() ||
      (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth())
    ) {
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsBack]);

  const csms = useMemo(() => {
    const set = new Set(customers.map(c => c.csm).filter(Boolean));
    return Array.from(set).sort();
  }, [customers]);

  // Only active customers
  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c => {
        if (c.isActive === false) return false;
        if (isAdmin && filterCSM !== 'all' && c.csm !== filterCSM) return false;
        return true;
      })
      .sort((a, b) => (a.csm || '').localeCompare(b.csm || '') || (a.name || '').localeCompare(b.name || ''));
  }, [customers, filterCSM, isAdmin]);

  // For each customer, build set of months that have a snapshot
  const customerMonthSets = useMemo(() => {
    const map = {};
    filteredCustomers.forEach(c => {
      const set = new Set();
      c.history.forEach(snap => {
        const key = getMonthKey(snap.date);
        if (key) set.add(key);
      });
      map[c.id] = set;
    });
    return map;
  }, [filteredCustomers]);

  // Per-month summary counts
  const monthSummary = useMemo(() => {
    return months.map(m => {
      const total = filteredCustomers.length;
      const done = filteredCustomers.filter(c => customerMonthSets[c.id]?.has(m)).length;
      return { month: m, done, total, missing: total - done };
    });
  }, [months, filteredCustomers, customerMonthSets]);

  // Group by CSM for display
  const byCSM = useMemo(() => {
    const groups = {};
    filteredCustomers.forEach(c => {
      const csm = c.csm || '(unassigned)';
      if (!groups[csm]) groups[csm] = [];
      groups[csm].push(c);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredCustomers]);

  const totalMissing = monthSummary.reduce((sum, m) => sum + m.missing, 0);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {isAdmin && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">CSM</label>
            <select
              value={filterCSM}
              onChange={e => setFilterCSM(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All CSMs</option>
              {csms.map(csm => <option key={csm} value={csm}>{csm}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Period</label>
          <select
            value={monthsBack}
            onChange={e => setMonthsBack(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={3}>Last 3 months</option>
            <option value={6}>Last 6 months</option>
            <option value={12}>Last 12 months</option>
            <option value={24}>Last 24 months</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {totalMissing === 0 ? (
            <span className="text-green-600 font-medium">All evals complete</span>
          ) : (
            <span className="text-red-600 font-medium">{totalMissing} missing eval{totalMissing !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border-b border-r border-gray-200 px-4 py-3 text-left font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                Customer
              </th>
              {isAdmin && (
                <th className="border-b border-r border-gray-200 px-4 py-3 text-left font-semibold text-gray-700 min-w-[130px]">
                  CSM
                </th>
              )}
              {months.map(m => {
                const sum = monthSummary.find(s => s.month === m);
                const allDone = sum && sum.missing === 0;
                return (
                  <th key={m} className="border-b border-r border-gray-200 px-3 py-3 text-center font-semibold text-gray-700 min-w-[64px]">
                    <div className="text-xs">{formatMonthLabel(m)}</div>
                    {sum && (
                      <div className={`text-[10px] mt-0.5 font-normal ${allDone ? 'text-green-500' : 'text-red-500'}`}>
                        {sum.done}/{sum.total}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {byCSM.map(([csm, csmCustomers]) =>
              csmCustomers.map((customer, idx) => (
                <tr key={customer.id} className={idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50 hover:bg-gray-100'}>
                  <td className={`border-b border-r border-gray-200 px-4 py-2 font-medium text-gray-900 sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {customer.name}
                  </td>
                  {isAdmin && (
                    <td className="border-b border-r border-gray-200 px-4 py-2 text-gray-600">
                      {idx === 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {csm}
                        </span>
                      ) : null}
                    </td>
                  )}
                  {months.map(m => {
                    const hasEval = customerMonthSets[customer.id]?.has(m);
                    const isFuture = m > currentMonthKey;
                    return (
                      <td key={m} className="border-b border-r border-gray-200 px-3 py-2 text-center">
                        {hasEval ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        ) : isFuture ? (
                          <span className="text-gray-200 text-xs">—</span>
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan={months.length + (isAdmin ? 2 : 1)} className="px-4 py-10 text-center text-gray-400">
                  No active customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Only active customers are tracked. Inactive customers are excluded from missing eval tracking.
        <CheckCircle className="w-3 h-3 text-green-500 inline mx-1" /> = eval submitted &nbsp;
        <XCircle className="w-3 h-3 text-red-400 inline mx-1" /> = missing
      </p>
    </div>
  );
};

export default MissingEvals;
