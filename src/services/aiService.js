const { model } = require('../config/gemini');
const segmentationPrompt = require('./prompts/segmentationPrompt');
const campaignPrompt = require('./prompts/campaignPrompt');
const insightPrompt = require('./prompts/insightPrompt');

/**
 * Clean and parse JSON from Gemini response.
 * Strips markdown code blocks (e.g. ```json ... ```) if present.
 */
const parseGeminiJson = (text) => {
  try {
    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      // Find JSON block
      const start = cleanText.indexOf('{');
      const end = cleanText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        cleanText = cleanText.substring(start, end + 1);
      }
    }
    return JSON.parse(cleanText);
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', err.message, '\nRaw output was:', text);
    throw new Error('AI returned malformed structured data');
  }
};

/**
 * 1. Natural Language Segmentation
 */
const translateNaturalLanguageQuery = async (queryText) => {
  const currentDateStr = new Date().toISOString();

  if (!model) {
    console.log('[AI Service Offline Fallback]: Parsing segment query via keywords.');
    return getOfflineSegmentationFallback(queryText, currentDateStr);
  }

  try {
    const prompt = segmentationPrompt(queryText, currentDateStr);
    console.log('[AI Service]: Calling Gemini for segmentation...');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseGeminiJson(text);
  } catch (err) {
    console.warn('[AI Service Error]: Gemini segmentation failed. Using fallback.', err.message);
    return getOfflineSegmentationFallback(queryText, currentDateStr);
  }
};

/**
 * 2. Campaign Copy Generator & Channel Suggester
 */
const generateCampaignCopy = async (segmentExplanation, goal) => {
  if (!model) {
    console.log('[AI Service Offline Fallback]: Generating campaign copy templates.');
    return getOfflineCampaignCopyFallback(segmentExplanation, goal);
  }

  try {
    const prompt = campaignPrompt(segmentExplanation, goal);
    console.log('[AI Service]: Calling Gemini for campaign copy...');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseGeminiJson(text);
  } catch (err) {
    console.warn('[AI Service Error]: Gemini copywriting failed. Using fallback.', err.message);
    return getOfflineCampaignCopyFallback(segmentExplanation, goal);
  }
};

/**
 * 3. Campaign Performance Summary
 */
const generatePerformanceSummary = async (campaignName, metrics) => {
  if (!model) {
    console.log('[AI Service Offline Fallback]: Generating performance summary report.');
    return getOfflineInsightFallback(campaignName, metrics);
  }

  try {
    const prompt = insightPrompt(campaignName, metrics);
    console.log('[AI Service]: Calling Gemini for analytics summary...');
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return parseGeminiJson(text);
  } catch (err) {
    console.warn('[AI Service Error]: Gemini insight analysis failed. Using fallback.', err.message);
    return getOfflineInsightFallback(campaignName, metrics);
  }
};


// ==========================================
// OFFLINE FALLBACK IMPLEMENTATIONS
// ==========================================

const getOfflineSegmentationFallback = (query, currentDateStr) => {
  const q = query.toLowerCase();
  
  // Example query: "Find customers who spent more than 5000 rupees but haven't purchased in 45 days"
  // Default fallback query variables:
  let totalSpendThreshold = 5000;
  let daysLimit = 45;

  // Extract total spend threshold if matches digit > 100
  const spendMatch = q.match(/(?:spent|spend|above|more than)\s*(?:rs\.?|rupees|inr)?\s*(\d{3,})/i);
  if (spendMatch) {
    totalSpendThreshold = parseInt(spendMatch[1], 10);
  }

  // Extract relative date limit
  const daysMatch = q.match(/(\d+)\s*(?:days|day)/i);
  if (daysMatch) {
    daysLimit = parseInt(daysMatch[1], 10);
  }

  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - daysLimit);
  const thresholdDateStr = thresholdDate.toISOString();

  // Keyword routing for query structures
  if (q.includes('spend') && (q.includes('day') || q.includes('purchase') || q.includes('order'))) {
    return {
      filter: {
        totalSpend: { $gt: totalSpendThreshold },
        lastOrderDate: { $lt: thresholdDateStr }
      },
      explanation: `Customers who spent more than Rs. ${totalSpendThreshold.toLocaleString('en-IN')} and did not make a purchase in the last ${daysLimit} days (Offline Fallback)`
    };
  } else if (q.includes('spend') || q.includes('purchased')) {
    return {
      filter: {
        totalSpend: { $gt: totalSpendThreshold }
      },
      explanation: `Customers who spent more than Rs. ${totalSpendThreshold.toLocaleString('en-IN')} overall (Offline Fallback)`
    };
  } else if (q.includes('vip') || q.includes('premium')) {
    return {
      filter: { tags: { $in: ['vip'] } },
      explanation: `Customers marked with tag "vip" (Offline Fallback)`
    };
  } else if (q.includes('city') || q.includes('mumbai') || q.includes('delhi') || q.includes('bangalore')) {
    let targetCity = 'Mumbai';
    if (q.includes('delhi')) targetCity = 'Delhi';
    else if (q.includes('bangalore')) targetCity = 'Bangalore';
    
    return {
      filter: { city: { $regex: targetCity, $options: 'i' } },
      explanation: `Customers residing in ${targetCity} (Offline Fallback)`
    };
  }

  // Generic fallback query
  return {
    filter: {},
    explanation: `All customers (Query not matching keyword fallback mappings)`
  };
};

const getOfflineCampaignCopyFallback = (segmentExplanation, goal) => {
  return {
    recommendation: {
      channel: 'WhatsApp',
      reason: 'WhatsApp has high open rates (98%) and fits cohorts requiring direct re-engagement hooks for conversational purchases.'
    },
    copy: {
      WhatsApp: `Hi [Name]! 🎉 We noticed you haven't visited us recently from [City]. To welcome you back, here is a special Rs. 500 voucher on your next purchase! Redeem now: sreach.ai/claim-500`,
      SMS: `Hi [Name]! We miss you. Get a Rs. 500 D2C discount today only! Click here to shop: sreach.ai/500`,
      Email: {
        subject: `We miss you, [Name]! Here is a Rs. 500 gift inside... 🎁`,
        body: `Dear [Name],\n\nWe noticed you haven't placed an order with us since your last order. Your total customer spend is Rs. [TotalSpend].\n\nTo help you get back on track, here is an exclusive Rs. 500 code valid for the next 48 hours only.\n\nSee you soon!\nSmartReach Team`
      },
      RCS: `Hey [Name]! 🎉 Special discount unlocked for you. Get Rs. 500 OFF your next cart items. Tap below to see personalized recommendations!`
    }
  };
};

const getOfflineInsightFallback = (campaignName, metrics) => {
  const delivery = metrics.deliveryRate || 0;
  const conversions = metrics.conversionRate || 0;
  const rating = conversions > 10 ? 'High Performing' : conversions > 5 ? 'Healthy' : 'Needs Optimization';

  return {
    performanceRating: rating,
    summary: `The campaign "${campaignName}" reached ${metrics.sentCount} customers. It exhibits a ${rating} performance profile, with a conversion rate of ${conversions}% and a delivery rate of ${delivery}%.`,
    insights: [
      `Delivered successfully to ${metrics.deliveredCount} customers. Network failures accounted for ${metrics.failedCount} messages.`,
      `The customer open rate was ${metrics.openRate}%, leading to ${metrics.clickedCount} total link clicks.`,
      `A conversion funnel rate of ${conversions}% represents solid purchase intent from clicked users.`
    ],
    recommendations: [
      `A delivery rate of ${delivery}% indicates clean numbers. Monitor channel-specific failures for carrier-block anomalies.`,
      `Consider moving the call-to-action link higher in your copy templates to improve click-through rates.`,
      `A/B test subject lines or emojis to lift the open rate beyond ${metrics.openRate}%.`
    ]
  };
};

module.exports = {
  translateNaturalLanguageQuery,
  generateCampaignCopy,
  generatePerformanceSummary
};
