const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.PAYMENT_SECRET);
var jwt = require("jsonwebtoken");

const port = process.env.PORT || 3000;
const user = process.env.DB_USER;
const password = process.env.DB_PASS;

app.use(cors());
app.use(express.json());

//JWT middleware
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

app.get("/", (req, res) => {
  res.send("Hello World");
});

const uri = `mongodb+srv://${user}:${password}@atlascluster.rh05iiz.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();

    //connect with db

    //Connect with database
    const database = client.db("songleMelodyDB");

    //getting all collections
    const userCollection = database.collection("users");
    const instructorsCollection = database.collection("instructors");
    const classesCollection = database.collection("classes");
    const selectedClassesCollection = database.collection("selectedClasses");
    const instructorClassesCollection =
      database.collection("instructorClasses");
    const paymentCollection = database.collection("payment");

    //jwt
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, {
        expiresIn: "5h",
      });

      res.send({ token });
    });

    //middleware for admin verify
    const verifyAdmin = async (req, res, next) => {
      email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    //middleware for instructor verify
    const verifyInstructor = async (req, res, next) => {
      email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    //users
    //post
    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exist" });
      }

      const result = await userCollection.insertOne(user);

      res.send(result);
    });

    //getting users
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();

      res.send(result);
    });

    //getting users role
    app.get("/role/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ error: true });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { role: user.role };
      res.send(result);
    });

    //updating users role
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body.userRole;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { role: role } };

      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //  instructors
    //getting all instructors
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();

      res.send(result);
    });

    //Creating new instructor
    app.post("/instructorClasses", async (req, res) => {
      const body = req.body;

      const result = instructorClassesCollection.insertOne(body);
      res.send(result);
    });

    //updating instructor
    app.patch("/instructorClasses/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      if (req.body.newInstructorName && req.body.newEmail) {
        const { newClassName, newPhotoURL, newInstrument, newSeats, newPrice } =
          req.body;
        const updateDoc = {
          $set: {
            className: newClassName,
            instrument: newInstrument,
            photoURL: newPhotoURL,
            seats: newSeats,
            price: newPrice,
          },
        };
        const result = await instructorClassesCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }

      if (req.body.remainingSeats) {
        const updateDoc = {
          $set: {
            seats: req.body.remainingSeats,
          },
        };
        const result = await instructorClassesCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }

      if (req.body.status) {
        const updateDoc = {
          $set: {
            status: req.body.status,
          },
        };
        const result = await instructorClassesCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }
      if (req.body.feedback) {
        const updateDoc = {
          $set: {
            feedback: req.body.feedback,
          },
        };
        const result = await instructorClassesCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      }
    });

    //getting all instructors classes
    app.get("/instructorClasses", verifyJWT, verifyAdmin, async (req, res) => {
      const sort = { _id: -1 };
      const result = await instructorClassesCollection
        .find()
        .sort(sort)
        .toArray();
      res.send(result);
    });

    //for showing data to instructor by email
    app.get(
      "/instructorClasses/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        //console.log(email);

        if (req.decoded.email !== email) {
          res.status(403).send({ error: true, message: "forbidden access" });
        }

        const query = { email: email };
        const sort = { _id: -1 };
        const result = await instructorClassesCollection
          .find(query)
          .sort(sort)
          .toArray();

        res.send(result);
      }
    );

    //classes

    //getting all classes
    app.get("/classes", async (req, res) => {
      const sort = { totalStudents: -1 };

      const result = await classesCollection.find().sort(sort).toArray();

      res.send(result);
    });

    //creating new class
    app.post("/classes", async (req, res) => {
      const body = req.body;
      const result = await classesCollection.insertOne(body);
      res.send(result);
    });

    //updating seats
    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;

      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          seatsAvailable: req.body.remainingSeats,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);

      res.send(result);
    });

    //Payment
    //
    //
    //creating payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //
    //
    //

    //for selected Class

    //creating selected class
    app.post("/selectedClass", async (req, res) => {
      const body = req.body;
      console.log(body);
      const result = await selectedClassesCollection.insertOne(body);
      res.send(result);
    });

    //get selected class by user email
    app.get("/selectedClass", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const query = { userEmail: email };
      const sort = { _id: -1 };
      const result = await selectedClassesCollection
        .find(query)
        .sort(sort)
        .toArray();
      res.send(result);
    });

    //delete
    app.delete("/selectedClass/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(filter);
      res.send(result);
    });

    //Creating successful payment
    app.post("/payment", verifyJWT, async (req, res) => {
      const body = req.body;

      const {
        selectedClassId,
        classId,
        instructorId,
        image,
        instructorName,
        price,
        instrument,
        name,
        email,
        transactionId,
        className,
        totalStudents,
      } = body;

      const insertResult = await paymentCollection.insertOne(body);

      //delete from selected classes
      const queryForDelete = { _id: new ObjectId(selectedClassId) };
      const deleteResult = await selectedClassesCollection.deleteOne(
        queryForDelete
      );

      //update in classes
      const queryForUpdateClass = { _id: new ObjectId(classId) };
      const getClass = await classesCollection.findOne(queryForUpdateClass);

      const newTotalStudentInClass = getClass.totalStudents + 1;
      console.log(newTotalStudentInClass);
      const updateDocForClass = {
        $set: {
          totalStudents: newTotalStudentInClass,
        },
      };

      const updateResultClass = await classesCollection.updateOne(
        queryForUpdateClass,
        updateDocForClass
      );

      //update in instructorClasses
      const queryForUpdate = { _id: new ObjectId(instructorId) };

      const getResult = await instructorClassesCollection?.findOne(
        queryForUpdate
      );
      const newTotalStudent = getResult?.totalStudents + 1;

      const updateDoc = {
        $set: {
          totalStudents: newTotalStudent,
        },
      };

      const updateResult = await instructorClassesCollection.updateOne(
        queryForUpdate,
        updateDoc
      );

      res.send({ insertResult, deleteResult, updateResult, updateResultClass });
    });

    //getting all successful payment
    app.get("/payment", verifyJWT, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      console.log("payment");
      res.send(result);
    });

    app.get("/payment/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      //console.log(email);

      const query = { email: email };

      const result = await paymentCollection.find(query).toArray();
      console.log(result);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log("Server is running on port: ", port);
});
