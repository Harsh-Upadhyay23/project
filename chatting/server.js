const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Database Connection
const db = mysql.createPool({
    connectionLimit: 10,
    host: "localhost",
    user: "root",
    password: "Harshu267",
    database: "chatapp"
});

// ✅ Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true
}));
app.set("view engine", "ejs");

// ✅ Store Online Users
const onlineUsers = {};

// ✅ Routes
app.get("/", (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    res.render("chat", { username: req.session.user.username });
});
app.get("/chat", (req, res) => {
    if (!req.session.user) return res.redirect("/login");
    res.render("chat", { username: req.session.user.username });
});

app.get("/login", (req, res) => res.render("login"));
app.get("/register", (req, res) => res.render("register"));

// ✅ User Registration
app.post("/register", (req, res) => {
    const { username, password } = req.body;

    db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
        if (err) return res.send("⚠️ Database error!");
        if (results.length > 0) return res.send("⚠️ Username already exists!");

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.send("⚠️ Error hashing password!");

            db.query("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], (err) => {
                if (err) return res.send("⚠️ Registration failed!");
                res.redirect("/login");
            });
        });
    });
});

// ✅ User Login
app.post("/login", (req, res) => {
    const { username, password } = req.body;

    db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
        if (err) return res.send("⚠️ Database error!");
        if (results.length === 0) return res.send("⚠️ User not found!");

        bcrypt.compare(password, results[0].password, (err, match) => {
            if (err) return res.send("⚠️ Error verifying password!");
            if (!match) return res.send("⚠️ Incorrect password!");

            req.session.user = results[0];
            res.redirect("/");
        });
    });
});

// ✅ Logout
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});

// ✅ Real-time Messaging & Online Users Tracking
io.on("connection", (socket) => {
    console.log("🔵 A user connected");

    socket.on("user connected", (username) => {
        onlineUsers[username] = socket.id;
        io.emit("update users", Object.keys(onlineUsers)); // Send updated online users list
    });

    socket.on("chat message", ({ sender, receiver, message }) => {
        db.query(
            "INSERT INTO messages (sender, receiver, message) VALUES (?, ?, ?)", 
            [sender, receiver, message], 
            (err) => {
                if (!err) io.emit("chat message", { sender, message });
            }
        );
    });

    // ✅ Typing Status
    socket.on("typing", (username) => {
        socket.broadcast.emit("typing", username);
    });

    socket.on("stop typing", (username) => {
        socket.broadcast.emit("stop typing", username);
    });

    socket.on("disconnect", () => {
        const user = Object.keys(onlineUsers).find(username => onlineUsers[username] === socket.id);
        if (user) {
            delete onlineUsers[user];
            io.emit("update users", Object.keys(onlineUsers)); // Update user list
        }
        console.log("🔴 A user disconnected");
    });
});

// ✅ Start Server
server.listen(3000, "10.125.80.53", () => {
    console.log("🚀 Server running on http://10.125.80.53:3000");
});

