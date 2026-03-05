import { StockTrendResponse } from "./api";

export function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

export function chartSeries(values: number[], width: number, height: number, yMin: number, yMax: number) {
  const safeRange = Math.max(yMax - yMin, 1);
  return values.map((v, idx) => {
    const x = (idx / Math.max(values.length - 1, 1)) * width;
    const y = height - ((v - yMin) / safeRange) * height;
    return { x, y };
  });
}

export function splitChart(
  trend: StockTrendResponse,
  metric: "on_hand" | "demand",
  scenarioForecast?: number[]
): {
  width: number;
  height: number;
  historyPath: string;
  forecastPath: string;
  scenarioPath: string;
  boundaryX: number;
} {
  const width = 740;
  const height = 220;

  const histValues =
    metric === "on_hand"
      ? trend.history.map((p) => p.on_hand)
      : trend.history.map((p) => Number(p.demand_qty ?? 0));
  const fcstValues =
    metric === "on_hand"
      ? trend.forecast.map((p) => p.on_hand)
      : trend.forecast.map((p) => Number(p.predicted_demand ?? 0));

  const merged = scenarioForecast
    ? [...histValues, ...fcstValues, ...scenarioForecast]
    : [...histValues, ...fcstValues];
  const yMin = Math.min(...merged) * 0.9;
  const yMax = Math.max(...merged) * 1.1;

  const historyPts = chartSeries(histValues, width, height, yMin, yMax);
  const historyPath = buildPath(historyPts);
  const boundaryX = historyPts[historyPts.length - 1]?.x ?? 0;

  const fcstPts = chartSeries(fcstValues, width * 0.24, height, yMin, yMax).map((p) => ({
    x: p.x + boundaryX,
    y: p.y,
  }));
  const forecastPath = buildPath(fcstPts);

  const scenarioPath = scenarioForecast
    ? buildPath(
        chartSeries(scenarioForecast, width * 0.24, height, yMin, yMax).map((p) => ({
          x: p.x + boundaryX,
          y: p.y,
        }))
      )
    : "";

  return { width, height, historyPath, forecastPath, scenarioPath, boundaryX };
}
