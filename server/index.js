const keys = require("./keys");

// Express Setup
const express = require("express");
const bodyParser = require("body-parser"); // Parse incoming requests from React and turn the body of the POST request into a Json file. 
const cors = require("cors"); // Cross Origin Resource Sharing 

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require("pg");
const pgClient = new Pool(
{
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

pgClient.on("connect", (client) => 
{
    client
      .query("CREATE TABLE IF NOT EXISTS values (number INT)")
      .catch((err) => console.error(err));
});

// Redis Client Setup
const redis = require("redis");
const redisClient = redis.createClient
({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express Route Handling
app.get("/", (req, res) =>
{
    res.send("Hi");
});

app.get("/values/all", async(req, res) =>
{
    const values = await pgClient.query("SELECT * FROM values");
    res.send(values.rows);
});

app.get("/values/current", async(req, res) =>
{
    redisClient.hgetall("values", (err, values) =>
    {
        res.send(values);
    });
});

app.post("/values", async (req, res) => 
{
    const index = req.body.index;
    if (parseInt(index) > 40)
    {
        return res.status(422).send("Index too high!");
    }

    redisClient.hset("values", index, "Nothing yet!"); // Calculation will be done by the worker.
    redisPublisher.publish("insert", index); // Wakes up the worker and start calculating the value for it. 
    pgClient.query("INSERT INTO values (number) VALUES($1)", [index]);

    res.send({ working: true });
});

app.listen(5000, err =>
{
    console.log("Listening on Port 5000.");
});