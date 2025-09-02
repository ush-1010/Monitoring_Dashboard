// server.js
const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();
app.use(cors());

// Database connection config
/*
const dbConfig = {
  user: "monitor",
  password: "NewPass123",
  server: "127.16.20.100",     // Your DB server
  database: "InfraMonitorDB",
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};
*/

// Database connection config updated for Windows Authentication
const dbConfig = {
  server: "castel",      // Your DB server
  database: "InfraMonitorDB",
  options: {
    encrypt: false,
    trustServerCertificate: true,
    trustedConnection: true // <--- Use this for Windows Authentication
  }
};



// GET API for dashboard
app.get("/api/monitor", async (req, res) => {
  try {
    await sql.connect(dbConfig);

    const result = await sql.query(`
      SELECT 
        s.Hostname,
        s.CaptureTime,
        s.CPU_Percent,
        s.RAMFreeGB,
        s.TotalRAMGB,
        s.LastBoot,
        d.DeviceID,
        d.FreeGB,
        d.SizeGB
      FROM ServerStatus s
      LEFT JOIN DiskStatus d ON s.ID = d.ServerStatusID
      ORDER BY s.CaptureTime ASC
    `);

    /// Group by Hostname + CaptureTime
    const grouped = {};
    result.recordset.forEach(row => {
      const key = `${row.Hostname}-${row.CaptureTime?.getTime?.() || 0}`;
      if (!grouped[key]) {
        grouped[key] = {
          Hostname: row.Hostname || null,
          CaptureTime: row.CaptureTime || null,
          CPU_Percent: row.CPU_Percent !== undefined ? row.CPU_Percent : null,
          RAMFreeGB: row.RAMFreeGB !== undefined ? row.RAMFreeGB : null,
          TotalRAMGB: row.TotalRAMGB !== undefined ? row.TotalRAMGB : null,
          LastBoot: row.LastBoot || null,
          Disk: []
        };
      }

      // Even if disk info is missing, push null object so UI sees consistent array
      if (row.DeviceID) {
        grouped[key].Disk.push({
          DeviceID: row.DeviceID || null,
          FreeGB: row.FreeGB !== undefined ? row.FreeGB : null,
          SizeGB: row.SizeGB !== undefined ? row.SizeGB : null
        });
      }
    });

    // If no disk data came at all, ensure Disk = [ { DeviceID:null, FreeGB:null, SizeGB:null } ]
    Object.values(grouped).forEach(entry => {
      if (entry.Disk.length === 0) {
        entry.Disk.push({
          DeviceID: null,
          FreeGB: null,
          SizeGB: null
        });
      }
    });

    res.json(Object.values(grouped));
  } catch (err) {
    console.error(err);
    res.status(500).send("Database query failed");
  }
});

app.listen(3000, () => console.log("API running on http://localhost:3000"));