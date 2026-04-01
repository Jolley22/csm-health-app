import React, { useState } from 'react';
import { Plus, Trash2, Save, X, Edit2 } from 'lucide-react';
import { applyMetricsConfig } from './scoring';
import { supabase } from './supabaseClient';

export const DEFAULT_METRICS = [
  {
    key: 'toolsDeployed',
    label: 'Tools Deployed',
    description: 'Based on the tools the customer has purchased, which ones have actually been deployed.',
    weight: 1,
    isOptional: false,
    high: '0 of the tools purchased are implemented',
    medium: '1+ but not all purchased tools have been implemented',
    low: 'All purchased tools have been implemented'
  },
  {
    key: 'interactionChampion',
    label: 'Engagement with Champion',
    description: 'The level of engagement the champion is having with our team via email, text, meetings or any other communication.',
    weight: 3,
    isOptional: false,
    high: 'No contact with champion in last 6 months',
    medium: 'No contact with champion in the last 3 months',
    low: 'Contact with champion within the last 3 months'
  },
  {
    key: 'interactionDecisionMaker',
    label: 'Engagement with Decision Maker',
    description: 'The level of engagement the decision maker is having with our team via email, text, meetings or any other communication.',
    weight: 4,
    isOptional: false,
    high: 'No contact with decision maker in last 9 months',
    medium: 'No contact with decision maker in the last 6 months',
    low: 'Contact with decision maker in the last 6 months'
  },
  {
    key: 'daysActive',
    label: 'Days Active (30 Days)',
    description: 'The amount of usage (measured by applicant count) in their account.',
    weight: 3,
    isOptional: false,
    high: '0-4 Active Days in the last 30 days',
    medium: '5-14 Active Days in the last 30 days',
    low: '14+ Active Days in the last 30 days'
  },
  {
    key: 'roiEstablished',
    label: 'ROI',
    description: "This dimension tracks the customer business objectives and places an ROI on JF's help in those initiatives.",
    weight: 5,
    isOptional: false,
    high: "ROI hasn't been established",
    medium: "ROI has been established but hasn't been agreed to by budget holder or KDM",
    low: 'ROI has been established and has been agreed to by KDM and budget holders'
  },
  {
    key: 'championNPS',
    label: 'Champion/Decision Maker NPS',
    description: 'NPS survey sent to Champions automatically at the 6 month mark of the contract and manually sent or collected by JF team members where applicable.',
    weight: 5,
    isOptional: true,
    high: 'No score has been collected by a champion or score collected is ≤ 6',
    medium: 'Score has been collected and the score is 7-8',
    low: 'Score has been collected and the score is 9 or above'
  },
  {
    key: 'endUserNPS',
    label: 'End User NPS',
    description: 'NPS survey automatically sent to end users after completing implementation & 9 months.',
    weight: 2,
    isOptional: true,
    high: 'No score has been collected by an End User or score collected is ≤ 6',
    medium: 'Score has been collected and the score is 7-8',
    low: 'Score has been collected and the score is 9 or above'
  },
  {
    key: 'supportSurvey',
    label: 'End User Support Survey Score',
    description: "After an end-user's support ticket is resolved, they receive a Customer Experience survey (CES). Customers rate on a 1-7 scale.",
    weight: 1,
    isOptional: true,
    high: 'Avg CES score is ≤ 3',
    medium: 'Avg CES score is 4 or 5',
    low: 'Avg CES score is 6 or 7'
  },
  {
    key: 'sentiment',
    label: 'Sentiment',
    description: 'Objective measure of customer sentiment as assessed by the CSM and/or other JF Stakeholders who have interacted with the customer.',
    weight: 4,
    isOptional: false,
    high: 'Champion or decision-maker currently have negative sentiment about the partnership and product',
    medium: 'Champion or decision-maker are positive but others have expressed negative sentiment',
    low: 'All customers currently have positive sentiment towards the partnership and product'
  },
  {
    key: 'leadership',
    label: 'Leadership Change',
    description: 'Champion or decision maker change and their level of engagement/buy-in to the partnership.',
    weight: 5,
    isOptional: false,
    high: "Champion or decision maker change and not engaging or have concluded they're not bought in",
    medium: 'Champion or decision maker change and engaging with us (although not yet bought in)',
    low: 'No champion/KDM has changed OR 1 or both have changed but they are bought in to partnership and product'
  },
  {
    key: 'applicantCES',
    label: 'Applicant CES Score',
    description: "After an applicant's support ticket is resolved, they receive a Customer Experience survey (CES). Applicant rates their experience on a 1-7 rating scale.",
    weight: 1,
    isOptional: true,
    high: 'Average score is < 5',
    medium: 'Average score is > 5',
    low: 'Average score is > 5.75'
  }
];

const STORAGE_KEY = 'csm-metrics-config';

export function loadMetricsConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_METRICS;
}

async function persistAndApply(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  applyMetricsConfig(config);
  await supabase.from('app_settings').upsert(
    { key: 'metrics_config', value: config, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
}

const EMPTY_METRIC = {
  key: '',
  label: '',
  description: '',
  weight: 1,
  isOptional: false,
  high: '',
  medium: '',
  low: ''
};

const inputCls = 'w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400';
const cellCls = 'px-3 py-2 align-top border-b border-gray-200';

export default function MetricsConfig({ config, onChange }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [draft, setDraft] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState(EMPTY_METRIC);
  const [errors, setErrors] = useState({});

  const maxWeight = Math.max(...config.map(m => m.weight));

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setDraft({ ...config[idx] });
    setErrors({});
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setDraft(null);
    setErrors({});
  };

  const validate = (m, isNew = false) => {
    const errs = {};
    if (!m.label.trim()) errs.label = 'Required';
    if (isNew && !m.key.trim()) errs.key = 'Required';
    if (isNew && config.some(x => x.key === m.key.trim())) errs.key = 'Key already exists';
    if (!m.weight || isNaN(m.weight) || Number(m.weight) < 1) errs.weight = 'Must be ≥ 1';
    return errs;
  };

  const saveEdit = () => {
    const errs = validate(draft);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const next = config.map((m, i) => i === editingIdx ? { ...draft, weight: Number(draft.weight) } : m);
    onChange(next);
    persistAndApply(next);
    cancelEdit();
  };

  const deleteMetric = (idx) => {
    if (!window.confirm(`Remove "${config[idx].label}" from scoring?`)) return;
    const next = config.filter((_, i) => i !== idx);
    onChange(next);
    persistAndApply(next);
  };

  const saveNew = () => {
    const errs = validate(newDraft, true);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const next = [...config, { ...newDraft, key: newDraft.key.trim(), weight: Number(newDraft.weight) }];
    onChange(next);
    persistAndApply(next);
    setAddingNew(false);
    setNewDraft(EMPTY_METRIC);
    setErrors({});
  };

  const totalWeight = config.reduce((s, m) => s + Number(m.weight), 0);
  const maxScore = totalWeight * 5;

  const renderField = (val, field, draft, setDraftFn, textarea = false) => {
    const err = errors[field];
    const props = {
      value: draft[field] ?? '',
      onChange: e => setDraftFn(d => ({ ...d, [field]: e.target.value })),
      className: inputCls + (err ? ' border-red-400' : '')
    };
    return (
      <div>
        {textarea
          ? <textarea {...props} rows={3} className={props.className + ' resize-y'} />
          : <input {...props} type={field === 'weight' ? 'number' : 'text'} min={field === 'weight' ? 1 : undefined} />
        }
        {err && <div className="text-red-500 text-[10px] mt-0.5">{err}</div>}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Metrics Configuration</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {config.length} metrics · Total weight {totalWeight} · Max score {maxScore}
          </p>
        </div>
        <button
          onClick={() => { setAddingNew(true); setErrors({}); setNewDraft(EMPTY_METRIC); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Metric
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide w-40">Metric Name</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-red-600 uppercase tracking-wide">High Definition</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-yellow-600 uppercase tracking-wide">Medium Definition</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-green-600 uppercase tracking-wide">Low Definition</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-24">Weight</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide w-20">Optional</th>
              <th className="px-3 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {config.map((metric, idx) => {
              const isEditing = editingIdx === idx;
              const barWidth = maxWeight > 0 ? Math.round((metric.weight / maxWeight) * 100) : 0;

              return (
                <tr key={metric.key} className={isEditing ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {/* Metric Name */}
                  <td className={cellCls + ' min-w-[140px]'}>
                    {isEditing ? (
                      <div className="space-y-1">
                        {renderField(draft.label, 'label', draft, setDraft)}
                        <input
                          value={draft.key}
                          disabled
                          className="w-full border border-gray-200 rounded px-2 py-1 text-[10px] bg-gray-100 text-gray-400"
                          title="Field key (read-only)"
                        />
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium text-gray-900">{metric.label}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5 font-mono">{metric.key}</div>
                      </div>
                    )}
                  </td>

                  {/* High */}
                  <td className={cellCls + ' min-w-[180px]'}>
                    {isEditing
                      ? renderField(draft.high, 'high', draft, setDraft, true)
                      : <span className="text-xs text-gray-700">{metric.high}</span>}
                  </td>

                  {/* Medium */}
                  <td className={cellCls + ' min-w-[180px]'}>
                    {isEditing
                      ? renderField(draft.medium, 'medium', draft, setDraft, true)
                      : <span className="text-xs text-gray-700">{metric.medium}</span>}
                  </td>

                  {/* Low */}
                  <td className={cellCls + ' min-w-[180px]'}>
                    {isEditing
                      ? renderField(draft.low, 'low', draft, setDraft, true)
                      : <span className="text-xs text-gray-700">{metric.low}</span>}
                  </td>

                  {/* Weight */}
                  <td className={cellCls + ' text-center'}>
                    {isEditing ? (
                      renderField(draft.weight, 'weight', draft, setDraft)
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-gray-900">{metric.weight}</span>
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${barWidth}%` }} />
                        </div>
                      </div>
                    )}
                  </td>

                  {/* Optional */}
                  <td className={cellCls + ' text-center'}>
                    {isEditing ? (
                      <input
                        type="checkbox"
                        checked={!!draft.isOptional}
                        onChange={e => setDraft(d => ({ ...d, isOptional: e.target.checked }))}
                        className="w-4 h-4 accent-blue-600"
                      />
                    ) : (
                      <span className={`text-xs font-medium ${metric.isOptional ? 'text-gray-400' : 'text-blue-700'}`}>
                        {metric.isOptional ? 'opt' : 'req'}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className={cellCls + ' text-center'}>
                    {isEditing ? (
                      <div className="flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={cancelEdit} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => startEdit(idx)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMetric(idx)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {/* Add New Row */}
            {addingNew && (
              <tr className="bg-green-50 border-t-2 border-green-200">
                <td className={cellCls + ' min-w-[140px]'}>
                  <div className="space-y-1">
                    {renderField(newDraft.label, 'label', newDraft, setNewDraft)}
                    <div>
                      <input
                        placeholder="fieldKey (camelCase)"
                        value={newDraft.key}
                        onChange={e => setNewDraft(d => ({ ...d, key: e.target.value }))}
                        className={inputCls + (errors.key ? ' border-red-400' : '')}
                      />
                      {errors.key && <div className="text-red-500 text-[10px] mt-0.5">{errors.key}</div>}
                    </div>
                  </div>
                </td>
                <td className={cellCls}>{renderField(newDraft.high, 'high', newDraft, setNewDraft, true)}</td>
                <td className={cellCls}>{renderField(newDraft.medium, 'medium', newDraft, setNewDraft, true)}</td>
                <td className={cellCls}>{renderField(newDraft.low, 'low', newDraft, setNewDraft, true)}</td>
                <td className={cellCls + ' text-center'}>{renderField(newDraft.weight, 'weight', newDraft, setNewDraft)}</td>
                <td className={cellCls + ' text-center'}>
                  <input
                    type="checkbox"
                    checked={!!newDraft.isOptional}
                    onChange={e => setNewDraft(d => ({ ...d, isOptional: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600"
                  />
                </td>
                <td className={cellCls + ' text-center'}>
                  <div className="flex gap-1 justify-center">
                    <button onClick={saveNew} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Add">
                      <Save className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setAddingNew(false); setErrors({}); }} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 rounded-b-lg">
        Changes apply immediately to health score calculations. Weight determines how heavily each metric influences the overall score (higher = more impact). Optional metrics adjust the score if not collected.
      </div>
    </div>
  );
}
