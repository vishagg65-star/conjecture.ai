# Conjecture.ai Hypothesis Engine

Conjecture.ai is a privacy-first, automated data analytics platform built entirely with modern web technologies. It leverages mathematical heuristics and localized AI logic to automatically quickly analyze your CSV datasets, discovering hidden trends, anomalies, and correlations, and translating that math into human-readable insights.

## ✨ Features

- **Automated Statistical Analysis**: Instantly calculates mean, median, modes, outliers, category imbalances, and temporal trends right in your browser.
- **AI Hypothesis Generation**: Sends only the mathematical summaries to the Groq LLM API (Llama 3.1) to generate deeply analyzed, actionable business hypotheses. 
- **Interactive Visualizations**: Beautiful, dynamic line charts powered by Chart.js.
- **Conversational AI Assistant**: Chat with your dataset! Ask specific questions and get instant answers based on the computed metrics.
- **Theme Persistence & Mobile Ready**: Supports dynamic Light/Dark mode toggling that persists across pages, with a fully responsive dashboard design that gracefully collapses on mobile screens.

## 🛠️ Technology Stack

- **Frontend**: Vanilla JavaScript (ES6), HTML5, CSS3 
- **Visualization**: Chart.js
- **Backend / API Wrapper**: Node.js & Express (used to proxy API secrets securely without frontend exposure)
- **AI Engine**: Groq API (`llama-3.1-8b-instant`)

## 🚀 Getting Started Locally

### Prerequisites
- Node.js (v18+ recommended)
- A free API key from [Groq](https://console.groq.com/keys)

### Installation

1. **Clone or Download the Repository**
2. **Install Dependencies**
   Navigate to the project folder and run:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your Groq API key:
   ```env
   GROQ_API_KEY=your_actual_groq_api_key_here
   ```
4. **Start the Server**
   ```bash
   npm start
   ```
5. **View the App**
   Open your browser and navigate to `http://localhost:3000`.

## 📂 Project Structure

- `index.html` - The main application view and dashboard layout.
- `app.js` - Connects the frontend UI to the core logic, handling DOM updates, chart rendering, and theme toggling.
- `engine.js` - The heavy-lifting mathematical core; processes CSVs, infers data types, calculates stats, and formats the AI prompts.
- `server.mjs` - A lightweight Express server hosting the static files and actively securing the `/api/groq` endpoint.
- `api/groq.js` - The serverless function logic utilized by the backend to fetch completions from Groq.
- `style.css` - Custom styling utilizing CSS variables for theme generation and mobile-responsive nested grids.

## 💡 Usage Guide
1. Create a `.env` and add your `GROQ_API_KEY`.
2. Boot the application via `npm start`.
3. Select a demo dataset from the top navigation dropdown (e.g., "Retail Sales"), or **Drag and Drop** your own `.csv` file into the primary zone.
4. Watch the engine automatically plot the data and generate hypothesis cards based on its findings!
5. Open the side chat panel to ask follow up questions like *"What's the maximum value for the Sales column?"*.

---
*Created with ❤️ by Vishal Aggarwal*
