const { MongoClient } = require('mongodb');
const express = require("express");
const cors = require("cors");
require('dotenv').config()
const admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


// verifying token


const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];
        try {
            const decodedUser = await admin.auth().verifyIdToken(token)
            req.decodedEmail = decodedUser.email
        }
        catch {

        }
    }
    next();

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wh888.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        await client.connect()
        const database = client.db('doctors_portal');
        const appointmentCollection = database.collection('appointments')
        const userCollection = database.collection('users')

        // post appointments
        app.post('/appointments', async (req, res) => {
            const appointment = req.body;
            const result = await appointmentCollection.insertOne(appointment);
            res.json(result);
        })
        // get all appointments
        app.get('/appointments', verifyToken, async (req, res) => {
            const email = req.query.email;
            const date = new Date(req.query.date).toLocaleDateString();
            const query = { email: email, date: date }
            const cursor = appointmentCollection.find(query)
            const result = await cursor.toArray();
            res.json(result);
        })

        // check admin or not
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })


        // post register users
        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const result = await userCollection.insertOne(user);
            res.json(result);
        })
        // upsert google login users
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email }
            const options = { upsert: true };
            const updatedDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            res.json(result);
        })
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = (req.decodedEmail);
            if (requester) {
                const requesterAccount = await userCollection.findOne({ email: requester })
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email }
                    const updatedDoc = {
                        $set: {
                            role: 'admin',
                        }
                    }
                    const result = await userCollection.updateOne(filter, updatedDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'You do not have permission to make admin' })
            }

        })
    }
    finally {
        //await client.close();
    }
}
run().catch(console.dir)



app.get("/", (req, res) => {
    res.send("Getting successfully");
});

app.listen(port, () => {
    console.log("listening on port", port);
});

