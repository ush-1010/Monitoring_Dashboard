
const express = require("express");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const app = express();
app.use(cors());


const dbConfig = {
    server: 'castel', // e.g., 'localhost' or 'SERVER_NAME\\INSTANCE_NAME'
    database: 'InfraMonitorDB',
    driver: 'msnodesqlv8', // <-- Add this line
    options: {
        trustedConnection: true, // Use Windows Authentication
        encrypt: false, // Recommended for production environments
        trustServerCertificate: true // Change to false in production if you have a valid certificate
    }
};

async function connectAndQuery() {
    try {
        await sql.connect(dbConfig);
        console.log('Connected to SQL Server using Windows Authentication');

        const result = await sql.query`SELECT @@VERSION`;
        console.log('Query results:', result.recordset);

    } catch (err) {
        console.error('Database connection or query failed:', err);
    } finally {
        await sql.close();
        console.log('Connection closed.');
    }
}

connectAndQuery();