const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const os = require('os'); // Import os module to get network details
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(bodyParser.json());

let buttonStatus = 'off';

// Function to get local IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const interfaceInfo of interfaces[interfaceName]) {
      if (interfaceInfo.family === 'IPv4' && !interfaceInfo.internal) {
        return interfaceInfo.address; // Return local IP address
      }
    }
  }
  return 'localhost'; // Fallback if no external IP found
}
const hostMachineIP = getLocalIPAddress(); // Get the host machine IP

// Initialize SQLite Database
const db = new sqlite3.Database('./events.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    // Ensure the table exists
    db.run(
      `CREATE TABLE IF NOT EXISTS events (
        key INTEGER PRIMARY KEY,
        ldr_status TEXT,
        distance_cm TEXT,
        servo_position TEXT
      )`,
      (err) => {
        if (err) {
          console.error('Error creating table:', err.message);
        }
      }
    );
  }
});

// POST /api/send - Insert or update data
app.post('/api/send', (req, res) => {
  let dataArray = req.body;
  
  // Wrap in an array if the body is a single object
  if (!Array.isArray(dataArray)) {
    dataArray = [dataArray];
  }

  const insertStmt = `INSERT INTO events (key, ldr_status, distance_cm, servo_position) 
                      VALUES (?, ?, ?, ?)
                      ON CONFLICT(key) DO UPDATE SET 
                        ldr_status = excluded.ldr_status,
                        distance_cm = excluded.distance_cm,
                        servo_position = excluded.servo_position`;
  
  dataArray.forEach((data) => {
    db.run(
      insertStmt,
      [data.key, data.ldr_status, data.distance_cm, data.servo_position],
      (err) => {
        if (err) {
          console.error('Error inserting/updating data:', err.message);
        }
      }
    );
  });
  res.json({ message: 'Data stored successfully' });
});

// GET /api/events - Retrieve all data
app.get('/api/events', (req, res) => {
  const query = `SELECT * FROM events`;
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error', details: err.message });
    } else {
      res.json(rows);
    }
  });
});

// DELETE /api/events/:key - Delete specific event by key
app.delete('/api/events/:key', (req, res) => {
  const key = req.params.key;
  const deleteStmt = `DELETE FROM events WHERE key = ?`;
  db.run(deleteStmt, [key], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete data', details: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: 'No event found with the given key' });
    }
    res.json({ message: `Event with key '${key}' deleted successfully` });
  });
});

// DELETE /api/events - Delete all events
app.delete('/api/events', (req, res) => {
  const deleteAllStmt = `DELETE FROM events`;
  db.run(deleteAllStmt, function (err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete all data', details: err.message });
    }
    res.json({ message: 'All events deleted successfully' });
  });
});

app.post('/api/control', (req, res) => {
  const { status } = req.body;

  // Check if the status is either 'on' or 'off'
  if (status !== 'on' && status !== 'off') {
    return res.status(400).json({ error: "Status must be 'on' or 'off'" });
  }

  // Update the button status
  buttonStatus = status;

  // Respond with the updated status
  res.json({ status: buttonStatus });
});

app.get('/api/control/status', (req, res) => {
  // Send the current button status as a response
  res.json({ status: buttonStatus });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://${hostMachineIP}:${PORT}`);
});
