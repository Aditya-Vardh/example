
# AETHER WEATHER

### Understand the atmosphere.

AETHER is a next-generation weather intelligence platform designed to transform how people explore weather, forecasts, and atmospheric conditions through real-time data, immersive visualizations, and an interactive user experience.

## Features

- Live Weather: Current weather conditions using real weather data.
- Interactive Weather Map: Explore locations, radar imagery, and weather layers.
- Smart Forecasts: Interactive hourly and daily forecasts with temperature and precipitation trends.
- Air Quality: Monitor AQI and available pollutant measurements.
- Weather Alerts: View available official weather warnings and regional alerts.
- Location Search: Search cities and explore weather conditions around the world.
- Personalized Experience: Save favorite locations and customize temperature units.
- Immersive UI: Glassmorphism, animated weather scenes, responsive layouts, and interactive forecast cards.

## Tech Stack

- Next.js
- TypeScript
- React
- Tailwind CSS
- Motion
- MapLibre GL JS
- Open-Meteo API
- RainViewer API

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Installation

Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
cd aether-weather-starter
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Environment Variables

Some integrations may require API keys or configuration.

Create a `.env.local` file in the project root and add the required variables documented in the project configuration.

Never commit private API keys or secrets to GitHub.

## Data Sources

AETHER uses external weather services to retrieve weather conditions, forecasts, map tiles, radar imagery, and air-quality information.

Weather data: Open-Meteo

Radar data: RainViewer

Map data and attribution: Refer to the map provider and tile source used by the application.

Data availability, update frequency, and geographical coverage depend on the respective providers.

## Project Status

AETHER WEATHER is under active development. Features and integrations are being continuously improved.

## License

The project's license will be specified here when selected.