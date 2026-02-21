import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, TrendingUp, TrendingDown, AlertCircle, Search, X, Settings, Send, ExternalLink, Copy, Check, CheckCircle, Save, History, LogOut, Upload, BarChart2, Users } from 'lucide-react';
import CSVImport from './CSVImport';
import Dashboard from './Dashboard';
import UserManagement from './UserManagement';
import { optionalMetrics, calculateWeightedRiskScore } from './scoring';

const CustomerHealthTracker = ({ session, userProfile, onSignOut }) => {
  const isAdmin = userProfile?.role === 'admin';
  const currentCSMName = userProfile?.csm_name || null;
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSegment, setFilterSegment] = useState('all');
  const [filterCSM, setFilterCSM] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [, setExpandedMetrics] = useState({});
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyLinks, setSurveyLinks] = useState({});
  const [copiedLink, setCopiedLink] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState('customers');

  // Survey mode state
  const [surveyMode, setSurveyMode] = useState(false);
  const [surveyCSM, setSurveyCSM] = useState('');
  const [surveyResponses, setSurveyResponses] = useState({});
  const [currentCustomerIndex, setCurrentCustomerIndex] = useState(0);
  const [surveyComplete, setSurveyComplete] = useState(false);

  const segments = ['1', '2', '3', '4'];
  const csms = ['Brooke', 'Natalie', 'Ryan', 'Jasmin', 'Jake', 'Jessica', 'Cody', 'Emmalyn'];
  const ratingOptions = ['High', 'Medium', 'Low'];

  const [formData, setFormData] = useState({
    name: '', segment: '', csm: '', toolsDeployed: '', interactionChampion: '',
    interactionDecisionMaker: '', daysActive: '', roiEstablished: '', championNPS: '',
    endUserNPS: '', supportSurvey: '', sentiment: '', leadership: '', applicantCES: '', notes: '', isActive: true
  });

  const metricLabels = {
    toolsDeployed: 'Tools Deployed',
    interactionChampion: 'Engagement with Champion',
    interactionDecisionMaker: 'Engagement with Decision Maker',
    daysActive: 'Days Active (30 Days)',
    roiEstablished: 'ROI',
    championNPS: 'Champion/Decision Maker NPS',
    endUserNPS: 'End User NPS',
    supportSurvey: 'End User Support Survey Score',
    sentiment: 'Sentiment',
    leadership: 'Leadership Change',
    applicantCES: 'Applicant CES Score'
  };

  const metricDescriptions = {
    toolsDeployed: 'Based on the tools the customer has purchased, which ones have actually been deployed.',
    interactionChampion: 'The level of engagement the champion is having with our team via email, text, meetings or any other communication.',
    interactionDecisionMaker: 'The level of engagement the decision maker is having with our team via email, text, meetings or any other communication.',
    daysActive: 'The amount of usage (measured by applicant count) in their account.',
    roiEstablished: 'This dimension tracks the customer business objectives and places an ROI on JF\'s help in those initiatives. Can be Economic ROI (improving revenue/reducing costs), Ease of Doing Business (more efficient operations), or Innovation of Process (key part of major company initiative).',
    championNPS: 'NPS survey sent to Champions automatically at the 6 month mark of the contract and manually sent or collected by JF team members where applicable.',
    endUserNPS: 'NPS survey automatically sent to end users after completing implementation & 9 months.',
    supportSurvey: 'After an end-user\'s support ticket is resolved, they receive a Customer Experience survey (CES), measuring the ease with which the customer was able to resolve a support issue, use our product or service, or find the information they needed. Customers rate on a 1-7 scale.',
    sentiment: 'Objective measure of customer sentiment as assessed by the CSM and/or other JF Stakeholders who have interacted with the customer.',
    leadership: 'Champion or decision maker change and their level of engagement/buy-in to the partnership.',
    applicantCES: 'After an applicant\'s support ticket is resolved, they receive a Customer Experience survey (CES), measuring the ease with which they were able to resolve a support issue, use our product or service, or find the information they needed. Applicant rates their experience on a 1-7 rating scale.'
  };

  const metricGuidelines = {
    toolsDeployed: {
      high: '0 of the tools purchased are implemented',
      medium: '1+ but not all purchased tools have been implemented',
      low: 'All purchased tools have been implemented'
    },
    interactionChampion: {
      high: 'No contact with champion in last 6 months',
      medium: 'No contact with champion in the last 3 months',
      low: 'Contact with champion within the last 3 months'
    },
    interactionDecisionMaker: {
      high: 'No contact with decision maker in last 9 months',
      medium: 'No contact with decision maker in the last 6 months',
      low: 'Contact with decision maker in the last 6 months'
    },
    daysActive: {
      high: '0-4 Active Days in the last 30 days',
      medium: '5-14 Active Days in the last 30 days',
      low: '14+ Active Days in the last 30 days'
    },
    roiEstablished: {
      high: 'ROI hasn\'t been established',
      medium: 'ROI has been established but hasn\'t been agreed to by budget holder or KDM',
      low: 'ROI has been established and has been agreed to by KDM and budget holders'
    },
    championNPS: {
      high: 'No score has been collected by a champion or score collected is ≤ 6',
      medium: 'Score has been collected and the score is 7-8',
      low: 'Score has been collected and the score is 9 or above'
    },
    endUserNPS: {
      high: 'No score has been collected by an End User or score collected is ≤ 6',
      medium: 'Score has been collected and the score is 7-8',
      low: 'Score has been collected and the score is 9 or above'
    },
    supportSurvey: {
      high: 'Avg CES score is ≤ 3',
      medium: 'Avg CES score is 4 or 5',
      low: 'Avg CES score is 6 or 7'
    },
    sentiment: {
      high: 'Champion or decision-maker currently have negative sentiment about the partnership and product',
      medium: 'Champion or decision-maker are positive but others have expressed negative sentiment',
      low: 'All customers currently have positive sentiment towards the partnership and product'
    },
    leadership: {
      high: 'Champion or decision maker change and not engaging or have concluded they\'re not bought in',
      medium: 'Champion or decision maker change and engaging with us (although not yet bought in)',
      low: 'No champion/KDM has changed OR 1 or both have changed but they are bought in to partnership and product'
    },
    applicantCES: {
      high: 'Average score is < 5',
      medium: 'Average score is > 5',
      low: 'Average score is > 5.75'
    }
  };

  // Load customers from Supabase
  const loadCustomers = async () => {
    try {
      setLoading(true);
      let query = supabase.from('customers').select('*').order('name');
      // CSMs only see their assigned customers (also enforced by RLS)
      if (!isAdmin && currentCSMName) {
        query = query.eq('csm', currentCSMName);
      }
      const { data, error } = await query;

      if (error) throw error;

      // Transform database format to app format
      const transformedData = await Promise.all(data.map(async (customer) => {
        // Load history for each customer
        const { data: historyData } = await supabase
          .from('customer_history')
          .select('*')
          .eq('customer_id', customer.id)
          .order('snapshot_date', { ascending: false });

        return {
          id: customer.id,
          name: customer.name,
          segment: customer.segment,
          csm: customer.csm,
          toolsDeployed: customer.tools_deployed,
          interactionChampion: customer.interaction_champion,
          interactionDecisionMaker: customer.interaction_decision_maker,
          daysActive: customer.days_active,
          roiEstablished: customer.roi_established,
          championNPS: customer.champion_nps,
          endUserNPS: customer.end_user_nps,
          supportSurvey: customer.support_survey,
          sentiment: customer.sentiment,
          leadership: customer.leadership,
          applicantCES: customer.applicant_ces,
          notes: customer.notes,
          isActive: customer.is_active !== false,
          history: historyData ? historyData.map(h => ({
            date: new Date(h.snapshot_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
            toolsDeployed: h.tools_deployed,
            interactionChampion: h.interaction_champion,
            interactionDecisionMaker: h.interaction_decision_maker,
            daysActive: h.days_active,
            roiEstablished: h.roi_established,
            championNPS: h.champion_nps,
            endUserNPS: h.end_user_nps,
            supportSurvey: h.support_survey,
            sentiment: h.sentiment,
            leadership: h.leadership,
            applicantCES: h.applicant_ces
          })) : []
        };
      }));

      setCustomers(transformedData);
    } catch (error) {
      console.error('Error loading customers:', error);
      alert('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();

    // Check URL for survey mode - support both hash (#survey) and query param (?survey)
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);

    // Check query parameters first (for Slack links)
    if (searchParams.get('survey') !== null || searchParams.get('csm')) {
      const csm = searchParams.get('csm');
      if (csm) {
        setSurveyCSM(csm);
        setSurveyMode(true);
      }
    }
    // Fall back to hash-based URLs (for in-app generated links)
    else if (hash.includes('survey')) {
      const params = new URLSearchParams(hash.split('?')[1]);
      const csm = params.get('csm');

      if (csm) {
        setSurveyCSM(csm);
        setSurveyMode(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    if (surveyMode && customers.length > 0) {
      const csmCustomers = customers.filter(c => c.csm === surveyCSM);
      const responses = {};
      csmCustomers.forEach(c => {
        responses[c.id] = {
          toolsDeployed: c.toolsDeployed || '',
          interactionChampion: c.interactionChampion || '',
          interactionDecisionMaker: c.interactionDecisionMaker || '',
          daysActive: c.daysActive || '',
          roiEstablished: c.roiEstablished || '',
          championNPS: c.championNPS || '',
          endUserNPS: c.endUserNPS || '',
          supportSurvey: c.supportSurvey || '',
          sentiment: c.sentiment || '',
          leadership: c.leadership || '',
          applicantCES: c.applicantCES || '',
          notes: c.notes || ''
        };
      });
      setSurveyResponses(responses);
    }
  }, [surveyMode, customers, surveyCSM]);

  const getHealthStatus = (label) => {
    if (label === 'Incomplete') return { label: 'Incomplete', color: 'bg-gray-100 text-gray-700', dotColor: 'bg-gray-400', icon: AlertCircle };
    if (label === 'High') return { label: 'High', color: 'bg-red-100 text-red-800', dotColor: 'bg-red-500', icon: TrendingDown };
    if (label === 'Medium') return { label: 'Medium', color: 'bg-yellow-100 text-yellow-800', dotColor: 'bg-yellow-500', icon: AlertCircle };
    return { label: 'Low', color: 'bg-green-100 text-green-800', dotColor: 'bg-green-500', icon: TrendingUp };
  };

  const generateSurveyLinks = () => {
    const links = {};
    const baseUrl = window.location.origin + window.location.pathname;

    csms.forEach(csm => {
      const csmCustomers = customers.filter(c => c.csm === csm && c.isActive !== false);
      if (csmCustomers.length > 0) {
        const customerIds = csmCustomers.map(c => c.id).join(',');
        links[csm] = `${baseUrl}#survey?csm=${encodeURIComponent(csm)}&customers=${customerIds}`;
      }
    });

    setSurveyLinks(links);
    setShowSurveyModal(true);
  };

  const copyToClipboard = (text, csm) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLink(csm);
      setTimeout(() => setCopiedLink(null), 2000);
    });
  };

  // Survey mode functions
  const getSurveyCustomers = () => {
    return customers.filter(c => c.csm === surveyCSM && c.isActive !== false);
  };

  const handleSurveyMetricChange = (customerId, metric, value) => {
    setSurveyResponses(prev => ({
      ...prev,
      [customerId]: {
        ...prev[customerId],
        [metric]: value
      }
    }));
  };

  const submitSurvey = async () => {
    try {
      // Update all customers in the survey
      for (const customerId of Object.keys(surveyResponses)) {
        const responses = surveyResponses[customerId];

        // Update customer record
        const { error: updateError } = await supabase
          .from('customers')
          .update({
            tools_deployed: responses.toolsDeployed,
            interaction_champion: responses.interactionChampion,
            interaction_decision_maker: responses.interactionDecisionMaker,
            days_active: responses.daysActive,
            roi_established: responses.roiEstablished,
            champion_nps: responses.championNPS,
            end_user_nps: responses.endUserNPS,
            support_survey: responses.supportSurvey,
            sentiment: responses.sentiment,
            leadership: responses.leadership,
            applicant_ces: responses.applicantCES,
            notes: responses.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', customerId);

        if (updateError) throw updateError;

        // Create history snapshot
        const { error: historyError } = await supabase
          .from('customer_history')
          .insert({
            customer_id: customerId,
            user_id: session.user.id,
            snapshot_date: new Date().toISOString().split('T')[0],
            tools_deployed: responses.toolsDeployed,
            interaction_champion: responses.interactionChampion,
            interaction_decision_maker: responses.interactionDecisionMaker,
            days_active: responses.daysActive,
            roi_established: responses.roiEstablished,
            champion_nps: responses.championNPS,
            end_user_nps: responses.endUserNPS,
            support_survey: responses.supportSurvey,
            sentiment: responses.sentiment,
            leadership: responses.leadership,
            applicant_ces: responses.applicantCES
          });

        if (historyError) throw historyError;
      }

      setSurveyComplete(true);
      await loadCustomers(); // Reload data
    } catch (error) {
      console.error('Error submitting survey:', error);
      alert('Failed to submit survey. Please try again.');
    }
  };

  const exitSurvey = () => {
    window.location.hash = '';
    setSurveyMode(false);
    setSurveyCSM('');
    setCurrentCustomerIndex(0);
    setSurveyComplete(false);
  };

  // Survey mode rendering
  if (surveyMode) {
    const surveyCustomers = getSurveyCustomers();
    const currentCustomer = surveyCustomers[currentCustomerIndex];
    const completedCount = surveyCustomers.filter(c => {
      const responses = surveyResponses[c.id];
      if (!responses) return false;
      const requiredMetrics = Object.keys(metricLabels).filter(m => !optionalMetrics.includes(m));
      return requiredMetrics.every(metric => responses[metric] && responses[metric] !== '');
    }).length;

    if (surveyComplete) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Survey Complete!</h1>
            <p className="text-gray-600 mb-6">
              Thank you for updating the health scores for your {surveyCustomers.length} customer{surveyCustomers.length !== 1 ? 's' : ''}.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Your responses have been saved to the database.
            </p>
            <button
              onClick={exitSurvey}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    if (!currentCustomer) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
            <p className="text-gray-600">No customers found for this survey.</p>
            <button onClick={exitSurvey} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    // Spreadsheet-style survey UI
    const requiredMetrics = Object.keys(metricLabels).filter(m => !optionalMetrics.includes(m));
    const allMetrics = Object.keys(metricLabels);

    const getRatingButtonClass = (customerId, metric, option) => {
      const responses = surveyResponses[customerId] || {};
      const isSelected = responses[metric] === option;

      if (isSelected) {
        if (option === 'High') return 'bg-red-500 text-white border-red-500';
        if (option === 'Medium') return 'bg-yellow-500 text-white border-yellow-500';
        return 'bg-green-500 text-white border-green-500';
      }
      return 'bg-white text-gray-600 border-gray-300 hover:border-gray-400';
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
        <div className="max-w-full mx-auto">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Customer Health Score Survey</h1>
                <p className="text-gray-600">CSM: {surveyCSM} • {surveyCustomers.length} customers • {completedCount} completed</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  <span className="inline-block w-3 h-3 rounded bg-green-500 mr-1"></span> Low Risk
                  <span className="inline-block w-3 h-3 rounded bg-yellow-500 mx-1 ml-3"></span> Medium
                  <span className="inline-block w-3 h-3 rounded bg-red-500 mx-1 ml-3"></span> High Risk
                </div>
                <button
                  onClick={exitSurvey}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Spreadsheet */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-b border-r border-gray-200 sticky left-0 bg-gray-100 z-10 min-w-[180px]">
                      Customer
                    </th>
                    {allMetrics.map(metric => (
                      <th
                        key={metric}
                        className="px-2 py-2 text-center text-xs font-semibold text-gray-700 border-b border-r border-gray-200 min-w-[100px]"
                        title={metricDescriptions[metric]}
                      >
                        <div className="truncate">
                          {metricLabels[metric].split(' ').slice(0, 2).join(' ')}
                        </div>
                        {optionalMetrics.includes(metric) && (
                          <span className="text-gray-400 font-normal text-[10px]">(opt)</span>
                        )}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 border-b border-gray-200 min-w-[80px]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {surveyCustomers.map((customer, idx) => {
                    const responses = surveyResponses[customer.id] || {};
                    const isComplete = requiredMetrics.every(m => responses[m] && responses[m] !== '');

                    return (
                      <tr key={customer.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className={`px-3 py-2 border-b border-r border-gray-200 sticky left-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} z-10`}>
                          <div className="font-medium text-gray-900 text-sm truncate" title={customer.name}>
                            {customer.name}
                          </div>
                          <div className="text-xs text-gray-500">Seg {customer.segment || '-'}</div>
                        </td>
                        {allMetrics.map(metric => (
                          <td key={metric} className="px-1 py-1 border-b border-r border-gray-200">
                            <div className="flex gap-1 justify-center">
                              {ratingOptions.map(option => (
                                <button
                                  key={option}
                                  onClick={() => handleSurveyMetricChange(customer.id, metric, option)}
                                  className={`w-7 h-7 text-xs font-bold rounded border transition-all ${getRatingButtonClass(customer.id, metric, option)}`}
                                  title={`${option}: ${metricGuidelines[metric][option.toLowerCase()]}`}
                                >
                                  {option[0]}
                                </button>
                              ))}
                            </div>
                          </td>
                        ))}
                        <td className="px-2 py-2 border-b border-gray-200 text-center">
                          {isComplete ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer with Submit */}
          <div className="bg-white rounded-lg shadow-md p-4 mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{completedCount}</span> of <span className="font-medium">{surveyCustomers.length}</span> customers completed
              {completedCount < surveyCustomers.length && (
                <span className="text-amber-600 ml-2">• Complete all required fields (H/M/L) to submit</span>
              )}
            </div>
            <button
              onClick={submitSurvey}
              disabled={completedCount < surveyCustomers.length}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Save className="w-4 h-4" />
              Submit Survey
            </button>
          </div>

          {/* Legend */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4 text-xs text-blue-800">
            <strong>Quick Guide:</strong> Click H (High Risk), M (Medium), or L (Low Risk) for each metric.
            Hover over column headers or buttons for descriptions. Green checkmark = all required fields complete.
          </div>
        </div>
      </div>
    );
  }

  // Regular dashboard mode code continues...
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name) return;

    try {
      if (editingCustomer) {
        // Update existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: formData.name,
            segment: formData.segment,
            csm: formData.csm,
            tools_deployed: formData.toolsDeployed,
            interaction_champion: formData.interactionChampion,
            interaction_decision_maker: formData.interactionDecisionMaker,
            days_active: formData.daysActive,
            roi_established: formData.roiEstablished,
            champion_nps: formData.championNPS,
            end_user_nps: formData.endUserNPS,
            support_survey: formData.supportSurvey,
            sentiment: formData.sentiment,
            leadership: formData.leadership,
            notes: formData.notes,
            is_active: formData.isActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingCustomer.id);

        if (error) throw error;
        setEditingCustomer(null);
      } else {
        // Create new customer
        const { error } = await supabase
          .from('customers')
          .insert({
            user_id: session.user.id,
            name: formData.name,
            segment: formData.segment,
            csm: formData.csm,
            tools_deployed: formData.toolsDeployed,
            interaction_champion: formData.interactionChampion,
            interaction_decision_maker: formData.interactionDecisionMaker,
            days_active: formData.daysActive,
            roi_established: formData.roiEstablished,
            champion_nps: formData.championNPS,
            end_user_nps: formData.endUserNPS,
            support_survey: formData.supportSurvey,
            sentiment: formData.sentiment,
            leadership: formData.leadership,
            notes: formData.notes,
            is_active: formData.isActive
          });

        if (error) throw error;
      }

      // Reset form
      setFormData({
        name: '', segment: '', csm: '', toolsDeployed: '', interactionChampion: '',
        interactionDecisionMaker: '', daysActive: '', roiEstablished: '', championNPS: '',
        endUserNPS: '', supportSurvey: '', sentiment: '', leadership: '', applicantCES: '', notes: '', isActive: true
      });
      setShowAddForm(false);

      // Reload customers
      await loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Failed to save customer. Please try again.');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      segment: customer.segment,
      csm: customer.csm,
      toolsDeployed: customer.toolsDeployed,
      interactionChampion: customer.interactionChampion,
      interactionDecisionMaker: customer.interactionDecisionMaker,
      daysActive: customer.daysActive,
      roiEstablished: customer.roiEstablished,
      championNPS: customer.championNPS,
      endUserNPS: customer.endUserNPS,
      supportSurvey: customer.supportSurvey,
      sentiment: customer.sentiment,
      leadership: customer.leadership,
      applicantCES: customer.applicantCES,
      notes: customer.notes,
      isActive: customer.isActive !== false
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', id);

        if (error) throw error;
        await loadCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
        alert('Failed to delete customer. Please try again.');
      }
    }
  };

  // eslint-disable-next-line no-unused-vars
  const toggleMetricsExpand = (customerId) => {
    setExpandedMetrics(prev => ({ ...prev, [customerId]: !prev[customerId] }));
  };

  const viewCustomerHistory = (customer) => {
    setSelectedCustomerHistory(customer);
    setShowHistoryModal(true);
  };

  const getMetricColor = (value) => {
    if (value === 'High') return 'bg-red-100 text-red-800';
    if (value === 'Medium') return 'bg-yellow-100 text-yellow-800';
    if (value === 'Low') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-gray-600">Loading customers...</div>
      </div>
    );
  }

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.csm && customer.csm.toLowerCase().includes(searchTerm.toLowerCase()));
    const { label } = calculateWeightedRiskScore(customer);
    const matchesFilter = filterStatus === 'all' || label.toLowerCase() === filterStatus.toLowerCase();
    const matchesSegment = filterSegment === 'all' || customer.segment === filterSegment;
    const matchesCSM = filterCSM === 'all' || customer.csm === filterCSM;
    const matchesActive = filterActive === 'all' || (filterActive === 'active' ? customer.isActive !== false : customer.isActive === false);
    return matchesSearch && matchesFilter && matchesSegment && matchesCSM && matchesActive;
  });

  const stats = {
    total: customers.filter(c => c.isActive !== false).length,
    high: customers.filter(c => c.isActive !== false && calculateWeightedRiskScore(c).label === 'High').length,
    medium: customers.filter(c => c.isActive !== false && calculateWeightedRiskScore(c).label === 'Medium').length,
    low: customers.filter(c => c.isActive !== false && calculateWeightedRiskScore(c).label === 'Low').length,
    incomplete: customers.filter(c => c.isActive !== false && calculateWeightedRiskScore(c).label === 'Incomplete').length,
  };

  const activeCustomers = customers.filter(c => c.isActive !== false);
  const avgScore = activeCustomers.length > 0
    ? Math.round(activeCustomers.reduce((acc, c) => {
      const result = calculateWeightedRiskScore(c);
      return acc + (result.score || 0);
    }, 0) / activeCustomers.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Customer Health Score Dashboard</h1>
            <p className="text-gray-600 flex items-center gap-2 flex-wrap">
              Logged in as {session.user.email}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
              }`}>{isAdmin ? 'Admin' : 'CSM'}</span>
              {!isAdmin && currentCSMName && <span className="text-gray-500">({currentCSMName})</span>}
            </p>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
            )}
            {isAdmin && (
              <button
                onClick={generateSurveyLinks}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Send className="w-4 h-4" />
                Generate Survey Links
              </button>
            )}
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg shadow p-1 w-fit">
          <button
            onClick={() => setActiveTab('customers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'customers'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            Customers
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Dashboard
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Users className="w-4 h-4" />
              Users
            </button>
          )}
        </div>

        {showSurveyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">CSM Survey Links</h2>
                <button onClick={() => setShowSurveyModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-blue-800">
                  <strong>Instructions:</strong> Share these unique links with each CSM. They'll complete a simple form to rate the 10 health metrics for their assigned customers.
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(surveyLinks).map(([csm, link]) => {
                  const customerCount = customers.filter(c => c.csm === csm).length;
                  return (
                    <div key={csm} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">{csm}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            {customerCount} customer{customerCount !== 1 ? 's' : ''}
                          </div>
                          <div className="bg-gray-50 p-2 rounded text-xs font-mono break-all text-gray-700">
                            {link}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(link, csm)}
                            className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm whitespace-nowrap"
                          >
                            {copiedLink === csm ? (
                              <>
                                <Check className="w-4 h-4 text-green-600" />
                                <span className="text-green-600">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                Copy
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setSurveyCSM(csm);
                              setSurveyMode(true);
                              setShowSurveyModal(false);
                              setCurrentCustomerIndex(0);
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm whitespace-nowrap"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowSurveyModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showHistoryModal && selectedCustomerHistory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 max-w-7xl w-full my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCustomerHistory.name} - Health Score History</h2>
                  <p className="text-gray-600">Segment {selectedCustomerHistory.segment} • CSM: {selectedCustomerHistory.csm}</p>
                </div>
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 sticky left-0 bg-gray-100 z-10">Metric</th>
                      {selectedCustomerHistory.history && [...selectedCustomerHistory.history].reverse().map((entry, idx) => (
                        <th key={idx} className="border border-gray-300 px-4 py-2 text-center text-sm font-semibold text-gray-700">
                          {entry.date}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(metricLabels).map(metric => (
                      <tr key={metric} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-3 text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">
                          {metricLabels[metric]}
                        </td>
                        {selectedCustomerHistory.history && [...selectedCustomerHistory.history].reverse().map((entry, idx) => {
                          const value = entry[metric] || '-';
                          const colorClass = getMetricColor(value);
                          return (
                            <td key={idx} className="border border-gray-300 px-4 py-3 text-center">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
                                {value}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="border border-gray-300 px-4 py-3 text-sm text-gray-900 sticky left-0 bg-gray-50 z-10">
                        Health Score
                      </td>
                      {selectedCustomerHistory.history && [...selectedCustomerHistory.history].reverse().map((entry, idx) => {
                        const tempCustomer = { ...selectedCustomerHistory, ...entry };
                        const { score } = calculateWeightedRiskScore(tempCustomer);
                        return (
                          <td key={idx} className="border border-gray-300 px-4 py-3 text-center">
                            <span className="text-lg font-bold text-blue-600">
                              {score !== null ? score : '-'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowHistoryModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard customers={customers} />
        )}

        {activeTab === 'users' && isAdmin && (
          <UserManagement currentUserId={session.user.id} />
        )}

        {activeTab === 'customers' && <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-5">
            <div className="text-sm text-gray-600 mb-1">Total Customers</div>
            <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="text-sm text-gray-600 mb-1">Avg Score</div>
            <div className="text-3xl font-bold text-blue-600">{avgScore}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <div className="text-sm text-gray-600">High</div>
            </div>
            <div className="text-3xl font-bold text-green-600">{stats.high}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="text-sm text-gray-600">Medium</div>
            </div>
            <div className="text-3xl font-bold text-yellow-600">{stats.medium}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="text-sm text-gray-600">Low</div>
            </div>
            <div className="text-3xl font-bold text-red-600">{stats.low}</div>
          </div>
        </div>

        {isAdmin && showImport && (
          <CSVImport
            userId={session.user.id}
            onImportComplete={() => {
              loadCustomers();
              setShowImport(false);
            }}
          />
        )}

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-5 border-b border-gray-200">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search customers or CSM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="all">All Health</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                  <option value="incomplete">Incomplete</option>
                </select>
                <select value={filterSegment} onChange={(e) => setFilterSegment(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="all">All Segments</option>
                  {segments.map(seg => (<option key={seg} value={seg}>Segment {seg}</option>))}
                </select>
                {isAdmin && (
                  <select value={filterCSM} onChange={(e) => setFilterCSM(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                    <option value="all">All CSMs</option>
                    {csms.map(csm => (<option key={csm} value={csm}>{csm}</option>))}
                  </select>
                )}
                <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm">
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
                <button
                  onClick={() => {
                    setEditingCustomer(null);
                    setFormData({
                      name: '', segment: '', csm: isAdmin ? '' : (currentCSMName || ''), toolsDeployed: '', interactionChampion: '',
                      interactionDecisionMaker: '', daysActive: '', roiEstablished: '', championNPS: '',
                      endUserNPS: '', supportSurvey: '', sentiment: '', leadership: '', applicantCES: '', notes: '', isActive: true
                    });
                    setShowAddForm(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Customer
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Customer</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Segment</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase">CSM</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Health Score</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map(customer => {
                  const { score, label } = calculateWeightedRiskScore(customer);
                  const status = getHealthStatus(label);

                  return (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">{customer.name}</div>
                      </td>
                      <td className="px-5 py-4"><span className="text-sm text-gray-700">{customer.segment || '-'}</span></td>
                      <td className="px-5 py-4"><span className="text-sm text-gray-700">{customer.csm || '-'}</span></td>
                      <td className="px-5 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${customer.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                          {customer.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-lg font-bold text-gray-900">{score !== null ? score : '-'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`}></div>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => viewCustomerHistory(customer)} className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center gap-1">
                            <History className="w-4 h-4" />
                            History
                          </button>
                          <button onClick={() => handleEdit(customer)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">Edit</button>
                          <button onClick={() => handleDelete(customer.id)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No customers found.</p>
            </div>
          )}
        </div>

        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full my-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
                <button onClick={() => { setShowAddForm(false); setEditingCustomer(null); }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Segment</label>
                  <select name="segment" value={formData.segment} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    <option value="">Select segment</option>
                    {segments.map(seg => (<option key={seg} value={seg}>{seg}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CSM</label>
                  {isAdmin ? (
                    <select name="csm" value={formData.csm} onChange={handleInputChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Select CSM</option>
                      {csms.map(csm => (<option key={csm} value={csm}>{csm}</option>))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={currentCSMName || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                    />
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    Active Customer
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Inactive customers won't appear in survey links</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="3" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 mt-4 border-t">
                <button onClick={() => { setShowAddForm(false); setEditingCustomer(null); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingCustomer ? 'Update' : 'Add'} Customer</button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <div className="flex items-start gap-2">
            <Settings className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-blue-900 mb-1">Monthly Survey Workflow</div>
              <div className="text-blue-800 space-y-1">
                <div>1. Click "Generate Survey Links" to create unique URLs for each CSM</div>
                <div>2. Share links via email or Slack - CSMs complete a guided form</div>
                <div>3. CSMs rate 10 metrics (High/Medium/Low) for each customer</div>
                <div>4. Responses auto-save to database with historical tracking</div>
              </div>
            </div>
          </div>
        </div>
        </>}
      </div>
    </div>
  );
};

export default CustomerHealthTracker;