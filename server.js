import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import http from "http";
import connectDB from "./config/mongodb.js";
import authRoute from "./routes/authRoute.js";
import chatRoute from "./routes/chatRoute.js";
import groupRoute from "./routes/groupRoute.js";
import callRoute from "./routes/callRoute.js";
import statusRoute from "./routes/statusRoute.js";
import bodyParser from "body-parser";
import initializeSocket from "./services/socketService.js";
// import redisClient from "./config/redis.js";

const port = process.env.PORT || 3001;
const app = express();

// db connect
connectDB();

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// Middleware
app.use(express.json()); // parse body data
app.use(cookieParser()); // parse token on every request
app.use(bodyParser.urlencoded({ extended: true }));

// create server
const server = http.createServer(app);

const io = initializeSocket(server);

// applying socket middleware before routes
app.use((req, res, next) => {
  req.io = io;
  req.socketUserMap = io.socketUserMap;
  next();
});

// Routes
app.use("/api/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/status", statusRoute);
app.use("/api/group", groupRoute);
app.use("/api/calls", callRoute);

// checking api working status
app.get("/", (req, res) => {
  res.send("API Working...");
});

// listening server
server.listen(port, "0.0.0.0", () => {
  console.log("Server started on http://localhost:" + port);
});
