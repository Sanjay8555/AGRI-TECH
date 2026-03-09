export interface Farm {
  id: number;
  name: string;
  location: string;
}

export interface SensorData {
  id?: number;
  farm_id: number;
  timestamp: string;
  soil_moisture: number;
  temperature: number;
  humidity: number;
  is_raining: number;
  irrigation_active: number;
  well_water_level: number;
  motor_voltage: number;
}

export interface FarmSettings {
  farm_id: number;
  moisture_threshold: number;
  auto_irrigation: number;
  manual_override: number;
  manual_motor_state: number;
  phone_number: string;
  email: string;
}

export interface WeatherData {
  temp: number;
  condition: string;
  humidity: number;
  wind: number;
  forecast: { day: string; temp: number; condition: string }[];
}

export interface Notification {
  id: number;
  farm_id: number;
  timestamp: string;
  type: string;
  message: string;
  status: string;
}
