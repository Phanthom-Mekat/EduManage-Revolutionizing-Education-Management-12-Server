const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId, Admin } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:5173', // Allow requests from your frontend
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow the PUT method
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // If using cookies
}));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zhb6u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const database = client.db("learnify");
    const teacherRequestCollection = database.collection("reqteachers");
    const userCollection = database.collection("users");
    const classCollection = database.collection("classes");
    const assignmentCollection = database.collection("assignments");
    const submissionCollection = database.collection("submissions");
    // Existing routes...

    // CREATE: Submit Class
    app.post("/reqteachers", async (req, res) => {
      try {
        const classData = {
          ...req.body,
          status: "pending",
          createdAt: new Date(),
        };

        const result = await teacherRequestCollection.insertOne(classData);

        res.status(201).json({
          message: "Class submitted successfully",
          classId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({
          message: "Error submitting class",
          error: error.message,
        });
      }
    });

    // READ: Get All Classes
    app.get("/reqteachers", async (req, res) => {
      try {
        const { category, experience, page = 1, limit = 10 } = req.query;

        let query = {};
        if (category) query.category = category;
        if (experience) query.experience = experience;

        const classes = await teacherRequestCollection
          .find(query)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();

        const total = await teacherRequestCollection.countDocuments(query);

        res.json({
          classes,
          totalPages: Math.ceil(total / limit),
          currentPage: Number(page),
        });
      } catch (error) {
        res.status(500).json({
          message: "Error fetching classes",
          error: error.message,
        });
      }
    });

    // New routes for admin dashboard...

    // UPDATE: Approve or Reject Teacher Request
    app.put("/reqteachers/:id/:action", async (req, res) => {
      try {
        const { id, action } = req.params;
        const validActions = ["approve", "reject"];

        if (!validActions.includes(action)) {
          return res.status(400).json({ message: "Invalid action" });
        }

        const result = await teacherRequestCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: action === "approve" ? "approved" : "rejected" } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Class not found or already processed" });
        }

        // If approved, update user role to teacher
        if (action === "approve") {
          const classDetails = await teacherRequestCollection.findOne({
            _id: new ObjectId(id),
          });
          await userCollection.updateOne(
            { email: classDetails.instructorEmail },
            { $set: { role: "teacher" } }
          );
        }

        res.json({ message: `Class ${action}d successfully` });
      } catch (error) {
        res.status(500).json({
          message: `Error ${req.params.action}ing class`,
          error: error.message,
        });
      }
    });

    // READ: Get All Users
    // READ: Get Classes
app.get("/classes", async (req, res) => {
    try {
      const { 
        instructorEmail, 
        status,  // Add status parameter
        page = 1, 
        limit = 10 
      } = req.query;
  
      let query = {};
      if (instructorEmail) query.instructorEmail = instructorEmail;
      if (status) query.status = status;  // Add status filter
  
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
        message: "Error fetching classes",
        error: error.message
      });
    }
  });
  

  // Get user role by email
  app.get('/users', async (req, res) => {
    try {
        const email = req.query.email;
        
        if (email) {
            const users = await userCollection.find({ email }).toArray();
            return res.json(users);
        }

        const allUsers = await userCollection.find().toArray();
        res.json(allUsers);

    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
    // CREATE: Register New User
    app.post("/users", async (req, res) => {
      try {
        const { uid, name, email, photo } = req.body;

        // Check for existing user by UID or email
        const existingUser = await userCollection.findOne({
          $or: [{ uid }, { email }],
        });

        if (existingUser) {
          return res.status(400).json({ message: "User already exists" });
        }

        const newUser = {
          uid,
          name,
          email,
          photo,
          role: "student", // Default role
          createdAt: new Date(),
        };

        const result = await userCollection.insertOne(newUser);
        res.status(201).json({
          message: "User registered successfully",
          userId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({
          message: "Error registering user",
          error: error.message,
        });
      }
    });
    // get users 


    // UPDATE: Make User Admin
    app.put("/users/:id/make-admin", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "admin" } }
        );

        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "User not found or already an admin" });
        }

        res.json({ message: "User role updated to admin successfully" });
      } catch (error) {
        res.status(500).json({
          message: "Error updating user role",
          error: error.message,
        });
      }
    });

    // READ: Search Users
    app.get("/users/search", async (req, res) => {
      try {
        const { term } = req.query;
        const query = {
          $or: [
            { name: { $regex: term, $options: "i" } },
            { email: { $regex: term, $options: "i" } },
          ],
        };
        const users = await userCollection.find(query).toArray();
        res.json(users);
      } catch (error) {
        res.status(500).json({
          message: "Error searching users",
          error: error.message,
        });
      }
    });

    // READ: Get All Classes for Admin
    app.get("/all-classes", async (req, res) => {
      try {
        const classes = await classCollection.find().toArray();
        res.json(classes);
      } catch (error) {
        res.status(500).json({
          message: "Error fetching all classes",
          error: error.message,
        });
      }
    });



// Process Payment
// CREATE: Process Payment
app.post("/api/payments", async (req, res) => {
    try {
      const { classId, userId, amount, cardNumber, expiryDate, cvv } = req.body;
      // Validate class exists
      const classExists = await classCollection.findOne({
        _id: new ObjectId(classId)
      });
      if (!classExists) {
        return res.status(404).json({
          success: false,
          message: 'Class not found'
        });
      }
  
      // Basic payment validation
      if (!cardNumber || !expiryDate || !cvv) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payment details'
        });
      }
  
      // Create payment record
      const payment = {
        classId: new ObjectId(classId),
        userId,
        amount,
        status: 'completed',
        createdAt: new Date()
      };
  
      await database.collection('payments').insertOne(payment);
  
      res.json({
        success: true,
        message: 'Payment processed successfully',
        transactionId: `TXN-${Date.now()}`
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Payment processing failed',
        error: error.message
      });
    }
  });
  
  // Handle Enrollment
  app.post('/enroll', async (req, res) => {
    try {
      const { classId, userId } = req.body;
  
      // Check existing enrollment
      const existingEnrollment = await database.collection('enrollments').findOne({
        classId: new ObjectId(classId),
        userId: userId
      });
  
      if (existingEnrollment) {
        return res.status(400).json({
          success: false,
          message: 'User already enrolled in this class'
        });
      }
  
      // Create enrollment record
      const enrollment = {
        classId: new ObjectId(classId),
        userId,
        enrolledAt: new Date(),
        progress: 0,
        completed: false
      };
  
      // Update class enrollment count
      const updateResult = await classCollection.updateOne(
        { _id: new ObjectId(classId) },
        { $inc: { totalEnrollment: 1 } }
      );
  
      // Create enrollment
      const enrollmentResult = await database.collection('enrollments').insertOne(enrollment);
  
      res.json({
        success: true,
        message: 'Enrollment successful',
        enrollmentId: enrollmentResult.insertedId
      });
  
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Enrollment failed',
        error: error.message
      });
    }
  });


    // APPROVE CLASS
app.put('/classes/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await classCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved' } }
      );
  
      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: 'Class not found or already approved' });
      }
  
      // Update user role to teacher if needed
      const classDetails = await classCollection.findOne({ _id: new ObjectId(id) });
      await userCollection.updateOne(
        { email: classDetails.instructorEmail },
        { $set: { role: 'teacher' } }
      );
  
      res.json({ message: 'Class approved successfully' });
    } catch (error) {
      res.status(500).json({
        message: 'Error approving class',
        error: error.message
      });
    }
  });
  
  // REJECT CLASS
  app.put('/classes/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const result = await classCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected' } }
      );
  
      if (result.modifiedCount === 0) {
        return res.status(404).json({ message: 'Class not found or already rejected' });
      }
  
      res.json({ message: 'Class rejected successfully' });
    } catch (error) {
      res.status(500).json({
        message: 'Error rejecting class',
        error: error.message
      });
    }
  });

    // UPDATE: Update Class Progress
    app.put("/classes/:id/progress", async (req, res) => {
      try {
        const { id } = req.params;
        const { progress } = req.body;
        const result = await classCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { progress } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ message: "Class not found" });
        }

        res.json({ message: "Class progress updated successfully" });
      } catch (error) {
        res.status(500).json({
          message: "Error updating class progress",
          error: error.message,
        });
      }
    });

    // READ: Get User Role
    app.get("/users/:uid/role", async (req, res) => {
      try {
        const { uid } = req.params;
        const user = await userCollection.findOne({ uid });
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        res.json({ role: user.role || "student" });
      } catch (error) {
        res.status(500).json({
          message: "Error fetching user role",
          error: error.message,
        });
      }
    });


    // teacher Admin route

    // CREATE: Submit Class
    app.post("/classes", async (req, res) => {
      try {
        const classData = {
          ...req.body,
          status: "pending",
          createdAt: new Date(),
          totalEnrollment: 0,
          totalAssignments: 0,
          totalSubmissions: 0,
        };

        const result = await classCollection.insertOne(classData);

        res.status(201).json({
          message: "Class submitted successfully",
          classId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({
          message: "Error submitting class",
          error: error.message,
        });
      }
    });

    // READ: Get Classes for a Teacher
    app.get("/classes", async (req, res) => {
      try {
        const { instructorEmail, page = 1, limit = 10 } = req.query;

        let query = {};
        if (instructorEmail) query.instructorEmail = instructorEmail;

        const classes = await classCollection
          .find(query)
          .skip((page - 1) * limit)
          .limit(Number(limit))
          .toArray();

        const total = await classCollection.countDocuments(query);

        res.json({
          classes,
          totalPages: Math.ceil(total / limit),
          currentPage: Number(page),
        });
      } catch (error) {
        res.status(500).json({
          message: "Error fetching classes",
          error: error.message,
        });
      }
    });

    // READ: Get Class Details
    app.get("/classes/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const classDetails = await classCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!classDetails) {
          return res.status(404).json({ message: "Class not found" });
        }
        res.json(classDetails);
      } catch (error) {
        res.status(500).json({
          message: "Error fetching class details",
          error: error.message,
        });
      }
    });

    // UPDATE: Update Class
    app.put("/classes/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { title, price, description, image } = req.body;
        const result = await classCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { title, price, description, image } }
        );
        if (result.modifiedCount === 0) {
          return res
            .status(404)
            .json({ message: "Class not found or no changes made" });
        }
        res.json({ message: "Class updated successfully" });
      } catch (error) {
        res.status(500).json({
          message: "Error updating class",
          error: error.message,
        });
      }
    });

    // DELETE: Delete Class
    app.delete("/classes/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await classCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Class not found" });
        }
        res.json({ message: "Class deleted successfully" });
      } catch (error) {
        res.status(500).json({
          message: "Error deleting class",
          error: error.message,
        });
      }
    });

    // CREATE: Add Assignment
    app.post("/classes/:id/assignments", async (req, res) => {
      try {
        const { id } = req.params;
        const assignmentData = {
          ...req.body,
          classId: new ObjectId(id),
          createdAt: new Date(),
        };
        const result = await assignmentCollection.insertOne(assignmentData);
        await classCollection.updateOne(
          { _id: new ObjectId(id) },
          { $inc: { totalAssignments: 1 } }
        );
        res.status(201).json({
          message: "Assignment created successfully",
          assignmentId: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({
          message: "Error creating assignment",
          error: error.message,
        });
      }
    });


    // student dashboard
    // GET: Fetch Enrolled Classes for a User
app.get("/enrolled-classes/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Find all enrollments for the user
      const enrollments = await database.collection('enrollments')
        .find({ userId })
        .toArray();
      
      // Get the class IDs from enrollments
      const classIds = enrollments.map(enrollment => enrollment.classId);
      
      // Fetch the actual class details
      const enrolledClasses = await classCollection
        .find({ _id: { $in: classIds } })
        .toArray();
      
      // Merge enrollment data (progress) with class details
      const enrichedClasses = enrolledClasses.map(classItem => {
        const enrollment = enrollments.find(
          e => e.classId.toString() === classItem._id.toString()
        );
        return {
          ...classItem,
          progress: enrollment.progress,
          enrolledAt: enrollment.enrolledAt
        };
      });
  
      res.json({
        success: true,
        enrolledClasses: enrichedClasses
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching enrolled classes",
        error: error.message
      });
    }
  });
  
  // GET: Fetch Class Assignments
app.get("/classes/:id/assignments", async (req, res) => {
    try {
      const { id } = req.params;
      
      const assignments = await assignmentCollection
        .find({ classId: new ObjectId(id) })
        .toArray();
      
      // Get submission counts for each assignment
      const assignmentsWithCounts = await Promise.all(
        assignments.map(async (assignment) => {
          const submissionCount = await submissionCollection.countDocuments({
            assignmentId: assignment._id
          });
          return { ...assignment, submissionCount };
        })
      );
  
      res.json({
        success: true,
        assignments: assignmentsWithCounts
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error fetching assignments",
        error: error.message
      });
    }
  });
  
  // POST: Submit Assignment
  app.post("/assignments/:id/submit", async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
  
      // Check if assignment exists
      const assignment = await assignmentCollection.findOne({
        _id: new ObjectId(id)
      });
  
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: "Assignment not found"
        });
      }
  
      // Create submission record
      const submission = {
        assignmentId: new ObjectId(id),
        userId,
        submittedAt: new Date(),
        status: 'submitted',
        // Add file handling logic here if needed
      };
  
      const result = await submissionCollection.insertOne(submission);
  
      // Update class submission count
      await classCollection.updateOne(
        { _id: assignment.classId },
        { $inc: { totalSubmissions: 1 } }
      );
  
      res.status(201).json({
        success: true,
        message: "Assignment submitted successfully",
        submissionId: result.insertedId
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error submitting assignment",
        error: error.message
      });
    }
  });
  
// POST: Submit Class Evaluation
app.post("/classes/:id/evaluate", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, name, photo, rating, description } = req.body;

    // Check if user has already submitted a review
    const existingReview = await database.collection('evaluations').findOne({
      classId: new ObjectId(id),
      userId: userId
    });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted a review for this class"
      });
    }

    // Create evaluation record with user details
    const evaluation = {
      classId: new ObjectId(id),
      userId,
      name,
      photo,
      rating,
      description,
      submittedAt: new Date()
    };

    await database.collection('evaluations').insertOne(evaluation);

    // Update class average rating
    const evaluations = await database.collection('evaluations')
      .find({ classId: new ObjectId(id) })
      .toArray();
    
    const averageRating = evaluations.reduce((acc, curr) => acc + curr.rating, 0) / evaluations.length;

    await classCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          averageRating,
          totalReviews: evaluations.length 
        } 
      }
    );

    res.json({
      success: true,
      message: "Evaluation submitted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error submitting evaluation",
      error: error.message
    });
  }
});

  // GET: Fetch All Reviews Across All Classes
app.get("/reviews", async (req, res) => {
  try {
    // Get all reviews and populate with class details
    const reviews = await database.collection('evaluations')
      .aggregate([
        {
          $lookup: {
            from: 'classes',
            localField: 'classId',
            foreignField: '_id',
            as: 'classDetails'
          }
        },
        {
          $unwind: '$classDetails'
        },
        {
          $project: {
            userId: 1,
            name: 1,
            photo: 1,
            rating: 1,
            description: 1,
            submittedAt: 1,
            className: '$classDetails.title',
            instructorName: '$classDetails.instructorName',
            classImage: '$classDetails.image'
          }
        },
        {
          $sort: { submittedAt: -1 }
        }
      ])
      .toArray();

    res.json({
      success: true,
      reviews
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching all reviews",
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

app.get("/", (req, res) => {
  res.send("Learnify Server is Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
