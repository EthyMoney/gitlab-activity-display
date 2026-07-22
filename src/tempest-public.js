'use strict';

const SITE_ORIGIN = 'https://tempestwx.com';
const API_ORIGIN = 'https://swd.weatherflow.com/swd/rest/';

function extractMainScriptUrl(html, baseUrl = SITE_ORIGIN) {
  const matches = [...String(html).matchAll(/<script[^>]+src=["']([^"']+)["']/gi)];
  const source = matches.map((match) => match[1]).find((value) => /\/js\/main-[\w-]+\.min\.js(?:\?|$)/.test(value));
  if (!source) throw new Error('Tempest public site bundle was not found');
  return new URL(source, baseUrl).toString();
}

function extractApiKey(javascript) {
  const match = String(javascript).match(/SWD\.API_KEY\s*=\s*["']([^"']+)["']/);
  if (!match) throw new Error('Tempest public API key was not found');
  return match[1];
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'KitchenWeatherDisplay/1.0' }
    });
    if (!response.ok) throw new Error(`Tempest request failed (${response.status})`);
    const data = await response.json();
    if (data?.status?.status_code && data.status.status_code !== 0) {
      throw new Error(data.status.status_message || 'Tempest returned an error');
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'KitchenWeatherDisplay/1.0' }
    });
    if (!response.ok) throw new Error(`Tempest public site failed (${response.status})`);
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function firstNumber(...values) {
  return values.find((value) => Number.isFinite(value)) ?? null;
}

function alertLevel(event) {
  const value = String(event || '').toLowerCase();
  if (/emergency|warning/.test(value)) return 'warning';
  if (/watch/.test(value)) return 'watch';
  if (/advisory|alert/.test(value)) return 'advisory';
  return 'statement';
}

function normalizeAlertDescription(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<li(?:\s[^>]*)?>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
      if (entity[0] === '#') {
        const hexadecimal = entity[1].toLowerCase() === 'x';
        const code = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
        return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
      }
      return entities[entity.toLowerCase()] ?? match;
    })
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 24000);
}

function normalizeAlerts(alerts, now = Math.floor(Date.now() / 1000)) {
  const levels = { warning: 0, watch: 1, advisory: 2, statement: 3 };
  return (Array.isArray(alerts) ? alerts : [])
    .map((alert, index) => {
      const event = String(alert?.event || 'Weather alert').trim();
      const color = String(alert?.color || '').replace(/^#/, '');
      return {
        id: String(alert?.id || `${event}-${index}`),
        event,
        issuer: String(alert?.issuer || 'National Weather Service').trim(),
        description: normalizeAlertDescription(alert?.description),
        effectiveEpoch: firstNumber(alert?.effectiveEpoch, alert?.effective_epoch, alert?.startEpoch, alert?.start_epoch, null),
        startEpoch: firstNumber(alert?.startEpoch, alert?.start_epoch, alert?.effective_epoch, null),
        endsEpoch: firstNumber(alert?.endsEpoch, alert?.ends_epoch, null),
        priority: firstNumber(alert?.priority, null),
        color: /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : null,
        level: alertLevel(event)
      };
    })
    .filter((alert) => !Number.isFinite(alert.endsEpoch) || alert.endsEpoch > now)
    .sort((a, b) => (levels[a.level] - levels[b.level]) || ((a.priority ?? 9999) - (b.priority ?? 9999)));
}

function normalizeDaily(day) {
  return {
    timestamp: firstNumber(day.day_start_local, day.day_start, day.time),
    conditions: day.conditions || 'Forecast',
    icon: day.icon || '',
    highC: firstNumber(day.air_temp_high, day.air_temperature_high),
    lowC: firstNumber(day.air_temp_low, day.air_temperature_low),
    precipProbability: firstNumber(day.precip_probability, 0),
    precipMm: firstNumber(day.precip, 0),
    windMps: firstNumber(day.wind_avg, null),
    sunrise: firstNumber(day.sunrise, null),
    sunset: firstNumber(day.sunset, null)
  };
}

function normalizeHourly(hour) {
  return {
    timestamp: firstNumber(hour.time, null),
    conditions: hour.conditions || 'Forecast',
    icon: hour.icon || '',
    tempC: firstNumber(hour.air_temperature, null),
    feelsC: firstNumber(hour.feels_like, null),
    humidity: firstNumber(hour.relative_humidity, null),
    seaLevelPressureMb: firstNumber(hour.sea_level_pressure, null),
    stationPressureMb: firstNumber(hour.station_pressure, null),
    precipMm: firstNumber(hour.precip, 0),
    precipProbability: firstNumber(hour.precip_probability, 0),
    windMps: firstNumber(hour.wind_avg, null),
    windGustMps: firstNumber(hour.wind_gust, null),
    windDegrees: firstNumber(hour.wind_direction, null),
    uv: firstNumber(hour.uv, null)
  };
}

function normalizeHistoryRow(row) {
  if (!Array.isArray(row) || !Number.isFinite(row[0])) return null;
  return {
    timestamp: row[0],
    windLullMps: firstNumber(row[1], null),
    windMps: firstNumber(row[2], null),
    windGustMps: firstNumber(row[3], null),
    windDegrees: firstNumber(row[4], null),
    stationPressureMb: firstNumber(row[6], null),
    tempC: firstNumber(row[7], null),
    humidity: firstNumber(row[8], null),
    illuminanceLux: firstNumber(row[9], null),
    uv: firstNumber(row[10], null),
    solarWm2: firstNumber(row[11], null),
    rainMm: firstNumber(row[12], 0),
    precipitationType: firstNumber(row[13], 0),
    lightningDistanceKm: firstNumber(row[14], null),
    lightningCount: firstNumber(row[15], 0),
    batteryVolts: firstNumber(row[16], null)
  };
}

function aggregateObservations(points, bucketSeconds) {
  if (!Number.isFinite(bucketSeconds) || bucketSeconds <= 1) return points;
  const averageKeys = ['windLullMps', 'windMps', 'stationPressureMb', 'tempC', 'humidity', 'illuminanceLux', 'solarWm2', 'batteryVolts'];
  const buckets = new Map();
  for (const point of points) {
    const bucketTime = Math.floor(point.timestamp / bucketSeconds) * bucketSeconds;
    if (!buckets.has(bucketTime)) {
      buckets.set(bucketTime, {
        timestamp: bucketTime + Math.floor(bucketSeconds / 2),
        sums: Object.create(null), counts: Object.create(null),
        windGustMps: null, uv: null, rainMm: 0, lightningCount: 0,
        windDegrees: null, precipitationType: 0, lightningDistanceKm: null
      });
    }
    const bucket = buckets.get(bucketTime);
    for (const key of averageKeys) {
      if (!Number.isFinite(point[key])) continue;
      bucket.sums[key] = (bucket.sums[key] || 0) + point[key];
      bucket.counts[key] = (bucket.counts[key] || 0) + 1;
    }
    if (Number.isFinite(point.windGustMps)) bucket.windGustMps = Math.max(bucket.windGustMps ?? -Infinity, point.windGustMps);
    if (Number.isFinite(point.uv)) bucket.uv = Math.max(bucket.uv ?? -Infinity, point.uv);
    bucket.rainMm += Number(point.rainMm) || 0;
    bucket.lightningCount += Number(point.lightningCount) || 0;
    if (Number.isFinite(point.windDegrees)) bucket.windDegrees = point.windDegrees;
    if (Number.isFinite(point.precipitationType)) bucket.precipitationType = Math.max(bucket.precipitationType, point.precipitationType);
    if (Number.isFinite(point.lightningDistanceKm)) bucket.lightningDistanceKm = point.lightningDistanceKm;
  }
  return [...buckets.values()].map((bucket) => {
    const output = {
      timestamp: bucket.timestamp,
      windGustMps: bucket.windGustMps,
      uv: bucket.uv,
      rainMm: bucket.rainMm,
      lightningCount: bucket.lightningCount,
      windDegrees: bucket.windDegrees,
      precipitationType: bucket.precipitationType,
      lightningDistanceKm: bucket.lightningDistanceKm
    };
    for (const key of averageKeys) {
      output[key] = bucket.counts[key] ? bucket.sums[key] / bucket.counts[key] : null;
    }
    return output;
  }).sort((a, b) => a.timestamp - b.timestamp);
}

function normalizeTempest(stationId, observations, forecast, alerts = []) {
  const obs = observations?.obs?.[0] || {};
  const current = forecast?.current_conditions || {};
  const daily = forecast?.forecast?.daily || [];
  const hourly = forecast?.forecast?.hourly || [];
  const timestamp = firstNumber(obs.timestamp, current.time, Math.floor(Date.now() / 1000));
  return {
    source: 'tempest-public',
    station: {
      id: String(stationId),
      name: observations.public_name || observations.station_name || `Tempest ${stationId}`,
      latitude: firstNumber(observations.latitude, null),
      longitude: firstNumber(observations.longitude, null)
    },
    timestamp,
    fetchedAt: Math.floor(Date.now() / 1000),
    current: {
      conditions: current.conditions || 'Current conditions',
      icon: current.icon || '',
      tempC: firstNumber(obs.air_temperature, current.air_temperature),
      feelsC: firstNumber(obs.feels_like, current.feels_like),
      dewPointC: firstNumber(obs.dew_point, current.dew_point),
      humidity: firstNumber(obs.relative_humidity, current.relative_humidity),
      pressureMb: firstNumber(obs.sea_level_pressure, current.sea_level_pressure, obs.station_pressure),
      pressureTrend: obs.pressure_trend || current.pressure_trend || 'steady',
      windMps: firstNumber(obs.wind_avg, current.wind_avg),
      windGustMps: firstNumber(obs.wind_gust, current.wind_gust),
      windLullMps: firstNumber(obs.wind_lull, null),
      windDegrees: firstNumber(obs.wind_direction, current.wind_direction),
      rainTodayMm: firstNumber(obs.precip_accum_local_day, current.precip_accum_local_day, 0),
      rainYesterdayMm: firstNumber(obs.precip_accum_local_yesterday, current.precip_accum_local_yesterday, 0),
      rainHourMm: firstNumber(obs.precip_accum_last_1hr, 0),
      precipProbability: firstNumber(current.precip_probability, 0),
      solarWm2: firstNumber(obs.solar_radiation, current.solar_radiation),
      illuminanceLux: firstNumber(obs.brightness, current.brightness),
      uv: firstNumber(obs.uv, current.uv),
      lightningCountHour: firstNumber(obs.lightning_strike_count_last_1hr, current.lightning_strike_count_last_1hr, 0),
      lightningDistanceKm: firstNumber(obs.lightning_strike_last_distance, current.lightning_strike_last_distance),
      lightningEpoch: firstNumber(obs.lightning_strike_last_epoch, current.lightning_strike_last_epoch)
    },
    forecast: daily.slice(0, 6).map(normalizeDaily),
    hourly: hourly.map(normalizeHourly).filter((point) => Number.isFinite(point.timestamp)),
    alerts: normalizeAlerts(alerts),
    status: { state: 'live', message: 'Live Tempest station' }
  };
}

class TempestPublicProvider {
  constructor({ fetchJson: jsonFetcher = fetchJson, fetchText: textFetcher = fetchText } = {}) {
    this.fetchJson = jsonFetcher;
    this.fetchText = textFetcher;
    this.apiKey = null;
    this.apiKeyExpiresAt = 0;
    this.stationMetadata = new Map();
    this.alertsCache = new Map();
  }

  async resolveApiKey(stationId) {
    if (this.apiKey && Date.now() < this.apiKeyExpiresAt) return this.apiKey;
    const page = await this.fetchText(`${SITE_ORIGIN}/station/${stationId}/grid`);
    const bundleUrl = extractMainScriptUrl(page);
    const bundle = await this.fetchText(bundleUrl);
    this.apiKey = extractApiKey(bundle);
    this.apiKeyExpiresAt = Date.now() + (24 * 60 * 60 * 1000);
    return this.apiKey;
  }

  endpoint(path, apiKey, params = {}) {
    const url = new URL(path, API_ORIGIN);
    for (const [key, value] of Object.entries({ ...params, api_key: apiKey })) {
      url.searchParams.set(key, String(value));
    }
    return url;
  }

  async getAlerts(apiKey, latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const cached = this.alertsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return normalizeAlerts(cached.value);
    try {
      const response = await this.fetchJson(this.endpoint('alerts', apiKey, { lat: latitude, lon: longitude }));
      const alerts = Array.isArray(response?.alerts) ? response.alerts : [];
      this.alertsCache.set(cacheKey, { value: alerts, expiresAt: Date.now() + (5 * 60 * 1000) });
      return normalizeAlerts(alerts);
    } catch (error) {
      if (cached) return normalizeAlerts(cached.value);
      throw error;
    }
  }

  async getWeather(stationId) {
    if (!/^\d{1,10}$/.test(String(stationId))) throw new Error('Enter a valid Tempest station ID');
    const apiKey = await this.resolveApiKey(stationId);
    const metricParams = {
      units_temp: 'c', units_wind: 'mps', units_pressure: 'mb', units_precip: 'mm', units_distance: 'km'
    };
    const [observations, forecast] = await Promise.all([
      this.fetchJson(this.endpoint('observations/location', apiKey, { location_id: stationId })),
      this.fetchJson(this.endpoint('better_forecast', apiKey, { station_id: stationId, ...metricParams }))
    ]);
    if (!Array.isArray(observations?.obs) || !observations.obs.length) {
      throw new Error('Tempest guest observations are unavailable for this station');
    }
    if (!forecast?.current_conditions && !Array.isArray(forecast?.forecast?.daily)) {
      throw new Error('Tempest guest forecast is unavailable for this station');
    }
    let alerts = [];
    try {
      alerts = await this.getAlerts(
        apiKey,
        firstNumber(observations.latitude, forecast.latitude),
        firstNumber(observations.longitude, forecast.longitude)
      );
    } catch (error) {
      console.warn('Tempest alerts are temporarily unavailable:', error.message);
    }
    return normalizeTempest(stationId, observations, forecast, alerts);
  }

  async getStationMetadata(stationId, apiKey) {
    const cached = this.stationMetadata.get(String(stationId));
    if (cached && Date.now() < cached.expiresAt) return cached.value;
    const response = await this.fetchJson(this.endpoint(`stations/${stationId}`, apiKey));
    const station = response?.stations?.[0] || response?.locations?.[0];
    if (!station) throw new Error('Tempest station metadata is unavailable');
    this.stationMetadata.set(String(stationId), { value: station, expiresAt: Date.now() + (6 * 60 * 60 * 1000) });
    return station;
  }

  async getHistory(deviceId, apiKey, timeStart, timeEnd) {
    const maximumWindow = 5 * 24 * 60 * 60;
    const requests = [];
    let cursor = Math.floor(timeStart);
    const end = Math.floor(timeEnd);
    while (cursor <= end) {
      const chunkEnd = Math.min(cursor + maximumWindow, end);
      requests.push(this.fetchJson(this.endpoint(`observations/device/${deviceId}`, apiKey, {
        time_start: cursor,
        time_end: chunkEnd
      })));
      cursor = chunkEnd + 1;
    }
    const responses = await Promise.all(requests);
    return responses
      .flatMap((response) => response?.obs || [])
      .map(normalizeHistoryRow)
      .filter(Boolean)
      .filter((point, index, values) => index === 0 || point.timestamp !== values[index - 1].timestamp)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getWeatherDetails(stationId, { timeStart, timeEnd, bucketSeconds = 300 } = {}) {
    if (!/^\d{1,10}$/.test(String(stationId))) throw new Error('Enter a valid Tempest station ID');
    const apiKey = await this.resolveApiKey(stationId);
    const metricParams = {
      units_temp: 'c', units_wind: 'mps', units_pressure: 'mb', units_precip: 'mm', units_distance: 'km'
    };
    const [station, forecast] = await Promise.all([
      this.getStationMetadata(stationId, apiKey),
      this.fetchJson(this.endpoint('better_forecast', apiKey, { station_id: stationId, ...metricParams }))
    ]);
    const device = station.devices?.find((item) => item.device_type === 'ST')
      || station.devices?.find((item) => item.device_type !== 'HB');
    if (!device) throw new Error('No outdoor Tempest sensor was found');
    const observations = await this.getHistory(device.device_id, apiKey, timeStart, timeEnd);
    return {
      station: {
        id: String(stationId),
        name: station.public_name || station.name || `Tempest ${stationId}`,
        deviceId: device.device_id
      },
      observed: aggregateObservations(observations, bucketSeconds),
      forecast: (forecast?.forecast?.hourly || []).map(normalizeHourly).filter((point) => Number.isFinite(point.timestamp)),
      timezone: forecast.timezone || null,
      fetchedAt: Math.floor(Date.now() / 1000)
    };
  }
}

module.exports = {
  TempestPublicProvider,
  extractMainScriptUrl,
  extractApiKey,
  normalizeTempest,
  normalizeAlerts,
  normalizeAlertDescription,
  normalizeHourly,
  normalizeHistoryRow,
  aggregateObservations
};
