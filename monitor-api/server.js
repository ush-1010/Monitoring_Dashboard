const express = require('express');
const sql = require('mssql');
const path = require('path');

// Create Express app and configure view engine
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
  user: 'monitor',
  password: 'NewPass123',
  server: 'castel', // Change if needed
  database: 'InfraMonitorDB',
  options: { encrypt: false, trustServerCertificate: true }
};

// Utility: group rows into host objects with disk arrays
function groupData(recordset) {
  const grouped = {};
  recordset.forEach(r => {
    if (!grouped[r.Hostname]) grouped[r.Hostname] = [];
    let point = grouped[r.Hostname].find(
      p => new Date(p.Time).getTime() === new Date(r.Time).getTime()
    );
    if (!point) {
      point = {
        Hostname: r.Hostname,
        CPU: r.CPU,
        RAMFreeGB: r.RAMFreeGB,
        TotalRAMGB: r.TotalRAMGB,
        LastBoot: r.LastBoot,
        Time: r.Time,
        Disk: []
      };
      grouped[r.Hostname].push(point);
    }
    point.Disk.push({
      DeviceID: r.DeviceID,
      FreeGB: r.FreeGB,
      SizeGB: r.SizeGB
    });
  });
  return grouped;
}

// Dashboard Route
app.get('/', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      WITH LastStatus AS (
        SELECT *
        FROM (
          SELECT
            s.ID,
            s.Hostname,
            s.CPU_Percent AS CPU,
            s.RAMFreeGB,
            s.TotalRAMGB,
            s.LastBoot,
            s.CaptureTime AS Time,
            ROW_NUMBER() OVER (PARTITION BY s.Hostname ORDER BY s.CaptureTime DESC) AS rn
          FROM ServerStatus s
        ) t
        WHERE rn <= 15
      )
      SELECT
        l.Hostname,
        l.CPU,
        l.RAMFreeGB,
        l.TotalRAMGB,
        l.LastBoot,
        l.Time,
        d.DeviceID,
        d.FreeGB,
        d.SizeGB
      FROM LastStatus l
      JOIN DiskStatus d ON l.ID = d.ServerStatusID
      ORDER BY l.Hostname, l.Time;
    `);

    const grouped = groupData(result.recordset);
    res.render('index', { data: Object.values(grouped).flat() });
  } catch (err) {
    console.error(err);
    res.send('Database error');
  }
});

// API Route (for live JSON fetch)
app.get('/api/data', async (req, res) => {
  try {
    let pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      WITH LastStatus AS (
        SELECT *
        FROM (
          SELECT
            s.ID,
            s.Hostname,
            s.CPU_Percent AS CPU,
            s.RAMFreeGB,
            s.TotalRAMGB,
            s.LastBoot,
            s.CaptureTime AS Time,
            ROW_NUMBER() OVER (PARTITION BY s.Hostname ORDER BY s.CaptureTime DESC) AS rn
          FROM ServerStatus s
        ) t
        WHERE rn <= 15
      )
      SELECT
        l.Hostname,
        l.CPU,
        l.RAMFreeGB,
        l.TotalRAMGB,
        l.LastBoot,
        l.Time,
        d.DeviceID,
        d.FreeGB,
        d.SizeGB
      FROM LastStatus l
      JOIN DiskStatus d ON l.ID = d.ServerStatusID
      ORDER BY l.Hostname, l.Time;
    `);

    const grouped = groupData(result.recordset);
    res.json(Object.values(grouped).flat());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`🚀 Dashboard running at http://localhost:${PORT}`)
);