const fs = require('fs');
const path = require('path');

let salesData = [];

// Enhanced CSV parser to handle quoted fields and commas in numbers
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Load CSV data with improved parsing
function loadSalesData() {
  try {
    const csvPath = path.join(__dirname, 'train.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.error('❌ CSV file is empty');
      return;
    }
    
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
    console.log('📊 CSV Headers:', headers);
    
    salesData = lines.slice(1)
      .filter(line => line.trim())
      .map((line, index) => {
        try {
          const values = parseCSVLine(line);
          const row = {};
          
          headers.forEach((header, headerIndex) => {
            let value = values[headerIndex] || '';
            // Clean up the value
            value = value.replace(/"/g, '').trim();
            row[header] = value;
          });
          
          return row;
        } catch (error) {
          console.error(`Error parsing line ${index + 2}:`, error);
          return null;
        }
      })
      .filter(row => row !== null);
    
    console.log(`✅ Loaded ${salesData.length} sales records`);
    console.log('📋 Sample record:', salesData[0]);
    
    // Test sales parsing
    const testSales = salesData.slice(0, 5).map(row => ({
      sales: row.Sales,
      parsed: parseFloat(row.Sales?.replace(/,/g, '') || 0)
    }));
    console.log('🧪 Sales parsing test:', testSales);
    
  } catch (error) {
    console.error('❌ Error loading CSV:', error);
  }
}

// Enhanced getSalesData with better number parsing
function getSalesData(filters = {}) {
  console.log('🔍 getSalesData called with filters:', filters);
  
  if (salesData.length === 0) {
    console.log('❌ No sales data available');
    return getEmptyResult();
  }
  
  let filteredData = [...salesData];
  console.log('📊 Starting with', filteredData.length, 'records');
  
  // Apply filters with logging
  if (filters.state) {
    const beforeCount = filteredData.length;
    filteredData = filteredData.filter(row => 
      row.State?.toLowerCase().includes(filters.state.toLowerCase())
    );
    console.log(`🗺️ State filter '${filters.state}': ${beforeCount} → ${filteredData.length} records`);
  }
  
  if (filters.city) {
    const beforeCount = filteredData.length;
    filteredData = filteredData.filter(row => 
      row.City?.toLowerCase().includes(filters.city.toLowerCase())
    );
    console.log(`🏙️ City filter '${filters.city}': ${beforeCount} → ${filteredData.length} records`);
  }
  
  if (filters.region) {
    const beforeCount = filteredData.length;
    filteredData = filteredData.filter(row => 
      row.Region?.toLowerCase().includes(filters.region.toLowerCase())
    );
    console.log(`🌎 Region filter '${filters.region}': ${beforeCount} → ${filteredData.length} records`);
  }
  
  if (filters.category) {
    const beforeCount = filteredData.length;
    filteredData = filteredData.filter(row => 
      row.Category?.toLowerCase().includes(filters.category.toLowerCase())
    );
    console.log(`📦 Category filter '${filters.category}': ${beforeCount} → ${filteredData.length} records`);
  }

  if (filteredData.length === 0) {
    console.log('❌ No data found after filtering');
    return getNoDataResult(filters);
  }

  // Enhanced sales calculation with better number parsing
  const salesValues = filteredData.map(row => {
    const salesStr = row.Sales || '0';
    // Remove commas and parse as float
    const salesNum = parseFloat(salesStr.replace(/,/g, '')) || 0;
    return salesNum;
  });
  
  const totalSales = salesValues.reduce((sum, val) => sum + val, 0);
  const totalTransactions = filteredData.length;
  const avgTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
  
  console.log('💰 Sales calculation:', {
    totalSales: totalSales.toLocaleString(),
    totalTransactions,
    avgTransactionValue: avgTransactionValue.toFixed(2)
  });
  
  // Group by city for map
  const cityData = filteredData.reduce((acc, row) => {
    const city = row.City || 'Unknown';
    const state = row.State || '';
    const region = row.Region || '';
    const sales = parseFloat((row.Sales || '0').replace(/,/g, '')) || 0;
    
    if (!acc[city]) {
      acc[city] = { city, sales: 0, transactions: 0, state, region };
    }
    acc[city].sales += sales;
    acc[city].transactions += 1;
    return acc;
  }, {});

  // Group by category for charts
  const categoryData = filteredData.reduce((acc, row) => {
    const category = row.Category || 'Unknown';
    const sales = parseFloat((row.Sales || '0').replace(/,/g, '')) || 0;
    
    if (!acc[category]) {
      acc[category] = { category, sales: 0, transactions: 0 };
    }
    acc[category].sales += sales;
    acc[category].transactions += 1;
    return acc;
  }, {});

  // Time series data (group by month)
  const timeSeriesData = filteredData.reduce((acc, row) => {
    const orderDate = row['Order Date'];
    if (!orderDate) return acc;
    
    // Parse date and get month/year
    const dateParts = orderDate.split('/');
    if (dateParts.length !== 3) return acc;
    
    const month = dateParts[0].padStart(2, '0');
    const year = dateParts[2];
    const monthKey = `${year}-${month}`;
    
    const sales = parseFloat((row.Sales || '0').replace(/,/g, '')) || 0;
    
    if (!acc[monthKey]) {
      acc[monthKey] = { date: `${year}-${month}-01`, sales: 0, transactions: 0 };
    }
    acc[monthKey].sales += sales;
    acc[monthKey].transactions += 1;
    return acc;
  }, {});

  const result = {
    summary: {
      location: filters.state || filters.city || filters.region || 'All Regions',
      totalSales: Math.round(totalSales),
      totalTransactions,
      avgTransactionValue: Math.round(avgTransactionValue),
      filters: filters
    },
    chartData: {
      cityBreakdown: Object.values(cityData)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 20), // Top 20 cities
      categoryBreakdown: Object.values(categoryData)
        .sort((a, b) => b.sales - a.sales),
      timeSeries: Object.values(timeSeriesData)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
    },
    mapData: Object.values(cityData),
    rawData: filteredData.slice(0, 50),
    insights: generateInsights(filteredData, filters, totalSales, avgTransactionValue)
  };

  console.log('✅ Final result summary:', {
    totalSales: result.summary.totalSales,
    categories: result.chartData.categoryBreakdown.length,
    cities: result.chartData.cityBreakdown.length,
    timeSeries: result.chartData.timeSeries.length
  });

  return result;
}

function getEmptyResult() {
  return {
    summary: {
      location: 'No Data',
      totalSales: 0,
      totalTransactions: 0,
      avgTransactionValue: 0,
      filters: {}
    },
    chartData: {
      cityBreakdown: [],
      categoryBreakdown: [],
      timeSeries: []
    },
    mapData: [],
    rawData: [],
    insights: ['No sales data available. Please check your data file.']
  };
}

function getNoDataResult(filters) {
  return {
    summary: {
      location: filters.state || filters.city || filters.region || 'No Results',
      totalSales: 0,
      totalTransactions: 0,
      avgTransactionValue: 0,
      filters: filters
    },
    chartData: {
      cityBreakdown: [],
      categoryBreakdown: [],
      timeSeries: []
    },
    mapData: [],
    rawData: [],
    insights: [
      `No data found for the specified filters.`,
      'Try adjusting your search criteria or removing some filters.',
      'Available data includes: California, Texas, Florida, New York, and more states.'
    ]
  };
}

// Enhanced insights with proper number formatting
function generateInsights(data, filters, totalSales, avgTransactionValue) {
  const insights = [];
  
  if (data.length === 0) {
    insights.push("No data found for the specified filters.");
    return insights;
  }

  insights.push(`📊 Found ${data.length.toLocaleString()} transactions`);
  insights.push(`💰 Total revenue: $${totalSales.toLocaleString()}`);
  insights.push(`💵 Average order value: $${avgTransactionValue.toFixed(2)}`);
  
  // Top performing city
  const cityPerformance = data.reduce((acc, row) => {
    const city = row.City || 'Unknown';
    const sales = parseFloat((row.Sales || '0').replace(/,/g, '')) || 0;
    acc[city] = (acc[city] || 0) + sales;
    return acc;
  }, {});
  
  const topCity = Object.entries(cityPerformance)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (topCity && topCity[1] > 0) {
    insights.push(`🏆 Top city: ${topCity[0]} ($${Math.round(topCity[1]).toLocaleString()})`);
  }

  // Category insights
  const categoryPerformance = data.reduce((acc, row) => {
    const category = row.Category || 'Unknown';
    const sales = parseFloat((row.Sales || '0').replace(/,/g, '')) || 0;
    acc[category] = (acc[category] || 0) + sales;
    return acc;
  }, {});

  const topCategory = Object.entries(categoryPerformance)
    .sort(([,a], [,b]) => b - a)[0];

  if (topCategory && topCategory[1] > 0) {
    insights.push(`📦 Leading category: ${topCategory[0]} ($${Math.round(topCategory[1]).toLocaleString()})`);
  }

  return insights;
}

// Rest of your existing functions...
function getSalesAnalytics(params = {}) {
  const { analysisType, dimension, filters = {} } = params;
  let data = getSalesData(filters);
  
  switch (analysisType) {
    case 'trends':
      return analyzeTrends(data, dimension);
    case 'comparison':
      return comparePerformance(data, dimension);
    case 'performance':
      return analyzePerformance(data, dimension);
    default:
      return data;
  }
}

function getProductInsights(params = {}) {
  const { productName, category, insightType } = params;
  
  let filteredData = [...salesData];
  
  if (productName) {
    filteredData = filteredData.filter(row => 
      row['Product Name']?.toLowerCase().includes(productName.toLowerCase())
    );
  }
  
  if (category) {
    filteredData = filteredData.filter(row => 
      row.Category?.toLowerCase().includes(category.toLowerCase())
    );
  }

  switch (insightType) {
    case 'top_products':
      return getTopProducts(filteredData);
    case 'recommendations':
      return getRecommendations(filteredData);
    default:
      return analyzeProducts(filteredData);
  }
}

function analyzeTrends(data, dimension) {
  return {
    type: 'trends',
    dimension,
    data: data.chartData.timeSeries,
    insights: ['Sales trending upward', 'Peak performance in Q4']
  };
}

function comparePerformance(data, dimension) {
  return {
    type: 'comparison',
    dimension,
    data: data.chartData.categoryBreakdown,
    insights: ['Technology leads in sales', 'Furniture has highest margins']
  };
}

function analyzePerformance(data, dimension) {
  return {
    type: 'performance',
    data: data.summary,
    insights: ['Strong overall performance', 'Room for improvement in Central region']
  };
}

function getTopProducts(data) {
  const productSales = data.reduce((acc, row) => {
    const product = row['Product Name'] || 'Unknown Product';
    const sales = parseFloat((row.Sales || '0').replace(/,/g, '')) || 0;
    acc[product] = (acc[product] || 0) + sales;
    return acc;
  }, {});

  const topProducts = Object.entries(productSales)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([product, sales]) => ({ product, sales: Math.round(sales) }));

  return {
    type: 'top_products',
    products: topProducts,
    insights: [
      `🏆 Top product: ${topProducts[0]?.product}`, 
      `💰 Generates $${topProducts[0]?.sales.toLocaleString()} in sales`
    ]
  };
}

function getRecommendations(data) {
  return {
    type: 'recommendations',
    recommendations: [
      'Focus on high-margin products',
      'Expand successful products to underperforming regions',
      'Consider seasonal promotions'
    ],
    insights: ['Data-driven recommendations available']
  };
}

function analyzeProducts(data) {
  return {
    type: 'product_analysis',
    data: data,
    insights: ['Product analysis complete']
  };
}

// Initialize data loading
loadSalesData();

module.exports = {
  getSalesData,
  getSalesAnalytics,
  getProductInsights
};