// ===============================
// DEPENDENCIAS
// ===============================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// ===============================
// CONFIGURACIÓN SERVIDOR
// ===============================

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// ===============================
// VARIABLES GLOBALES DEL SERVIDOR
// ===============================

const GLOBAL_POINTS = {
    ARP_SPSO: {
        lat: -13.744800,
        lng: -76.220411
    },
    VOR_SCO: {
        lat: -13.738611,
        lng: -76.212778
    }
};

let rooms = {};

// ===============================
// FUNCIONES AUXILIARES
// ===============================

function calculateHeading(lat1, lng1, lat2, lng2) {

    const dLon = (lng2 - lng1) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x =
        Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
        Math.sin(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.cos(dLon);

    const brng = Math.atan2(y, x);

    return (brng * 180 / Math.PI + 360) % 360;
}

// ===============================
// SOCKET.IO
// ===============================

io.on("connection", (socket) => {

    // ---------------------------
    // UNIRSE A SALA
    // ---------------------------
    socket.on("joinRoom", (roomName) => {

        socket.join(roomName);

        if (!rooms[roomName]) {
            rooms[roomName] = { planes: {} };
        }

        socket.room = roomName;

        socket.emit("state", rooms[roomName].planes);
    });

    // ---------------------------
    // CREAR AERONAVE
    // ---------------------------
    socket.on("createPlane", (data) => {

        let room = rooms[socket.room];
        if (!room) return;

        if (!room.planes[socket.id]) {
            room.planes[socket.id] = [];
        }

        if (room.planes[socket.id].length >= 5) return;

        const heading = calculateHeading(
            data.lat,
            data.lng,
            GLOBAL_POINTS.VOR_SCO.lat,
            GLOBAL_POINTS.VOR_SCO.lng
        );

        const planeId = Date.now() + "_" + Math.random();

        room.planes[socket.id].push({
            id: planeId,
            lat: data.lat,
            lng: data.lng,
            heading: heading
        });

        io.to(socket.room).emit("state", room.planes);
    });

    // ---------------------------
    // MOVER AERONAVE
    // ---------------------------
    socket.on("movePlane", (data) => {

        let room = rooms[socket.room];
        if (!room) return;

        let userPlanes = room.planes[socket.id];
        if (!userPlanes) return;

        let plane = userPlanes.find(p => p.id === data.id);
        if (!plane) return;

        plane.lat = data.lat;
        plane.lng = data.lng;

        plane.heading = calculateHeading(
            data.lat,
            data.lng,
            GLOBAL_POINTS.VOR_SCO.lat,
            GLOBAL_POINTS.VOR_SCO.lng
        );

        io.to(socket.room).emit("state", room.planes);
    });

    // ---------------------------
    // ELIMINAR AERONAVE
    // ---------------------------
    socket.on("deletePlane", (planeId) => {

        let room = rooms[socket.room];
        if (!room) return;

        let userPlanes = room.planes[socket.id];
        if (!userPlanes) return;

        room.planes[socket.id] =
            userPlanes.filter(p => p.id !== planeId);

        io.to(socket.room).emit("state", room.planes);
    });

    // ============================
    // 🔹 AGREGÁ AQUÍ TUS NUEVOS socket.on
    // ============================

});

// ===============================
// INICIAR SERVIDOR
// ===============================

server.listen(3000, () => {
    console.log("Servidor corriendo en http://localhost:3000");
});