import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import twilio from "twilio";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("farming.db");

// Twilio Client
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Nodemailer Transporter
const transporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

async function sendMotorNotification(farmId: number, newState: number) {
  const settings = db.prepare("SELECT phone_number, email, name FROM farm_settings JOIN farms ON farms.id = farm_settings.farm_id WHERE farm_id = ?").get(farmId) as any;
  
  if (!settings) return;

  const stateText = newState === 1 ? "ON" : "OFF";
  const message = `[Smart Farming] Motor for ${settings.name} is now ${stateText}.`;

  console.log(`Sending notification for ${settings.name}: ${message}`);

  // Store in database
  db.prepare("INSERT INTO notifications (farm_id, type, message) VALUES (?, ?, ?)").run(farmId, 'motor_alert', message);

  // SMS Notification
  if (settings.phone_number && twilioClient && process.env.TWILIO_PHONE_NUMBER) {
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: settings.phone_number
      });
      console.log(`SMS sent to ${settings.phone_number}`);
    } catch (err) {
      console.error("Failed to send SMS via Twilio:", err);
    }
  } else {
    if (!settings.phone_number) console.log("SMS skipped: No phone number set for farm.");
    if (!twilioClient) console.log("SMS skipped: Twilio credentials missing in environment.");
    if (!process.env.TWILIO_PHONE_NUMBER) console.log("SMS skipped: TWILIO_PHONE_NUMBER missing in environment.");
  }

  // Email Notification
  if (settings.email && transporter) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: settings.email,
        subject: `Motor Alert: ${settings.name}`,
        text: message,
        html: `<p><strong>Smart Farming Alert</strong></p><p>${message}</p>`
      });
      console.log(`Email sent to ${settings.email}`);
    } catch (err) {
      console.error("Failed to send email via Nodemailer:", err);
    }
  } else {
    if (!settings.email) console.log("Email skipped: No email set for farm.");
    if (!transporter) console.log("Email skipped: SMTP credentials missing in environment.");
  }
}

// Schema Migration: Check if new columns exist
try {
  db.prepare("SELECT farm_id FROM sensor_readings LIMIT 1").get();
  db.prepare("SELECT motor_voltage FROM sensor_readings LIMIT 1").get();
  db.prepare("SELECT manual_override FROM farm_settings LIMIT 1").get();
  db.prepare("SELECT phone_number FROM farm_settings LIMIT 1").get();
  db.prepare("SELECT email FROM farm_settings LIMIT 1").get();
} catch (e) {
  console.log("Old schema detected or missing columns, resetting database...");
  db.exec("DROP TABLE IF EXISTS sensor_readings");
  db.exec("DROP TABLE IF EXISTS farm_settings");
  db.exec("DROP TABLE IF EXISTS farms");
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS farms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    location TEXT
  );

  CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    soil_moisture REAL,
    temperature REAL,
    humidity REAL,
    is_raining INTEGER,
    irrigation_active INTEGER,
    well_water_level REAL,
    motor_voltage REAL,
    FOREIGN KEY (farm_id) REFERENCES farms(id)
  );

  CREATE TABLE IF NOT EXISTS farm_settings (
    farm_id INTEGER PRIMARY KEY,
    moisture_threshold REAL DEFAULT 30.0,
    auto_irrigation INTEGER DEFAULT 1,
    manual_override INTEGER DEFAULT 0,
    manual_motor_state INTEGER DEFAULT 0,
    phone_number TEXT,
    email TEXT,
    FOREIGN KEY (farm_id) REFERENCES farms(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farm_id INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    FOREIGN KEY (farm_id) REFERENCES farms(id)
  );
`);

// Seed farms and settings if empty
const farmCount = db.prepare("SELECT COUNT(*) as count FROM farms").get() as { count: number };
if (farmCount.count === 0) {
  const farms = [
    { name: "Coimbatore Main Gateway", location: "Gandhipuram" },
    { name: "Peelamedu Tech Hub", location: "Peelamedu" },
    { name: "RS Puram Orchard", location: "RS Puram" },
    { name: "Saravanampatti Field", location: "Saravanampatti" },
    { name: "Pollachi Coconut Grove", location: "Pollachi" }
  ];

  for (const farm of farms) {
    const info = db.prepare("INSERT INTO farms (name, location) VALUES (?, ?)").run(farm.name, farm.location);
    const farmId = info.lastInsertRowid;
    db.prepare("INSERT INTO farm_settings (farm_id, moisture_threshold, auto_irrigation, manual_override, manual_motor_state, phone_number, email) VALUES (?, ?, ?, ?, ?, ?, ?)").run(farmId, 30.0, 1, 0, 0, "", "");
    
    // Generate 7 days of historical dummy data (168 hours)
    const insertReading = db.prepare(`
      INSERT INTO sensor_readings (farm_id, soil_moisture, temperature, humidity, is_raining, irrigation_active, well_water_level, motor_voltage, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date();
    let currentMoisture = 45 + Math.random() * 10;
    let currentWellLevel = 85 + Math.random() * 10;
    let irrigationActive = 0;

    for (let i = 168; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hour = timestamp.getHours();
      
      // Simulate daily cycles
      const temp = 22 + Math.sin((hour - 6) * Math.PI / 12) * 8 + (Math.random() * 2 - 1);
      const humidity = 60 - Math.sin((hour - 6) * Math.PI / 12) * 20 + (Math.random() * 5 - 2.5);
      
      // Rain simulation (5% chance per hour)
      const isRaining = Math.random() < 0.05 ? 1 : 0;
      
      // Moisture logic
      if (isRaining) {
        currentMoisture += 5 + Math.random() * 5;
      } else if (irrigationActive) {
        currentMoisture += 8 + Math.random() * 4;
      } else {
        // Natural evaporation
        currentMoisture -= 0.5 + Math.random() * 0.5;
      }
      
      // Cap moisture
      currentMoisture = Math.min(Math.max(currentMoisture, 15), 95);

      // Irrigation logic (Auto)
      if (currentMoisture < 30) {
        irrigationActive = 1;
      } else if (currentMoisture > 70) {
        irrigationActive = 0;
      }

      // Well level logic
      if (irrigationActive) {
        currentWellLevel -= 1.5 + Math.random() * 0.5;
      } else {
        currentWellLevel += 0.2 + Math.random() * 0.1; // Slow recovery
      }
      currentWellLevel = Math.min(Math.max(currentWellLevel, 10), 100);

      // Motor voltage
      const motorVoltage = irrigationActive ? (220 + Math.random() * 20) : 0;
      
      insertReading.run(
        farmId, 
        parseFloat(currentMoisture.toFixed(1)), 
        parseFloat(temp.toFixed(1)), 
        parseFloat(humidity.toFixed(1)), 
        isRaining, 
        irrigationActive, 
        parseFloat(currentWellLevel.toFixed(1)), 
        parseFloat(motorVoltage.toFixed(1)),
        timestamp.toISOString()
      );
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/farms", (req, res) => {
    const farms = db.prepare("SELECT * FROM farms").all();
    res.json(farms);
  });

  app.get("/api/:farmId/sensors/latest", (req, res) => {
    const { farmId } = req.params;
    const latest = db.prepare("SELECT * FROM sensor_readings WHERE farm_id = ? ORDER BY id DESC LIMIT 1").get(farmId);
    res.json(latest || {
      farm_id: parseInt(farmId),
      soil_moisture: 45,
      temperature: 24,
      humidity: 60,
      is_raining: 0,
      irrigation_active: 0,
      well_water_level: 85,
      motor_voltage: 0
    });
  });

  app.get("/api/:farmId/sensors/history", (req, res) => {
    const { farmId } = req.params;
    const history = db.prepare("SELECT * FROM sensor_readings WHERE farm_id = ? ORDER BY id DESC LIMIT 20").all(farmId);
    res.json(history.reverse());
  });

  app.get("/api/:farmId/notifications", (req, res) => {
    const { farmId } = req.params;
    const notifications = db.prepare("SELECT * FROM notifications WHERE farm_id = ? ORDER BY id DESC LIMIT 50").all(farmId);
    res.json(notifications);
  });

  app.get("/api/:farmId/notifications/status", (req, res) => {
    const { farmId } = req.params;
    const settings = db.prepare("SELECT phone_number, email FROM farm_settings WHERE farm_id = ?").get(farmId) as any;
    
    res.json({
      sms: {
        configured: !!twilioClient && !!process.env.TWILIO_PHONE_NUMBER,
        target_set: !!settings?.phone_number && settings.phone_number !== "+1234567890",
        details: {
          sid: !!process.env.TWILIO_ACCOUNT_SID,
          token: !!process.env.TWILIO_AUTH_TOKEN,
          from: !!process.env.TWILIO_PHONE_NUMBER
        }
      },
      email: {
        configured: !!transporter,
        target_set: !!settings?.email && settings.email !== "farmer@example.com",
        details: {
          host: !!process.env.SMTP_HOST,
          user: !!process.env.SMTP_USER,
          pass: !!process.env.SMTP_PASS
        }
      }
    });
  });

  app.post("/api/:farmId/notifications/test", async (req, res) => {
    const { farmId } = req.params;
    await sendMotorNotification(parseInt(farmId), 1); // Simulate motor ON
    setTimeout(() => sendMotorNotification(parseInt(farmId), 0), 2000); // Simulate motor OFF
    res.json({ success: true, message: "Test notifications triggered. Check your logs and external services." });
  });

  app.post("/api/sensors/update", async (req, res) => {
    const { farm_id, soil_moisture, temperature, humidity, is_raining, irrigation_active, well_water_level, motor_voltage } = req.body;
    
    // Check for motor state change
    const lastReading = db.prepare("SELECT irrigation_active FROM sensor_readings WHERE farm_id = ? ORDER BY id DESC LIMIT 1").get(farm_id) as any;
    if (lastReading && lastReading.irrigation_active !== irrigation_active) {
      console.log(`Motor state change detected for farm ${farm_id}: ${lastReading.irrigation_active} -> ${irrigation_active}`);
      await sendMotorNotification(farm_id, irrigation_active);
    }

    db.prepare(`
      INSERT INTO sensor_readings (farm_id, soil_moisture, temperature, humidity, is_raining, irrigation_active, well_water_level, motor_voltage, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(farm_id, soil_moisture, temperature, humidity, is_raining, irrigation_active, well_water_level, motor_voltage);
    res.json({ success: true });
  });

  app.get("/api/:farmId/settings", (req, res) => {
    const { farmId } = req.params;
    const settings = db.prepare("SELECT * FROM farm_settings WHERE farm_id = ?").get(farmId);
    res.json(settings);
  });

  app.post("/api/settings", async (req, res) => {
    const { farm_id, moisture_threshold, auto_irrigation, manual_override, manual_motor_state, phone_number, email } = req.body;
    
    // Check for manual motor state change
    const currentSettings = db.prepare("SELECT manual_motor_state, manual_override FROM farm_settings WHERE farm_id = ?").get(farm_id) as any;
    if (currentSettings && manual_override && currentSettings.manual_motor_state !== manual_motor_state) {
      await sendMotorNotification(farm_id, manual_motor_state);
    }

    db.prepare(`
      UPDATE farm_settings 
      SET moisture_threshold = ?, 
          auto_irrigation = ?, 
          manual_override = ?, 
          manual_motor_state = ?,
          phone_number = ?,
          email = ?
      WHERE farm_id = ?
    `).run(
      moisture_threshold, 
      auto_irrigation ? 1 : 0, 
      manual_override ? 1 : 0, 
      manual_motor_state ? 1 : 0,
      phone_number || "",
      email || "",
      farm_id
    );
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
