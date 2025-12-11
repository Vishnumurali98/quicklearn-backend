const express = require("express");
const cors = require("cors");
require("dotenv").config();

const videosRouter = require("./src/routes/videos");

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/videos", videosRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
