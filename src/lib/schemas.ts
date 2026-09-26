import { z } from "zod";

const nullableNumber = z.number().nullable();
const numberArray = z.array(nullableNumber);
const stringArray = z.array(z.string());

export const openMeteoForecastSchema = z.looseObject({
  latitude: z.number(),
  longitude: z.number(),
  generationtime_ms: z.number().optional(),
  utc_offset_seconds: z.number(),
  timezone: z.string(),
  timezone_abbreviation: z.string().optional(),
  elevation: z.number().optional(),
  current_units: z.looseObject({ time: z.string().optional() }).optional(),
  current: z
    .looseObject({
      time: z.string(),
      interval: z.number().optional(),
      temperature_2m: nullableNumber.optional(),
      relative_humidity_2m: nullableNumber.optional(),
      apparent_temperature: nullableNumber.optional(),
      is_day: nullableNumber.optional(),
      precipitation: nullableNumber.optional(),
      rain: nullableNumber.optional(),
      showers: nullableNumber.optional(),
      snowfall: nullableNumber.optional(),
      weather_code: nullableNumber.optional(),
      cloud_cover: nullableNumber.optional(),
      pressure_msl: nullableNumber.optional(),
      surface_pressure: nullableNumber.optional(),
      wind_speed_10m: nullableNumber.optional(),
      wind_direction_10m: nullableNumber.optional(),
      wind_gusts_10m: nullableNumber.optional(),
      uv_index: nullableNumber.optional(),
      dew_point_2m: nullableNumber.optional(),
      visibility: nullableNumber.optional(),
    })
    .optional(),
  hourly_units: z.looseObject({ time: z.string().optional() }).optional(),
  hourly: z
    .looseObject({
      time: stringArray,
      temperature_2m: numberArray.optional(),
      apparent_temperature: numberArray.optional(),
      precipitation_probability: numberArray.optional(),
      precipitation: numberArray.optional(),
      rain: numberArray.optional(),
      showers: numberArray.optional(),
      snowfall: numberArray.optional(),
      weather_code: numberArray.optional(),
      wind_speed_10m: numberArray.optional(),
      wind_gusts_10m: numberArray.optional(),
      wind_direction_10m: numberArray.optional(),
      relative_humidity_2m: numberArray.optional(),
      uv_index: numberArray.optional(),
      cloud_cover: numberArray.optional(),
      visibility: numberArray.optional(),
      dew_point_2m: numberArray.optional(),
      pressure_msl: numberArray.optional(),
    })
    .optional(),
  daily_units: z.looseObject({ time: z.string().optional() }).optional(),
  daily: z
    .looseObject({
      time: stringArray,
      weather_code: numberArray.optional(),
      temperature_2m_max: numberArray.optional(),
      temperature_2m_min: numberArray.optional(),
      apparent_temperature_max: numberArray.optional(),
      apparent_temperature_min: numberArray.optional(),
      sunrise: stringArray.optional(),
      sunset: stringArray.optional(),
      daylight_duration: numberArray.optional(),
      uv_index_max: numberArray.optional(),
      precipitation_probability_max: numberArray.optional(),
      precipitation_sum: numberArray.optional(),
      rain_sum: numberArray.optional(),
      showers_sum: numberArray.optional(),
      snowfall_sum: numberArray.optional(),
      wind_speed_10m_max: numberArray.optional(),
      wind_gusts_10m_max: numberArray.optional(),
      wind_direction_10m_dominant: numberArray.optional(),
    })
    .optional(),
});

export type OpenMeteoForecast = z.infer<typeof openMeteoForecastSchema>;

export const openMeteoMultiSchema = z.array(openMeteoForecastSchema);

export const airQualitySchema = z.looseObject({
  latitude: z.number(),
  longitude: z.number(),
  utc_offset_seconds: z.number(),
  timezone: z.string(),
  timezone_abbreviation: z.string().optional(),
  elevation: z.number().optional(),
  current_units: z.looseObject({ time: z.string().optional() }).optional(),
  current: z
    .looseObject({
      time: z.string(),
      interval: z.number().optional(),
      european_aqi: nullableNumber.optional(),
      us_aqi: nullableNumber.optional(),
      pm2_5: nullableNumber.optional(),
      pm10: nullableNumber.optional(),
      carbon_monoxide: nullableNumber.optional(),
      nitrogen_dioxide: nullableNumber.optional(),
      sulphur_dioxide: nullableNumber.optional(),
      ozone: nullableNumber.optional(),
      dust: nullableNumber.optional(),
      uv_index: nullableNumber.optional(),
      aerosol_optical_depth: nullableNumber.optional(),
      ammonia: nullableNumber.optional(),
    })
    .optional(),
  hourly_units: z.looseObject({ time: z.string().optional() }).optional(),
  hourly: z
    .looseObject({
      time: stringArray,
      european_aqi: numberArray.optional(),
      us_aqi: numberArray.optional(),
      pm2_5: numberArray.optional(),
      pm10: numberArray.optional(),
      carbon_monoxide: numberArray.optional(),
      nitrogen_dioxide: numberArray.optional(),
      sulphur_dioxide: numberArray.optional(),
      ozone: numberArray.optional(),
      dust: numberArray.optional(),
      uv_index: numberArray.optional(),
      aerosol_optical_depth: numberArray.optional(),
    })
    .optional(),
});

export type AirQualityData = z.infer<typeof airQualitySchema>;

export const geocodeResultSchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().optional(),
  feature_code: z.string().optional(),
  country_code: z.string().optional(),
  timezone: z.string().optional(),
  population: z.number().optional(),
  country: z.string().optional(),
  country_id: z.number().optional(),
  admin1: z.string().optional(),
  admin2: z.string().optional(),
  admin3: z.string().optional(),
  postcodes: z.array(z.string()).optional(),
});

export const geocodeResponseSchema = z.looseObject({
  results: z.array(geocodeResultSchema).optional(),
  generationtime_ms: z.number().optional(),
});

export type GeocodeResult = z.infer<typeof geocodeResultSchema>;

export const nominatimSchema = z.looseObject({
  place_id: z.number().optional(),
  licence: z.string().optional(),
  lat: z.string().optional(),
  lon: z.string().optional(),
  category: z.string().optional(),
  type: z.string().optional(),
  addresstype: z.string().optional(),
  name: z.string().optional(),
  display_name: z.string().optional(),
  address: z
    .looseObject({
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      municipality: z.string().optional(),
      county: z.string().optional(),
      state_district: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      country_code: z.string().optional(),
      suburb: z.string().optional(),
    })
    .optional(),
});

export const rainViewerSchema = z.looseObject({
  version: z.string().optional(),
  generated: z.number(),
  host: z.string(),
  radar: z
    .looseObject({
      past: z.array(z.looseObject({ time: z.number(), path: z.string() })).optional(),
      nowcast: z.array(z.looseObject({ time: z.number(), path: z.string() })).optional(),
    })
    .optional(),
  satellite: z
    .looseObject({
      infrared: z.array(z.looseObject({ time: z.number(), path: z.string() })).optional(),
    })
    .optional(),
});

export type RainViewerManifest = z.infer<typeof rainViewerSchema>;

const nwsAlertPropertiesSchema = z.looseObject({
  id: z.string(),
  areaDesc: z.string().optional(),
  sent: z.string().optional(),
  effective: z.string().optional(),
  onset: z.string().optional(),
  expires: z.string().optional(),
  ends: z.string().optional(),
  status: z.string().optional(),
  messageType: z.string().optional(),
  category: z.string().optional(),
  severity: z.string().optional(),
  certainty: z.string().optional(),
  urgency: z.string().optional(),
  event: z.string().optional(),
  senderName: z.string().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  instruction: z.string().optional(),
  response: z.string().optional(),
  web: z.string().optional(),
});

export const nwsAlertsSchema = z.looseObject({
  features: z.array(z.looseObject({ id: z.string().optional(), properties: nwsAlertPropertiesSchema })).optional(),
  title: z.string().optional(),
  updated: z.string().optional(),
});

export type NwsAlertProperties = z.infer<typeof nwsAlertPropertiesSchema>;

export const sachetAlertSchema = z.looseObject({
  severity: z.string().optional(),
  identifier: z.number().optional(),
  effective_start_time: z.string().optional(),
  effective_end_time: z.string().optional(),
  disaster_type: z.string().optional(),
  area_description: z.string().optional(),
  severity_level: z.string().optional(),
  warning_message: z.string().optional(),
  severity_color: z.string().optional(),
  centroid: z.string().optional(),
  alert_source: z.string().optional(),
  area_covered: z.string().optional(),
  actual_lang: z.string().optional(),
  disseminated: z.string().optional(),
});

export const sachetAlertsSchema = z.array(sachetAlertSchema);

export type SachetAlert = z.infer<typeof sachetAlertSchema>;

const gdacsGeometrySchema = z.looseObject({
  type: z.string(),
  coordinates: z.unknown(),
});

const gdacsPropertiesSchema = z.looseObject({
  eventtype: z.string().optional(),
  eventid: z.number().optional(),
  episodeid: z.number().optional(),
  eventname: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  htmldescription: z.string().optional(),
  icon: z.string().optional(),
  alertlevel: z.string().optional(),
  alertscore: z.number().optional(),
  episodealertlevel: z.string().optional(),
  fromdate: z.string().optional(),
  todate: z.string().optional(),
  datemodified: z.string().optional(),
  country: z.string().optional(),
  iso3: z.string().optional(),
  source: z.string().optional(),
  url: z.looseObject({ report: z.string().optional(), details: z.string().optional(), geometry: z.string().optional() }).optional(),
});

export const gdacsSchema = z.looseObject({
  features: z
    .array(
      z.looseObject({
        geometry: gdacsGeometrySchema.optional(),
        properties: gdacsPropertiesSchema,
      })
    )
    .optional(),
});

export type GdacsFeature = z.infer<typeof gdacsSchema>["features"] extends Array<infer T> | undefined ? T : never;
