require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { getSalesData, getSalesAnalytics, getProductInsights } = require('./data-model');

const app = express();
const corsOptions = {
  origin: (_, callback) => callback(null, true), // allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
// app.use(cors("*"));
app.use(express.json());
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

const geminiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent`;
const apiKey = process.env.GEMINI_API_KEY;

// Function to check if query is sales-related
function isSalesRelated(query) {
  const lowerQuery = query.toLowerCase();
  
  // Sales-related keywords - enhanced for performance analysis
  const salesKeywords = [
    'sales', 'revenue', 'performance', 'data', 'dashboard', 'report', 'analytics',
    'numbers', 'figures', 'profit', 'earnings', 'transactions', 'orders',
    'product', 'category', 'region', 'city', 'state', 'customer', 'business',
    'trend', 'growth', 'analysis', 'insight', 'comparison', 'top', 'best',
    'furniture', 'technology', 'office supplies', 'california', 'texas',
    'show', 'display', 'chart', 'graph', 'visualization', 'breakdown',
    'states', 'cities', 'regions', 'locations', 'where', 'how many',
    'which', 'what', 'count', 'total', 'sum', 'average', 'highest', 'lowest',
    // Performance-related keywords
    'worst', 'least', 'poor', 'low', 'bottom', 'underperform', 'weak',
    'minimum', 'smallest', 'decline', 'drop', 'fall', 'decrease',
    'performer', 'performing', 'achiever', 'results', 'outcomes'
  ];
  
  // Non-sales keywords that should be rejected
  const offTopicKeywords = [
    'weather', 'temperature', 'rain', 'snow', 'climate', 'forecast',
    'movie', 'film', 'actor', 'actress', 'cinema', 'entertainment',
    'recipe', 'cooking', 'food', 'restaurant', 'meal', 'ingredient',
    'sport', 'football', 'basketball', 'soccer', 'game', 'player',
    'politics', 'government', 'election', 'president', 'politician',
    'health', 'medical', 'doctor', 'hospital', 'medicine', 'disease',
    'travel', 'vacation', 'hotel', 'flight', 'tourism', 'destination',
    'music', 'song', 'artist', 'album', 'concert', 'band',
    'joke', 'funny', 'comedy', 'humor', 'laugh',
    'personal', 'relationship', 'dating', 'marriage', 'family'
  ];
  
  // Check for off-topic keywords first
  const hasOffTopicKeywords = offTopicKeywords.some(keyword => 
    lowerQuery.includes(keyword)
  );
  
  if (hasOffTopicKeywords) {
    return false;
  }
  
  // Check for sales keywords
  const hasSalesKeywords = salesKeywords.some(keyword => 
    lowerQuery.includes(keyword)
  );
  
  // If it's a very short query without clear context, assume it might be sales-related
  if (lowerQuery.length < 10 && !hasOffTopicKeywords) {
    return true;
  }
  
  return hasSalesKeywords;
}

// Enhanced function to analyze user intent with performance detection
function analyzeQuery(query) {
  const lowerQuery = query.toLowerCase();
  console.log('Analyzing query:', query);
  
  // First check if it's sales-related
  if (!isSalesRelated(query)) {
    return { functionName: null, parameters: {}, isOffTopic: true };
  }
  
  let functionName = null;
  let parameters = {};
  
  // Enhanced keyword detection
  const salesKeywords = ['sales', 'revenue', 'performance', 'show', 'data', 'dashboard', 'report', 'analytics', 'numbers', 'figures'];
  const productKeywords = ['product', 'top', 'best', 'recommendation', 'item', 'goods'];
  const analyticsKeywords = ['trend', 'compare', 'analysis', 'insight', 'pattern'];
  const locationKeywords = ['states', 'cities', 'regions', 'locations', 'where', 'how many'];
  
  // Performance-related keywords
  const performanceKeywords = ['performer', 'performing', 'performance'];
  const lowPerformanceKeywords = ['least', 'worst', 'poor', 'low', 'bottom', 'underperform', 'weak', 'minimum', 'smallest'];
  const highPerformanceKeywords = ['top', 'best', 'highest', 'maximum', 'greatest', 'peak'];
  
  const hasSalesKeywords = salesKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasProductKeywords = productKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasAnalyticsKeywords = analyticsKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasLocationKeywords = locationKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasPerformanceKeywords = performanceKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasLowPerformanceKeywords = lowPerformanceKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasHighPerformanceKeywords = highPerformanceKeywords.some(keyword => lowerQuery.includes(keyword));
  
  // Enhanced location detection
  if (hasLocationKeywords || lowerQuery.includes('state') || lowerQuery.includes('city')) {
    functionName = 'getSalesAnalytics';
    parameters.analysisType = 'location_analysis';
    
    if (lowerQuery.includes('state')) parameters.dimension = 'state';
    if (lowerQuery.includes('city') || lowerQuery.includes('cities')) parameters.dimension = 'city';
    if (lowerQuery.includes('region')) parameters.dimension = 'region';
    
    // Add performance filter
    if (hasLowPerformanceKeywords) parameters.performanceFilter = 'lowest';
    if (hasHighPerformanceKeywords) parameters.performanceFilter = 'highest';
  }
  
  // Performance analysis detection
  else if (hasPerformanceKeywords || hasLowPerformanceKeywords || hasHighPerformanceKeywords) {
    functionName = 'getSalesAnalytics';
    parameters.analysisType = 'performance_analysis';
    
    // Determine performance type
    if (hasLowPerformanceKeywords) {
      parameters.performanceType = 'lowest';
      parameters.sortOrder = 'asc';
    } else if (hasHighPerformanceKeywords) {
      parameters.performanceType = 'highest';
      parameters.sortOrder = 'desc';
    } else {
      parameters.performanceType = 'overall';
    }
    
    // Determine what to analyze
    if (lowerQuery.includes('state')) parameters.dimension = 'state';
    else if (lowerQuery.includes('city') || lowerQuery.includes('cities')) parameters.dimension = 'city';
    else if (lowerQuery.includes('region')) parameters.dimension = 'region';
    else if (lowerQuery.includes('product')) parameters.dimension = 'product';
    else if (lowerQuery.includes('category')) parameters.dimension = 'category';
    else parameters.dimension = 'overall'; // Default to overall performance
  }
  
  // Default to sales data if query seems data-related
  else if (hasSalesKeywords || (!hasProductKeywords && !hasAnalyticsKeywords)) {
    functionName = 'getSalesData';
    
    // Extract location filters
    if (lowerQuery.includes('california') || lowerQuery.includes('ca')) parameters.state = 'California';
    if (lowerQuery.includes('texas') || lowerQuery.includes('tx')) parameters.state = 'Texas';
    if (lowerQuery.includes('florida') || lowerQuery.includes('fl')) parameters.state = 'Florida';
    if (lowerQuery.includes('new york') || lowerQuery.includes('ny')) parameters.state = 'New York';
    if (lowerQuery.includes('nevada') || lowerQuery.includes('nv')) parameters.state = 'Nevada';
    if (lowerQuery.includes('illinois') || lowerQuery.includes('il')) parameters.state = 'Illinois';
    
    // Extract region filters
    if (lowerQuery.includes('west')) parameters.region = 'West';
    if (lowerQuery.includes('east')) parameters.region = 'East';
    if (lowerQuery.includes('central')) parameters.region = 'Central';
    if (lowerQuery.includes('south')) parameters.region = 'South';
    
    // Extract category filters
    if (lowerQuery.includes('furniture')) parameters.category = 'Furniture';
    if (lowerQuery.includes('technology') || lowerQuery.includes('tech')) parameters.category = 'Technology';
    if (lowerQuery.includes('office supplies') || lowerQuery.includes('supplies')) parameters.category = 'Office Supplies';
    
    // Extract date filters
    if (lowerQuery.includes('2015')) parameters.dateRange = '2015';
    if (lowerQuery.includes('2016')) parameters.dateRange = '2016';
    if (lowerQuery.includes('2017')) parameters.dateRange = '2017';
    if (lowerQuery.includes('2018')) parameters.dateRange = '2018';
  }
  
  // Product insights
  else if (hasProductKeywords) {
    functionName = 'getProductInsights';
    
    if (lowerQuery.includes('top') || hasHighPerformanceKeywords) parameters.insightType = 'top_products';
    if (hasLowPerformanceKeywords) parameters.insightType = 'poor_products';
    if (lowerQuery.includes('recommendation')) parameters.insightType = 'recommendations';
    
    if (lowerQuery.includes('furniture')) parameters.category = 'Furniture';
    if (lowerQuery.includes('technology')) parameters.category = 'Technology';
    if (lowerQuery.includes('office supplies')) parameters.category = 'Office Supplies';
  }
  
  // Analytics
  else if (hasAnalyticsKeywords) {
    functionName = 'getSalesAnalytics';
    
    if (lowerQuery.includes('trend')) parameters.analysisType = 'trends';
    if (lowerQuery.includes('compare')) parameters.analysisType = 'comparison';
    if (lowerQuery.includes('performance')) parameters.analysisType = 'performance';
    
    if (lowerQuery.includes('region')) parameters.dimension = 'region';
    if (lowerQuery.includes('category')) parameters.dimension = 'category';
    if (lowerQuery.includes('time')) parameters.dimension = 'time';
  }
  
  // If no specific intent detected, default to sales data
  if (!functionName) {
    functionName = 'getSalesData';
    console.log('No specific intent detected, defaulting to getSalesData');
  }
  
  console.log('Detected:', { functionName, parameters });
  return { functionName, parameters, isOffTopic: false };
}

// Enhanced function to generate contextual AI response with performance insights
function generateContextualResponse(query, functionResult, functionName, parameters) {
  let context = '';
  
  switch (functionName) {
    case 'getSalesData':
      const uniqueStates = [...new Set(functionResult.mapData?.map(item => item.state))].filter(Boolean);
      const uniqueCities = [...new Set(functionResult.chartData?.cityBreakdown?.map(item => item.city))].filter(Boolean);
      
      context = `📊 **Sales Performance Analysis** ${parameters.state ? `for ${parameters.state}` : ''}${parameters.category ? ` in ${parameters.category}` : ''}

**💰 Key Metrics:**
• Total Revenue: $${functionResult.summary.totalSales.toLocaleString()}
• Total Transactions: ${functionResult.summary.totalTransactions.toLocaleString()}
• Average Order Value: $${functionResult.summary.avgTransactionValue.toLocaleString()}

**🏢 Geographic Coverage:**
• We're selling in ${uniqueStates.length} states: ${uniqueStates.slice(0, 5).join(', ')}${uniqueStates.length > 5 ? ` and ${uniqueStates.length - 5} more` : ''}
• Top cities include: ${uniqueCities.slice(0, 5).join(', ')}

**📈 Top Categories:**
${functionResult.chartData?.categoryBreakdown?.slice(0, 3).map(cat => 
  `• ${cat.category}: $${cat.sales.toLocaleString()}`
).join('\n') || 'Category data loading...'}

**🔍 Key Insights:**
${functionResult.insights?.map(insight => `• ${insight}`).join('\n') || 'Analysis complete!'}`;
      break;
      
    case 'getSalesAnalytics':
      if (parameters.analysisType === 'performance_analysis') {
        const isLowestPerformance = parameters.performanceType === 'lowest';
        const cities = functionResult.chartData?.cityBreakdown || [];
        const states = [...new Set(functionResult.mapData?.map(item => ({ state: item.state, sales: item.sales })))];
        
        // Sort based on performance type
        const sortedCities = cities.sort((a, b) => isLowestPerformance ? a.sales - b.sales : b.sales - a.sales);
        const sortedStates = states.sort((a, b) => isLowestPerformance ? a.sales - b.sales : b.sales - a.sales);
        
        context = `🎯 **${isLowestPerformance ? 'Lowest' : 'Highest'} Performance Analysis**

**📊 ${isLowestPerformance ? 'Underperforming' : 'Top Performing'} Areas:**

**🏙️ Cities ${isLowestPerformance ? 'Needing Attention' : 'Leading Sales'}:**
${sortedCities.slice(0, 10).map((city, index) => 
  `${index + 1}. ${city.city}: $${city.sales.toLocaleString()}${isLowestPerformance ? ' ⚠️' : ' 🏆'}`
).join('\n')}

**📍 States Performance:**
${sortedStates.slice(0, 10).map((state, index) => 
  `${index + 1}. ${state.state}: $${state.sales.toLocaleString()}${isLowestPerformance ? ' 📉' : ' 📈'}`
).join('\n')}

**💡 ${isLowestPerformance ? 'Improvement Opportunities' : 'Success Factors'}:**
${isLowestPerformance ? 
  '• Focus marketing efforts on underperforming cities\n• Analyze successful strategies from top performers\n• Consider product mix adjustments\n• Investigate local market conditions\n• Implement targeted promotional campaigns' :
  '• Replicate successful strategies in other markets\n• Increase investment in high-performing areas\n• Expand product offerings in successful regions\n• Study customer preferences in top markets\n• Scale winning campaigns to other locations'
}

**🎯 Action Items:**
${functionResult.insights?.map(insight => `• ${insight}`).join('\n') || 'Performance analysis complete!'}`;
      }
      else if (parameters.analysisType === 'location_analysis') {
        const uniqueStates = [...new Set(functionResult.mapData?.map(item => item.state))].filter(Boolean);
        const uniqueCities = [...new Set(functionResult.chartData?.cityBreakdown?.map(item => item.city))].filter(Boolean);
        
        context = `🗺️ **Geographic Sales Analysis**

**📍 States Analysis:**
• Total States: ${uniqueStates.length}
• Active Markets: ${uniqueStates.join(', ')}

**🏙️ Cities Analysis:**
• Total Cities: ${uniqueCities.length}
• Top Performing Cities:
${functionResult.chartData?.cityBreakdown?.slice(0, 5).map(city => 
  `  • ${city.city}: $${city.sales.toLocaleString()}`
).join('\n') || 'City data loading...'}

**🎯 Insights:**
${functionResult.insights?.map(insight => `• ${insight}`).join('\n') || 'Geographic analysis complete!'}`;
      } else {
        context = `📊 **Advanced Analytics**

${functionResult.insights?.map(insight => `• ${insight}`).join('\n') || 'Analysis completed successfully'}`;
      }
      break;
      
    case 'getProductInsights':
      const insightType = parameters.insightType || 'top_products';
      const isLowPerformance = insightType === 'poor_products';
      
      context = `🛍️ **Product Performance Insights** ${isLowPerformance ? '(Low Performers)' : '(Top Performers)'}

**${isLowPerformance ? '⚠️ Underperforming Products' : '🏆 Top Products'}:**
${functionResult.products?.slice(0, 8).map((p, index) => 
  `${index + 1}. ${p.product}: $${p.sales.toLocaleString()}${isLowPerformance ? ' 📉' : ' 🚀'}`
).join('\n') || 'Product analysis complete!'}

**💡 ${isLowPerformance ? 'Improvement Strategies' : 'Success Recommendations'}:**
${isLowPerformance ?
  '• Review pricing strategy for underperformers\n• Consider product bundling opportunities\n• Analyze customer feedback and reviews\n• Evaluate marketing campaigns effectiveness\n• Assess inventory management\n• Consider seasonal factors' :
  '• Increase inventory for high-demand products\n• Expand successful product lines\n• Create product bundles with top performers\n• Enhance marketing for bestsellers\n• Study customer preferences\n• Consider premium variants'
}

**🎯 Actionable Insights:**
${functionResult.insights?.map(insight => `• ${insight}`).join('\n') || 'Product recommendations ready!'}`;
      break;
  }
  
  return context;
}

async function askAgent(req, res) {
  const { query, chatHistory = [] } = req.body;
  
  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const { functionName, parameters, isOffTopic } = analyzeQuery(query);
    
    // Handle off-topic queries
    if (isOffTopic) {
      const offTopicResponse = `I'm a specialized AI sales analyst focused exclusively on helping you analyze your sales data and business performance. 

I can help you with:
📊 Sales performance analysis
📈 Revenue trends and patterns  
🏙️ Regional and city-based insights
📦 Product category comparisons
🏆 Top performing products and regions
📉 Growth and performance metrics
🗺️ Geographic coverage analysis
⚠️ Underperforming areas analysis

Please ask me about your sales data, and I'll create beautiful visualizations and insights for you!

**Try asking:**
• "Show me least performing cities"
• "Which states are underperforming?"
• "Top vs worst performing products"
• "Compare California vs Texas performance"
• "Identify improvement opportunities"`;

      return res.json({
        answer: offTopicResponse,
        dashboardData: null,
        functionCalled: null,
        isOffTopic: true,
        suggestions: [
          "Show me least performing cities",
          "Which states are underperforming?",
          "Top vs worst performing products",
          "Compare California vs Texas performance",
          "Identify improvement opportunities"
        ]
      });
    }
    
    let functionResult = null;
    
    // Always call a function for sales-related queries
    switch (functionName) {
      case 'getSalesData':
        functionResult = getSalesData(parameters);
        break;
        
      case 'getProductInsights':
        functionResult = getProductInsights(parameters);
        break;
        
      case 'getSalesAnalytics':
        functionResult = getSalesAnalytics(parameters);
        break;
    }
    
    // Generate contextual response
    const aiContext = generateContextualResponse(query, functionResult, functionName, parameters);
    
    // Enhanced suggestions based on current query
    const suggestions = generateSmartSuggestions(query, functionResult, parameters);

    // Build conversation for Gemini with performance context
    let conversationText = `You are a specialized AI sales analyst. You ONLY help with sales data analysis and business performance. You provide detailed insights for both high and low performers.

User asked: "${query}"

Here's the detailed data analysis:
${aiContext}

Previous conversation:
${chatHistory.slice(-3).map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content || msg.parts?.[0]?.text || ''}`).join('\n')}

Provide a helpful, enthusiastic response about the sales data. Stay focused on business insights and actionable recommendations. Be conversational and highlight key findings. Use the data analysis above to give specific numbers and insights. If this is about poor performance, provide constructive improvement suggestions.`;

    const response = await axios.post(
      `${geminiEndpoint}?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: conversationText
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = response.data.candidates[0].content.parts[0].text;

    return res.json({
      answer: aiResponse,
      dashboardData: functionResult,
      functionCalled: functionName,
      query: query,
      suggestions: suggestions
    });

  } catch (error) {
    console.error('Error in askAgent:', error.response?.data || error.message);
    
    // Always provide fallback data for sales queries
    const { functionName, parameters, isOffTopic } = analyzeQuery(query);
    
    if (isOffTopic) {
      return res.json({
        answer: "I'm a sales data analyst. Please ask me about your sales performance, products, or business metrics!",
        dashboardData: null,
        functionCalled: null,
        isOffTopic: true,
        suggestions: [
          "Show me sales dashboard",
          "Top performing products",
          "Regional sales analysis",
          "Least performing cities"
        ]
      });
    }
    
    let fallbackData = getSalesData(parameters);
    
    res.json({
      answer: `I found sales data with $${fallbackData.summary.totalSales.toLocaleString()} in total sales! Check out the dashboard for detailed visualizations.`,
      dashboardData: fallbackData,
      functionCalled: functionName,
      suggestions: generateSmartSuggestions(query, fallbackData, parameters)
    });
  }
}

// Enhanced function to generate smart suggestions based on context
function generateSmartSuggestions(query, functionResult, parameters) {
  const lowerQuery = query.toLowerCase();
  let suggestions = [];
  
  // Performance-based suggestions
  if (lowerQuery.includes('least') || lowerQuery.includes('worst') || lowerQuery.includes('poor') || lowerQuery.includes('low')) {
    suggestions = [
      "Show me top performing cities for comparison",
      "Which products need improvement?",
      "Identify underperforming regions",
      "Compare worst vs best performers",
      "Improvement strategies for weak areas"
    ];
  } else if (lowerQuery.includes('top') || lowerQuery.includes('best') || lowerQuery.includes('highest')) {
    suggestions = [
      "Show me least performing areas",
      "Compare best vs worst performers",
      "Identify success factors",
      "Replicate winning strategies",
      "Expand successful products"
    ];
  }
  // Location-based suggestions
  else if (lowerQuery.includes('state') || lowerQuery.includes('states')) {
    suggestions = [
      "Which states have lowest sales?",
      "Show me California vs Texas comparison",
      "Regional performance analysis",
      "Top cities in each state",
      "State-wise improvement opportunities"
    ];
  } else if (lowerQuery.includes('city') || lowerQuery.includes('cities')) {
    suggestions = [
      "Top 10 cities by sales",
      "Cities with lowest performance",
      "New York vs Los Angeles sales",
      "City improvement opportunities",
      "Urban vs rural performance"
    ];
  } else if (lowerQuery.includes('product')) {
    suggestions = [
      "Best selling products",
      "Worst performing products",
      "Product category analysis",
      "Furniture vs Technology sales",
      "Product improvement recommendations"
    ];
  } else if (parameters.state) {
    suggestions = [
      `Compare ${parameters.state} with other states`,
      `Least performing cities in ${parameters.state}`,
      `${parameters.state} product categories`,
      "Regional improvement analysis",
      "Market expansion opportunities"
    ];
  } else if (parameters.category) {
    suggestions = [
      `${parameters.category} top products`,
      `${parameters.category} underperformers`,
      "Category comparison analysis",
      "Product line opportunities",
      "Category improvement strategies"
    ];
  } else {
    // Default suggestions with performance focus
    suggestions = [
      "Show me all sales data",
      "Top 10 cities by revenue",
      "Least performing regions",
      "Best vs worst products",
      "Performance improvement opportunities"
    ];
  }
  
  return suggestions;
}

app.post('/chat', askAgent);
const PORT = process.env.PORT || 5001;
const HOST = '0.0.0.0';  // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`
🚀 Conversational AI Sales Analytics Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Status    : Running
🌐 URL       : http://${HOST}:${PORT}
🔒 CORS      : Configured for production
⚙️  Process   : ${process.pid}
📅 Started   : ${new Date().toLocaleString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
});

// Add graceful shutdown
// process.on('SIGTERM', () => {
//   console.log('SIGTERM received. Performing graceful shutdown...');
//   server.close(() => {
//     console.log('Server closed. Exiting process.');
//     process.exit(0);
//   });
// });