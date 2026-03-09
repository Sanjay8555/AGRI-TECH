import React, { useState, useEffect, useRef } from 'react';
import { 
  Sprout, 
  Droplets, 
  Thermometer, 
  CloudRain, 
  AlertTriangle, 
  Settings, 
  History,
  Wind,
  Sun,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  BarChart3,
  Waves,
  Zap,
  Moon,
  Sun as SunIcon,
  MapPin,
  ChevronDown,
  CloudSun
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { SensorData, FarmSettings, WeatherData, Farm, Notification } from './types';

// Mock Weather Data
const MOCK_WEATHER: WeatherData = {
  temp: 28,
  condition: 'Partly Cloudy',
  humidity: 65,
  wind: 12,
  forecast: [
    { day: 'Mon', temp: 29, condition: 'Sunny' },
    { day: 'Tue', temp: 27, condition: 'Rain' },
    { day: 'Wed', temp: 26, condition: 'Cloudy' },
    { day: 'Thu', temp: 30, condition: 'Sunny' },
  ]
};

export default function App() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [sensors, setSensors] = useState<SensorData | null>(null);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationStatus, setNotificationStatus] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [settings, setSettings] = useState<FarmSettings>({ 
    farm_id: 0,
    moisture_threshold: 30, 
    auto_irrigation: 1,
    manual_override: 0,
    manual_motor_state: 0,
    phone_number: "",
    email: ""
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'settings'>('dashboard');
  
  // Refs for simulation to avoid stale state in setInterval
  const settingsRef = useRef(settings);
  const sensorsRef = useRef(sensors);
  const selectedFarmIdRef = useRef(selectedFarmId);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    sensorsRef.current = sensors;
  }, [sensors]);

  useEffect(() => {
    selectedFarmIdRef.current = selectedFarmId;
  }, [selectedFarmId]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    fetchFarms();
    const interval = setInterval(simulateSensorUpdate, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedFarmId) {
      fetchData();
    }
  }, [selectedFarmId]);

  const fetchFarms = async () => {
    try {
      const res = await fetch('/api/farms');
      const data = await res.json();
      setFarms(data);
      if (data.length > 0 && !selectedFarmId) {
        setSelectedFarmId(data[0].id);
      }
    } catch (err) {
      console.error("Fetch farms error:", err);
    }
  };

  const fetchData = async () => {
    if (!selectedFarmId) return;
    try {
      const [latestRes, historyRes, settingsRes, notificationsRes, statusRes] = await Promise.all([
        fetch(`/api/${selectedFarmId}/sensors/latest`),
        fetch(`/api/${selectedFarmId}/sensors/history`),
        fetch(`/api/${selectedFarmId}/settings`),
        fetch(`/api/${selectedFarmId}/notifications`),
        fetch(`/api/${selectedFarmId}/notifications/status`)
      ]);
      
      const latestData = await latestRes.json();
      const historyData = await historyRes.json();
      const settingsData = await settingsRes.json();
      const notificationsData = await notificationsRes.json();
      const statusData = await statusRes.json();

      if (latestData && !latestData.error) setSensors(latestData);
      if (Array.isArray(historyData)) setHistory(historyData);
      if (settingsData && !settingsData.error) setSettings(settingsData);
      if (Array.isArray(notificationsData)) setNotifications(notificationsData);
      setNotificationStatus(statusData);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const simulateSensorUpdate = async (overrideSettings?: FarmSettings) => {
    const currentFarmId = selectedFarmIdRef.current;
    const currentSensors = sensorsRef.current;
    const currentSettings = overrideSettings || settingsRef.current;

    if (!currentFarmId || !currentSensors) return;
    
    const now = new Date();
    const hour = now.getHours();
    
    // Daily cycles for temp and humidity
    const newTemp = 22 + Math.sin((hour - 6) * Math.PI / 12) * 8 + (Math.random() * 2 - 1);
    const newHumidity = 60 - Math.sin((hour - 6) * Math.PI / 12) * 20 + (Math.random() * 5 - 2.5);
    
    // Rain simulation (rare)
    const isRaining = Math.random() < 0.02 ? 1 : 0;
    
    // Irrigation logic
    let irrigationActive = currentSensors.irrigation_active;
    if (currentSettings.manual_override) {
      irrigationActive = currentSettings.manual_motor_state;
    } else if (currentSettings.auto_irrigation) {
      if (currentSensors.soil_moisture < currentSettings.moisture_threshold) irrigationActive = 1;
      if (currentSensors.soil_moisture > currentSettings.moisture_threshold + 20) irrigationActive = 0;
    }

    // Moisture logic
    let newMoisture = currentSensors.soil_moisture;
    if (isRaining) {
      newMoisture += 0.5 + Math.random() * 0.5;
    } else if (irrigationActive) {
      newMoisture += 1.0 + Math.random() * 0.5;
    } else {
      newMoisture -= 0.05 + Math.random() * 0.05; // Slow evaporation
    }
    newMoisture = Math.min(Math.max(newMoisture, 10), 95);

    // Well water level simulation
    let newWellLevel = currentSensors.well_water_level || 85;
    if (irrigationActive) {
      newWellLevel -= 0.1 + Math.random() * 0.05;
    } else {
      newWellLevel += 0.01 + Math.random() * 0.01; // Very slow recovery
    }
    newWellLevel = Math.min(Math.max(newWellLevel, 5), 100);
    
    // Motor voltage simulation
    const newVoltage = irrigationActive ? 220 + Math.random() * 20 : 0;

    const update = {
      farm_id: currentFarmId,
      soil_moisture: parseFloat(newMoisture.toFixed(1)),
      temperature: parseFloat(newTemp.toFixed(1)),
      humidity: parseFloat(newHumidity.toFixed(1)),
      is_raining: isRaining,
      irrigation_active: irrigationActive,
      well_water_level: parseFloat(newWellLevel.toFixed(1)),
      motor_voltage: parseFloat(newVoltage.toFixed(1))
    };

    await fetch('/api/sensors/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update)
    });

    fetchData();
  };

  const updateSettings = async (newSettings: Partial<FarmSettings>) => {
    if (!selectedFarmId) return;
    const updated = { ...settings, ...newSettings, farm_id: selectedFarmId };
    setSettings(updated);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    
    // Trigger an immediate simulation update to reflect changes (like voltage) instantly
    setTimeout(() => simulateSensorUpdate(updated), 100);
  };

  return (
    <div className={cn(
      "min-h-screen flex flex-col md:flex-row transition-colors duration-300",
      darkMode ? "bg-stone-950 text-stone-100" : "bg-stone-50 text-stone-900"
    )}>
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 p-6 flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-500">
            <Sprout className="w-8 h-8" />
            <h1 className="text-xl font-bold tracking-tight">AgriSmart AI</h1>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
          >
            {darkMode ? <SunIcon className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="mb-4">
            <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-2 block px-4">
              Active Gateway
            </label>
            <div className="relative px-2">
              <select 
                value={selectedFarmId || ''} 
                onChange={(e) => setSelectedFarmId(parseInt(e.target.value))}
                className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-4 py-2 text-sm font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all dark:text-stone-200"
              >
                {farms.map(farm => (
                  <option key={farm.id} value={farm.id}>{farm.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
            </div>
          </div>

          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<BarChart3 className="w-5 h-5" />}
            label="Dashboard"
          />
          <NavItem 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History className="w-5 h-5" />}
            label="Farm Logs"
          />
          <NavItem 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
          />
        </div>

        <div className="mt-auto p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 mb-2">
            <CloudRain className="w-4 h-4" />
            <span className="text-sm font-semibold">Weather Alert</span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-500 leading-relaxed">
            Rain expected in 48 hours. Irrigation scheduled to pause.
          </p>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm font-bold tracking-wide uppercase">
                    {farms.find(f => f.id === selectedFarmId)?.location || 'Loading...'}
                  </span>
                </div>
                <h2 className="text-3xl font-bold text-stone-900 dark:text-white">
                  {farms.find(f => f.id === selectedFarmId)?.name || 'Farm Overview'}
                </h2>
                <p className="text-stone-500 dark:text-stone-400">Real-time monitoring and automated controls</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => updateSettings({ 
                    manual_override: settings.manual_override ? 0 : 1,
                    manual_motor_state: sensors?.irrigation_active ? 1 : 0
                  })}
                  className={cn(
                    "px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all",
                    settings.manual_override 
                      ? "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" 
                      : "bg-stone-100 text-stone-600 border border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700"
                  )}
                  title={settings.manual_override ? "Switch to Auto Mode" : "Switch to Manual Mode"}
                >
                  {settings.manual_override ? "Manual Mode" : "Auto Mode"}
                </button>

                {settings.manual_override === 1 && (
                  <button 
                    onClick={() => updateSettings({ manual_motor_state: settings.manual_motor_state ? 0 : 1 })}
                    className={cn(
                      "px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium transition-all shadow-sm",
                      settings.manual_motor_state 
                        ? "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600" 
                        : "bg-stone-200 text-stone-700 hover:bg-stone-300 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                    )}
                  >
                    <Droplets className="w-4 h-4" />
                    Motor: {settings.manual_motor_state ? 'ON' : 'OFF'}
                  </button>
                )}

                <div className={cn(
                  "px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium",
                  sensors?.irrigation_active 
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                    : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                )}>
                  <Droplets className={cn("w-4 h-4", sensors?.irrigation_active && "animate-pulse")} />
                  Irrigation: {sensors?.irrigation_active ? 'Active' : 'Idle'}
                </div>
              </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                icon={<Droplets className="text-blue-500" />}
                label="Soil Moisture"
                value={`${sensors?.soil_moisture ?? '--'}%`}
                trend={sensors && sensors.soil_moisture < settings.moisture_threshold ? "Critical" : "Optimal"}
                trendColor={sensors && sensors.soil_moisture < settings.moisture_threshold ? "text-red-500" : "text-emerald-500"}
              />
              <StatCard 
                icon={<Waves className="text-cyan-500" />}
                label="Well Water Level"
                value={`${sensors?.well_water_level ?? '--'}%`}
                trend={sensors && sensors.well_water_level < 20 ? "Low" : "Normal"}
                trendColor={sensors && sensors.well_water_level < 20 ? "text-red-500" : "text-emerald-500"}
              />
              <StatCard 
                icon={<Zap className="text-yellow-500" />}
                label="Motor Voltage"
                value={sensors?.irrigation_active ? `${sensors?.motor_voltage ?? '--'}V` : "0V"}
                trend={sensors?.irrigation_active ? "Running" : "OFF"}
                trendColor={sensors?.irrigation_active ? "text-blue-500" : "text-stone-400"}
              />
              <StatCard 
                icon={<Sun className="text-orange-500" />}
                label="Weather"
                value={`${MOCK_WEATHER.temp}°C`}
                trend={MOCK_WEATHER.condition}
                trendColor="text-stone-400"
              />
            </div>

            {/* Control Center */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg dark:text-white">Motor Control</h3>
                  <Zap className={cn("w-5 h-5", sensors?.irrigation_active ? "text-yellow-500 animate-pulse" : "text-stone-400")} />
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800">
                    <div>
                      <p className="text-sm font-bold dark:text-white">Automation Mode</p>
                      <p className="text-xs text-stone-500">System controls motor based on thresholds</p>
                    </div>
                    <button 
                      onClick={() => updateSettings({ manual_override: settings.manual_override ? 0 : 1 })}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        settings.manual_override ? "bg-stone-400" : "bg-emerald-500"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        settings.manual_override ? "translate-x-6" : "translate-x-1"
                      )} />
                    </button>
                  </div>

                  <div className={cn(
                    "p-4 rounded-2xl border transition-all",
                    settings.manual_override 
                      ? "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800" 
                      : "bg-stone-50/50 dark:bg-stone-800/20 border-transparent opacity-50 grayscale pointer-events-none"
                  )}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm font-bold dark:text-white">Manual Toggle</p>
                        <p className="text-xs text-stone-500">Force motor ON or OFF</p>
                      </div>
                      <button 
                        onClick={() => updateSettings({ manual_motor_state: settings.manual_motor_state ? 0 : 1 })}
                        className={cn(
                          "px-6 py-2 rounded-xl text-sm font-bold transition-all",
                          settings.manual_motor_state 
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                            : "bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300"
                        )}
                      >
                        {settings.manual_motor_state ? 'TURN OFF' : 'TURN ON'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-orange-500 uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3" />
                      Manual override active
                    </div>
                  </div>
                </div>
              </div>

              {/* Threshold Control */}
              <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg dark:text-white">Moisture Threshold</h3>
                  <Droplets className="w-5 h-5 text-blue-500" />
                </div>
                <div className="space-y-8">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-3xl font-bold text-stone-900 dark:text-white">{settings.moisture_threshold}%</p>
                      <p className="text-xs text-stone-500">Current trigger point</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Status</p>
                      <p className="text-sm font-medium dark:text-stone-300">
                        {sensors && sensors.soil_moisture < settings.moisture_threshold ? "Irrigating" : "Monitoring"}
                      </p>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="80" 
                    value={settings.moisture_threshold}
                    onChange={(e) => updateSettings({ moisture_threshold: parseInt(e.target.value) })}
                    className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                    <span>10% (Dry)</span>
                    <span>80% (Wet)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg dark:text-white">Moisture & Well Level Trends</h3>
                  <div className="flex gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1 dark:text-stone-400"><div className="w-3 h-3 bg-blue-500 rounded-full" /> Moisture</div>
                    <div className="flex items-center gap-1 dark:text-stone-400"><div className="w-3 h-3 bg-cyan-500 rounded-full" /> Well Level</div>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorMoisture" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorWell" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(t) => format(new Date(t), 'HH:mm')}
                        stroke="#94a3b8"
                        fontSize={12}
                      />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: darkMode ? '#1c1917' : '#ffffff',
                          borderRadius: '16px', 
                          border: darkMode ? '1px solid #292524' : 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                        }}
                        itemStyle={{ color: darkMode ? '#f5f5f4' : '#1c1917' }}
                      />
                      <Area type="monotone" dataKey="soil_moisture" stroke="#3b82f6" fillOpacity={1} fill="url(#colorMoisture)" strokeWidth={2} />
                      <Area type="monotone" dataKey="well_water_level" stroke="#06b6d4" fillOpacity={1} fill="url(#colorWell)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg dark:text-white">Recent Alerts</h3>
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-20" />
                      <p className="text-stone-400 text-xs font-medium">No recent alerts. System is stable.</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            {notif.type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {format(new Date(notif.timestamp), 'HH:mm')}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <button 
                  onClick={() => setActiveTab('history')}
                  className="mt-4 w-full py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-colors"
                >
                  View All Logs
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-8">
            <header>
              <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Farm Settings</h2>
              <p className="text-stone-500 dark:text-stone-400">Configure automation thresholds and system behavior</p>
            </header>

            <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-stone-900 dark:text-white">Auto-Irrigation</h4>
                    <p className="text-sm text-stone-500 dark:text-stone-400">Automatically activate pumps based on moisture levels</p>
                  </div>
                  <button 
                    onClick={() => updateSettings({ auto_irrigation: settings.auto_irrigation ? 0 : 1 })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-colors relative",
                      settings.auto_irrigation ? "bg-emerald-500" : "bg-stone-200 dark:bg-stone-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                      settings.auto_irrigation ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="pt-6 border-t border-stone-100 dark:border-stone-800">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-stone-900 dark:text-white">Moisture Threshold</h4>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{settings.moisture_threshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="80" 
                    value={settings.moisture_threshold}
                    onChange={(e) => updateSettings({ moisture_threshold: parseInt(e.target.value) })}
                    className="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-stone-400 font-bold mt-2">
                    <span>10% (DRY)</span>
                    <span>80% (WET)</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-stone-100 dark:border-stone-800 space-y-4">
                <h4 className="font-bold text-stone-900 dark:text-white">System Notifications</h4>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Mobile Number for Alerts</label>
                    <input 
                      type="tel" 
                      placeholder="+1234567890"
                      value={settings.phone_number || ''}
                      onChange={(e) => updateSettings({ phone_number: e.target.value })}
                      className="w-full p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-white"
                    />
                    <p className="text-[10px] text-stone-400">Enter your number with country code to receive SMS notifications.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Email Address for Alerts</label>
                    <input 
                      type="email" 
                      placeholder="farmer@example.com"
                      value={settings.email || ''}
                      onChange={(e) => updateSettings({ email: e.target.value })}
                      className="w-full p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-white"
                    />
                    <p className="text-[10px] text-stone-400">Enter your email to receive notifications when the motor turns ON or OFF.</p>
                  </div>
                  
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500" />
                    <span className="text-sm font-medium dark:text-stone-300">Disease Alerts</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 cursor-pointer">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-500" />
                    <span className="text-sm font-medium dark:text-stone-300">Irrigation Status</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-100 dark:border-stone-800 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-emerald-500" />
                    <span className="text-sm font-medium dark:text-stone-300">Weekly Analytics Report</span>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30">
                  <div className="flex gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="space-y-3 flex-1">
                      <div>
                        <h5 className="text-sm font-bold text-amber-900 dark:text-amber-400">Notification Health Check</h5>
                        <p className="text-xs text-amber-800/70 dark:text-amber-400/60 leading-relaxed">
                          Real-time alerts require external service configuration.
                        </p>
                      </div>

                      {notificationStatus && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-white/50 dark:bg-stone-900/50 border border-amber-200/50 dark:border-amber-900/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/60 dark:text-amber-400/60">SMS (Twilio)</span>
                              {notificationStatus.sms.configured && notificationStatus.sms.target_set ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                            <ul className="space-y-1">
                              <li className="flex items-center gap-2 text-[10px]">
                                <div className={cn("w-1.5 h-1.5 rounded-full", notificationStatus.sms.details.sid ? "bg-emerald-500" : "bg-red-500")} />
                                <span className="text-amber-900/70 dark:text-amber-400/70">Account SID</span>
                              </li>
                              <li className="flex items-center gap-2 text-[10px]">
                                <div className={cn("w-1.5 h-1.5 rounded-full", notificationStatus.sms.details.token ? "bg-emerald-500" : "bg-red-500")} />
                                <span className="text-amber-900/70 dark:text-amber-400/70">Auth Token</span>
                              </li>
                              <li className="flex items-center gap-2 text-[10px]">
                                <div className={cn("w-1.5 h-1.5 rounded-full", notificationStatus.sms.target_set ? "bg-emerald-500" : "bg-red-500")} />
                                <span className="text-amber-900/70 dark:text-amber-400/70">Phone Number Set</span>
                              </li>
                            </ul>
                          </div>

                          <div className="p-3 rounded-xl bg-white/50 dark:bg-stone-900/50 border border-amber-200/50 dark:border-amber-900/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900/60 dark:text-amber-400/60">Email (SMTP)</span>
                              {notificationStatus.email.configured && notificationStatus.email.target_set ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <XCircle className="w-3 h-3 text-red-500" />
                              )}
                            </div>
                            <ul className="space-y-1">
                              <li className="flex items-center gap-2 text-[10px]">
                                <div className={cn("w-1.5 h-1.5 rounded-full", notificationStatus.email.details.host ? "bg-emerald-500" : "bg-red-500")} />
                                <span className="text-amber-900/70 dark:text-amber-400/70">SMTP Host</span>
                              </li>
                              <li className="flex items-center gap-2 text-[10px]">
                                <div className={cn("w-1.5 h-1.5 rounded-full", notificationStatus.email.details.user ? "bg-emerald-500" : "bg-red-500")} />
                                <span className="text-amber-900/70 dark:text-amber-400/70">SMTP User</span>
                              </li>
                              <li className="flex items-center gap-2 text-[10px]">
                                <div className={cn("w-1.5 h-1.5 rounded-full", notificationStatus.email.target_set ? "bg-emerald-500" : "bg-red-500")} />
                                <span className="text-amber-900/70 dark:text-amber-400/70">Email Address Set</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}

                      <button 
                        onClick={async () => {
                          if (!selectedFarmId) return;
                          const res = await fetch(`/api/${selectedFarmId}/notifications/test`, { method: 'POST' });
                          const data = await res.json();
                          fetchData();
                          alert(data.message);
                        }}
                        className="mt-2 px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
                      >
                        Send Test Notification
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <header>
              <h2 className="text-3xl font-bold text-stone-900 dark:text-white">Farm Logs</h2>
              <p className="text-stone-500 dark:text-stone-400">Historical data and system activities</p>
            </header>

            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50 border-bottom border-stone-200 dark:border-stone-800">
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Time</th>
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Moisture</th>
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Well Level</th>
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Voltage</th>
                    <th className="p-4 text-xs font-bold text-stone-400 uppercase tracking-widest">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice().reverse().map((log) => (
                    <tr key={log.id} className="border-b border-stone-50 dark:border-stone-800 hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition-colors">
                      <td className="p-4 text-sm text-stone-600 dark:text-stone-400">
                        {format(new Date(log.timestamp), 'HH:mm:ss')}
                      </td>
                      <td className="p-4 font-medium dark:text-stone-200">{log.soil_moisture}%</td>
                      <td className="p-4 text-stone-600 dark:text-stone-400">{log.well_water_level}%</td>
                      <td className="p-4 text-stone-600 dark:text-stone-400">{log.motor_voltage}V</td>
                      <td className="p-4">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                          log.irrigation_active 
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                            : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-500"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", log.irrigation_active ? "bg-blue-500" : "bg-stone-400")} />
                          {log.irrigation_active ? 'Irrigating' : 'Idle'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-medium",
        active 
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20" 
          : "text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value, trend, trendColor }: { icon: React.ReactNode, label: string, value: string, trend: string, trendColor: string }) {
  return (
    <div className="bg-white dark:bg-stone-900 p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-stone-50 dark:bg-stone-800 rounded-xl">{icon}</div>
        <span className={cn("text-[10px] font-bold uppercase tracking-wider", trendColor)}>{trend}</span>
      </div>
      <div>
        <p className="text-stone-400 dark:text-stone-500 text-xs font-semibold mb-1">{label}</p>
        <p className="text-2xl font-bold text-stone-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
