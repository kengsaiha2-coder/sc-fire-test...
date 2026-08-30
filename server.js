require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running"
  });
});

app.get("/api/ping", (req, res) => {
  res.json({
    success: true,
    message: "pong"
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    status: "ONLINE",
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
