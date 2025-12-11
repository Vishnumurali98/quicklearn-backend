const express = require("express");
const cors = require("cors");
const path = require("path");
const videosRoute = require("./routes/videos");

const app = express();

app.use(cors());
app.use(express.json());

// Serve videos from the "uploads" folder (LOCAL ONLY)
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Video routes
app.use("/api/videos", videosRoute);

module.exports = app;
