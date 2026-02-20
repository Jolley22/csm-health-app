export const scoringConfig = {
  base: 165,
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

export const getHealthLabel = (score) => {
  if (score === null) return 'Incomplete';
  const { thresholds } = scoringConfig;
  if (score > thresholds.high) return 'High';
  if (score > thresholds.low) return 'Medium';
  return 'Low';
};

export const calculateRawScore = (customer) => {
  const { metricPoints, metricWeights } = scoringConfig;
  let totalScore = 0;
  let hasMissingRequired = false;

  Object.keys(metricWeights).forEach(metric => {
    const value = customer[metric];
    const weight = metricWeights[metric];
    const isOptional = optionalMetrics.includes(metric);

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

  const { base, penaltyMultiplier, metricWeights } = scoringConfig;
  let penalties = 0;

  optionalMetrics.forEach(metric => {
    if (!customer[metric] || customer[metric] === '') {
      penalties += metricWeights[metric] * penaltyMultiplier;
    }
  });

  const weightedScore = (base / (base - penalties)) * rawScore;
  return { score: Math.round(weightedScore), label: getHealthLabel(weightedScore) };
};
