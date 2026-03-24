// engine.js - Core inference, statistics, and hypothesis generation 

// --- 1. CSV Parsing with Type Inference ---
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n').filter(l => l.trim() !== '');
  if (lines.length < 2) throw new Error("CSV file must have at least header and one data row.");

  // Simple comma split (doesn't handle commas inside quotes for simplicity)
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    let row = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] !== '' ? vals[idx] : null; });
    rows.push(row);
  }

  // Type inference
  const types = {};
  headers.forEach(h => {
    let numCount = 0; let dateCount = 0; let validCount = 0;
    rows.forEach(r => {
      const v = r[h];
      if (v !== null) {
        validCount++;
        if (!isNaN(parseFloat(v)) && isFinite(v)) numCount++;
        else if (h.toLowerCase().includes('date') || h.toLowerCase().includes('time')) dateCount++;
      }
    });

    if (validCount === 0) types[h] = 'category';
    else if (numCount / validCount > 0.8) types[h] = 'numeric';
    else if (dateCount / validCount > 0.5) types[h] = 'date';
    else types[h] = 'category';
  });

  // Convert values based on inferred types
  rows.forEach(r => {
    headers.forEach(h => {
      if (r[h] === null) return;
      if (types[h] === 'numeric') r[h] = parseFloat(r[h]);
    });
  });

  return { headers, rows, types };
}

// --- 2. Statistical Computations ---
function computeStats(data) {
  const { headers, rows, types } = data;
  const stats = {};
  
  headers.forEach(h => {
    const vals = rows.map(r => r[h]).filter(v => v !== null);
    const nulls = rows.length - vals.length;
    
    if (types[h] === 'numeric') {
      vals.sort((a,b) => a-b);
      const sum = vals.reduce((a,b) => a+b, 0);
      const mean = vals.length ? sum / vals.length : 0;
      const median = vals.length ? vals[Math.floor(vals.length/2)] : 0;
      const min = vals.length ? vals[0] : 0;
      const max = vals.length ? vals[vals.length-1] : 0;
      
      const variance = vals.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / (vals.length || 1);
      const stddev = Math.sqrt(variance);
      
      stats[h] = { type: 'numeric', nulls, mean, median, min, max, stddev, vals };
    } else {
      const counts = {};
      vals.forEach(v => counts[v] = (counts[v] || 0) + 1);
      let mode = null, modeCount = 0;
      Object.keys(counts).forEach(k => { if(counts[k] > modeCount) { modeCount = counts[k]; mode = k; }});
      
      stats[h] = { type: types[h], nulls, mode, modeCount, unique: Object.keys(counts).length, counts };
    }
  });

  return stats;
}

// --- 3. Trend Detections ---
function calculatePearson(x, y) {
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  const n = x.length;
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
  }
  const num = (n * sumXY) - (sumX * sumY);
  const den = Math.sqrt((n * sumX2 - sumX*sumX) * (n * sumY2 - sumY*sumY));
  if (den === 0) return 0;
  return num / den;
}

// Main orchestration
function detectTrends(data, stats) {
  const trends = [];
  const { headers, rows, types } = data;
  
  const numCols = headers.filter(h => types[h] === 'numeric');
  const catCols = headers.filter(h => types[h] === 'category');

  // A. Correlations (Numeric vs Numeric)
  for (let i = 0; i < numCols.length; i++) {
    for (let j = i + 1; j < numCols.length; j++) {
      const c1 = numCols[i]; const c2 = numCols[j];
      const validPairs = rows.filter(r => r[c1] !== null && r[c2] !== null);
      if (validPairs.length < 10) continue;
      
      const r_val = calculatePearson(validPairs.map(r=>r[c1]), validPairs.map(r=>r[c2]));
      if (Math.abs(r_val) > 0.6) {
        trends.push({
          type: 'correlation',
          cols: [c1, c2],
          desc: `${c1} and ${c2} are ${r_val > 0 ? 'positively' : 'negatively'} correlated.`,
          r: r_val,
          weight: Math.abs(r_val)
        });
      }
    }
  }

  // B. Outliers (Z-score approach)
  numCols.forEach(col => {
    const s = stats[col];
    if (s.stddev > 0) {
      const outliers = s.vals.filter(v => Math.abs(v - s.mean) > s.stddev * 3);
      if (outliers.length > 0 && outliers.length < s.vals.length * 0.05) {
        trends.push({
          type: 'outliers',
          col: col,
          desc: `${col} contains ${outliers.length} significant outliers.`,
          outliers: outliers,
          weight: 0.7
        });
      }
    }
  });

  // C. Categorical Imbalance
  catCols.forEach(col => {
    const s = stats[col];
    if (s.unique > 1 && s.unique < 10) {
      const total = rows.length - s.nulls;
      const modeRatio = s.modeCount / total;
      if (modeRatio > 0.8) {
        trends.push({
          type: 'imbalance',
          col: col,
          desc: `${col} is heavily dominated by category "${s.mode}".`,
          mode: s.mode,
          ratio: modeRatio,
          weight: modeRatio
        });
      }
    }
  });
  
  // D. Date trend (hacky: substitute with row sequence if no date)
  numCols.forEach(col => {
    const s = stats[col];
    const sequence = s.vals; // just numeric values in order of appearance
    const indices = Array.from({length: sequence.length}, (_, i) => i);
    const r_time = calculatePearson(indices, sequence);
    if (Math.abs(r_time) > 0.5) {
       trends.push({
          type: 'temporal',
          col: col,
          desc: `${col} exhibits a robust ${r_time > 0 ? 'upward' : 'downward'} trend over the dataset sequence.`,
          r: r_time,
          weight: Math.abs(r_time)
       });
    }
  });

  return trends.sort((a,b) => b.weight - a.weight);
}

// --- 4. Hypothesis Generation ---
async function generateHypotheses(stats, trends, domainContext) {

  // Build the prompt context
  const statsSummary = Object.keys(stats).map(k => {
    const s = stats[k];
    if (s.type === 'numeric') return `${k} (numeric): mean=${s.mean.toFixed(2)}, min=${s.min}, max=${s.max}, nulls=${s.nulls}`;
    return `${k} (category): unique=${s.unique}, most freq="${s.mode}", nulls=${s.nulls}`;
  }).join('\n');
  
  const trendsSummary = trends.slice(0, 10).map(t => `- ${t.desc}`).join('\n'); // Top 10 trends

  const prompt = `Act as an expert Data Scientist. 
Domain Context: ${domainContext || "None provided"}
Data Statistics:
${statsSummary}
Detected Math Trends:
${trendsSummary || "None"}

Generate exactly 3 to 5 analytical hypotheses based on these trends and statistics. Focus deeply on the "Detected Math Trends".
You MUST respond with a JSON object. The JSON object must contain exactly one key called "hypotheses", which is an array of objects strictly matching this exact structure:
{
  "hypotheses": [
    {
      "id": "H1",
      "title": "Short catchy title",
      "explanation": "Detailed explanation of the hypothesis (2-3 sentences)",
      "confidence": 85, 
      "severity": "high", 
      "evidence": ["Evidence bullet 1 based on stats", "Evidence bullet 2"],
      "nextSteps": ["Suggested analysis 1", "Suggested analysis 2"]
    }
  ]
}
Note: 'confidence' must be an integer 0-100 indicating confidence based on data. 'severity' must be exactly "low", "med", or "high". Output only valid JSON.`;

  const response = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, response_format: { type: "json_object" } })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Failed to fetch from Vercel backend /api/groq.");
  }

  const data = await response.json();
  const content = data.choices[0].message.content.trim();
  
  try {
    const parsed = JSON.parse(content);
    return parsed.hypotheses || [];
  } catch (e) {
    throw new Error("LLM returned invalid JSON: " + content.substring(0, 100));
  }
}

// --- 5. Synthetic Data Generator ---
function generateSyntheticDataset(type) {
  let csv = "";
  if (type === 'retail') {
    csv = "Date,Region,AdSpend_USD,FootTraffic,Sales_USD,PromoActive\n";
    for(let i=1; i<=100; i++) {
       let spend = Math.floor(Math.random() * 5000) + 1000;
       let promo = Math.random() > 0.7 ? "Yes" : "No";
       // Correlation injected: Traffic tied to spend, Sales tied to traffic + promo
       let traffic = Math.floor((spend * 0.5) + (Math.random() * 1000));
       let sales = Math.floor((traffic * 2.5) + (promo === "Yes" ? 5000 : 0));
       
       // Outlier injected manually
       if(i === 42) { spend = 15000; sales = 45000; traffic = 8000; }
       
       let region = ["North", "South", "East", "West"][Math.floor(Math.random()*4)];
       csv += `2024-01-${(i%30)+1},${region},${spend},${traffic},${sales},${promo}\n`;
    }
  } else if (type === 'health') {
    csv = "PatientID,Age,BMI,HeartRate,BloodPressure_Sys,RiskFactor\n";
    for(let i=1; i<=100; i++) {
      let age = Math.floor(Math.random() * 60) + 20;
      let bmi = 20 + Math.random() * 15;
      // Correlation injected: BP tied to BMI and Age
      let bp = Math.floor(90 + (age * 0.4) + (bmi * 1.5) + (Math.random() * 10));
      let hr = Math.floor(60 + Math.random() * 40);
      let risk = bp > 140 ? "High" : "Low";
      csv += `P${i},${age},${bmi.toFixed(1)},${hr},${bp},${risk}\n`;
    }
  } else if (type === 'website') {
    csv = "Day,PageViews,BounceRate,AvgSessionSeconds,ConversionRate\n";
    for(let i=1; i<=100; i++) {
        // Temporal trend injected: views go up over time
        let views = 1000 + (i * 50) + Math.floor(Math.random()*500);
        // Inverse correlation: views up -> conversion slightly down
        let conversion = 5.0 - (i * 0.02) + Math.random();
        let bounce = 40 + Math.random()*20;
        let session = 120 + Math.random()*60;
        csv += `${i},${views},${bounce.toFixed(1)},${session.toFixed(0)},${Math.max(0.1, conversion).toFixed(2)}\n`;
    }
  }
  return csv;
}

// --- 6. Conversational Chat ---
async function askQuestion(stats, question) {
  const statsSummary = Object.keys(stats).map(k => {
    const s = stats[k];
    if (s.type === 'numeric') return `${k} (num): mean=${s.mean.toFixed(2)}, min=${s.min}, max=${s.max}`;
    return `${k} (cat): unique=${s.unique}, most freq="${s.mode}"`;
  }).join('\n');

  const prompt = `You are Conjecture.ai, an expert data analyst assistant.
Dataset Statistics:
${statsSummary}

User's Question: "${question}"

Provide a concise, helpful answer directly addressing the user's question based on the dataset statistics provided above. Limit response to 2-4 sentences max. Do not use markdown blocks, just plaintext styling with simple bullet points if necessary.`;

  const response = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  if (!response.ok) throw new Error("Failed to fetch response from Vercel backend /api/groq.");
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Expose globals for app.js (no module system needed if script tags are used in order in browser)
window.HypothesisEngine = {
  parseCSV, computeStats, detectTrends, generateHypotheses, generateSyntheticDataset, askQuestion
};
