const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zhb6u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const database = client.db("learnify");
    const classCollection = database.collection("classes");

    // CREATE: Submit Class
    app.post('/classes', async (req, res) => {
      try {
        const classData = {
          ...req.body,
          status: 'pending',
          createdAt: new Date()
        };

        const result = await classCollection.insertOne(classData);
        
        res.status(201).json({
          message: 'Class submitted successfully',
          classId: result.insertedId
        });
      } catch (error) {
        res.status(500).json({ 
          message: 'Error submitting class', 
          error: error.message 
        });
      }
    });

    // READ: Get All Classes
    app.get('/classes', async (req, res) => {
      try {
        const { category, experience, page = 1, limit = 10 } = req.query;
        
        let query = {};
        if (category) query.category = category;
        if (experience) query.experience = experience;

        const classes = await classCollection
          .find(query)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();

        const total = await classCollection.countDocuments(query);

        res.json({
          classes,
          totalPages: Math.ceil(total / limit),
          currentPage: Number(page)
        });
      } catch (error) {
        res.status(500).json({ 
          message: 'Error fetching classes', 
          error: error.message 
        });
      }
    });

    // Additional CRUD methods remain the same...

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Learnify Server is Running')
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
});