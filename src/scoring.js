export const scoringConfig = {
  penaltyMultiplier: 5,
  thresholds: { high: 130, low: 60 },
  metricPoints: { high: 5, medium: 3, low: 1 },
  metricWeights: {
    toolsDeployed: 1,
    interactionChampion: 3,
    interactionDecisionMaker: 4,
    daysActive: 3,
    roiEstablished: 5,
    championNPS: 5,
    endUserNPS: 2,
    supportSurvey: 1,
    sentiment: 4,
    leadership: 5,
    applicantCES: 1
  }
};

export const optionalMetrics = ['championNPS', 'endUserNPS', 'supportSurvey', 'applicantCES'];

// Dynamic config — overridden at runtime when the user edits metrics
let _weights = null;
let _optionalMetrics = null;

export const applyMetricsConfig = (metricsArray) => {
  _weights = {};
  _optionalMetrics = [];
  metricsArray.forEach(m => {
    _weights[m.key] = Number(m.weight) || 1;
    if (m.isOptional) _optionalMetrics.push(m.key);
  });
};

export const getHealthLabel = (score) => {
  if (score === null) return 'Incomplete';
  const { thresholds } = scoringConfig;
  if (score > thresholds.high) return 'High';
  if (score > thresholds.low) return 'Medium';
  return 'Low';
};

export const calculateRawScore = (customer) => {
  const { metricPoints } = scoringConfig;
  const weights = _weights || scoringConfig.metricWeights;
  const optMetrics = _optionalMetrics || optionalMetrics;
  let totalScore = 0;
  let hasMissingRequired = false;

  Object.keys(weights).forEach(metric => {
    const value = customer[metric];
    const weight = weights[metric];
    const isOptional = optMetrics.includes(metric);

    if (!value || value === '') {
      if (!isOptional) hasMissingRequired = true;
    } else {
      const points = metricPoints[value.toLowerCase()] || 0;
      totalScore += points * weight;
    }
  });

  return hasMissingRequired ? null : totalScore;
};

export const calculateWeightedRiskScore = (customer) => {
  const rawScore = calculateRawScore(customer);
  if (rawScore === null) return { score: null, label: 'Incomplete' };

  const { penaltyMultiplier, metricPoints } = scoringConfig;
  const weights = _weights || scoringConfig.metricWeights;
  const optMetrics = _optionalMetrics || optionalMetrics;

  // Base = max possible raw score given current weights
  const base = Object.values(weights).reduce((sum, w) => sum + w * metricPoints.high, 0);

  let penalties = 0;
  optMetrics.forEach(metric => {
    if (!customer[metric] || customer[metric] === '') {
      penalties += (weights[metric] || 0) * penaltyMultiplier;
    }
  });

  const divisor = base - penalties;
  if (divisor <= 0) return { score: 0, label: getHealthLabel(0) };
  const weightedScore = (base / divisor) * rawScore;
  return { score: Math.round(weightedScore), label: getHealthLabel(weightedScore) };
};
