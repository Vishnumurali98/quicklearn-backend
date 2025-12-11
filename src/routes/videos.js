const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { BlobServiceClient } = require("@azure/storage-blob");
const { CosmosClient } = require("@azure/cosmos");

const router = express.Router();

//  TEMP local folder for file before upload to Azure Blob 
const tempDir = path.join(__dirname, "..", "..", "tempUploads");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Multer: store file temporarily in tempUploads
const upload = multer({ dest: tempDir });

//  Azure Blob Storage setup 
const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_STORAGE_CONTAINER_NAME
);

//  Cosmos DB setup 
const cosmosClient = new CosmosClient(
  process.env.COSMOS_DB_CONNECTION_STRING
);

const cosmosDb = cosmosClient.database(process.env.COSMOS_DB_DATABASE);
const cosmosContainer = cosmosDb.container(process.env.COSMOS_DB_CONTAINER);


// GET /api/videos – load from Cosmos, newest first

router.get("/", async (req, res) => {
  try {
    // Filter by partition key (visibility)
    const query = 
      "SELECT * FROM c WHERE c.visibility = 'public' ORDER BY c.createdAt DESC";

    const { resources } = await cosmosContainer.items.query(query).fetchAll();

    res.json(resources);
  } catch (err) {
    console.error(" Error fetching videos from Cosmos:", err);
    res.status(500).json({ error: "Could not fetch videos" });
  }
});



// POST /api/videos – upload to Blob + save metadata in Cosmos

router.post("/", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Video file missing." });
    }

    const { title, description, tag, visibility } = req.body;

    // Unique blob name
    const blobName =
      Date.now() + "-" + req.file.originalname.replace(/\s+/g, "_");

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Upload file from temp folder to Azure Blob
    await blockBlobClient.uploadFile(req.file.path);

    // Generate a SAS URL so the browser can stream the video
    const ONE_YEAR_MINUTES = 365 * 24 * 60;
    const expiry = new Date(
      new Date().getTime() + ONE_YEAR_MINUTES * 60 * 1000
    );

    const sasUrl = await blockBlobClient.generateSasUrl({
      permissions: "r", // read-only
      expiresOn: expiry,
    });

    // Deleting temp file
    fs.unlinkSync(req.file.path);

    // Prepare metadata document for Cosmos DB
    const metadata = {
      id: blobName, // use blobName as Cosmos id
      title: title && title.trim() !== "" ? title : "Untitled video",
      description: description || "",
      url: sasUrl,
      tag: tag || "",
      visibility: visibility || "public",
      createdAt: new Date().toISOString(),
      uploaderName: "Anonymous",
      tags: [], // will use later for Cognitive Services
    };

    // Save metadata in Cosmos DB
    await cosmosContainer.items.create(metadata);

    console.log("🎬 Saved video metadata in Cosmos:", metadata.id);

    res.json(metadata);
  } catch (err) {
    console.error(" Upload Error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;
