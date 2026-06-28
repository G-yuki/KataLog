import { useEffect, useState } from "react";
import { fetchWeatherForPrefecture, type WeatherCondition } from "../lib/weather";

export function useWeather(prefecture: string | undefined) {
  const [condition, setCondition] = useState<WeatherCondition | null>(null);

  useEffect(() => {
    if (!prefecture) return;
    fetchWeatherForPrefecture(prefecture).then(setCondition);
  }, [prefecture]);

  return condition;
}
