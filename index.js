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
    const userCollection = database.collection("users");

    // Existing routes...

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

    // New routes for admin dashboard...

    // UPDATE: Approve or Reject Teacher Request
    app.put('/classes/:id/:action', async (req, res) => {
      try {
        const { id, action } = req.params;
        const validActions = ['approve', 'reject'];

        if (!validActions.includes(action)) {
          return res.status(400).json({ message: 'Invalid action' });
        }

        const result = await classCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: action === 'approve' ? 'approved' : 'rejected' } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: 'Class not found or already processed' });
        }

        // If approved, update user role to teacher
        if (action === 'approve') {
          const classDetails = await classCollection.findOne({ _id: new ObjectId(id) });
          await userCollection.updateOne(
            { email: classDetails.instructorEmail },
            { $set: { role: 'teacher' } }
          );
        }

        res.json({ message: `Class ${action}d successfully` });
      } catch (error) {
        res.status(500).json({ 
          message: `Error ${req.params.action}ing class`, 
          error: error.message 
        });
      }
    });

    // READ: Get All Users
    app.get('/users', async (req, res) => {
      try {
        const users = await userCollection.find().toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ 
          message: 'Error fetching users', 
          error: error.message 
        });
      }
    });
    // CREATE: Register New User
app.post('/users', async (req, res) => {
    try {
      const { uid, name, email, photo } = req.body;
      
      // Check for existing user by UID or email
      const existingUser = await userCollection.findOne({
        $or: [{ uid }, { email }]
      });
  
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }
  
      const newUser = {
        uid,
        name,
        email,
        photo,
        role: 'student', // Default role
        createdAt: new Date()
      };
  
      const result = await userCollection.insertOne(newUser);
      res.status(201).json({
        message: 'User registered successfully',
        userId: result.insertedId
      });
    } catch (error) {
      res.status(500).json({
        message: 'Error registering user',
        error: error.message
      });
    }
  });

    // UPDATE: Make User Admin
    app.put('/users/:id/make-admin', async (req, res) => {
      try {
        const { id } = req.params;
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: 'admin' } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: 'User not found or already an admin' });
        }

        res.json({ message: 'User role updated to admin successfully' });
      } catch (error) {
        res.status(500).json({ 
          message: 'Error updating user role', 
          error: error.message 
        });
      }
    });

    // READ: Search Users
    app.get('/users/search', async (req, res) => {
      try {
        const { term } = req.query;
        const query = {
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } }
          ]
        };
        const users = await userCollection.find(query).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({ 
          message: 'Error searching users', 
          error: error.message 
        });
      }
    });

    // READ: Get All Classes for Admin
    app.get('/all-classes', async (req, res) => {
      try {
        const classes = await classCollection.find().toArray();
        res.json(classes);
      } catch (error) {
        res.status(500).json({ 
          message: 'Error fetching all classes', 
          error: error.message 
        });
      }
    });

    // UPDATE: Update Class Progress
    app.put('/classes/:id/progress', async (req, res) => {
      try {
        const { id } = req.params;
        const { progress } = req.body;
        const result = await classCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { progress } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: 'Class not found' });
        }

        res.json({ message: 'Class progress updated successfully' });
      } catch (error) {
        res.status(500).json({ 
          message: 'Error updating class progress', 
          error: error.message 
        });
      }
    });

    // READ: Get User Role
    app.get('/users/:uid/role', async (req, res) => {
      try {
        const { uid } = req.params;
        const user = await userCollection.findOne({ uid });
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.json({ role: user.role || 'student' });
      } catch (error) {
        res.status(500).json({ 
          message: 'Error fetching user role', 
          error: error.message 
        });
      }
    });

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