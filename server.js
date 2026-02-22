// ===============================
// DEPENDENCIAS
// ===============================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// ===============================
// VARIABLES
// ===============================

let rooms = {};

const GLOBAL_POINTS = {
    VOR_SCO: {
        lat: -13.738611,
        lng: -76.212778
    }
};

// ===============================
// FUNCIONES
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
// LOOP AUTORITATIVO
// ===============================

setInterval(() => {

    for (let roomName in rooms) {

        const room = rooms[roomName];

        for (let userId in room.planes) {

            room.planes[userId].forEach(plane => {

                if (plane.state === "taxi" && plane.route.length > 0) {

                    const target = plane.route[0];
                    const speed = 0.00005;

                    const dLat = target.lat - plane.lat;
                    const dLng = target.lng - plane.lng;

                    const distance = Math.sqrt(dLat*dLat + dLng*dLng);

                    if (distance < 0.00002) {
                        plane.route.shift();
                    } else {
                        plane.lat += (dLat / distance) * speed;
                        plane.lng += (dLng / distance) * speed;

                        plane.heading = calculateHeading(
                            plane.lat,
                            plane.lng,
                            target.lat,
                            target.lng
                        );
                    }
                }

            });

        }

        io.to(roomName).emit("state", room.planes);
    }

}, 50);

// ===============================
// SOCKET.IO
// ===============================

io.on("connection", (socket) => {

    socket.on("joinRoom", (roomName) => {

        socket.join(roomName);

        if (!rooms[roomName]) {
            rooms[roomName] = { planes: {} };
        }

        socket.room = roomName;
        socket.emit("state", rooms[roomName].planes);
    });

    socket.on("createPlane", (data) => {

        const room = rooms[socket.room];
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
            heading: heading,
            state: "idle",
            route: []
        });

    });

    socket.on("deletePlane", (planeId) => {

        const room = rooms[socket.room];
        if (!room) return;

        const userPlanes = room.planes[socket.id];
        if (!userPlanes) return;

        room.planes[socket.id] =
            userPlanes.filter(p => p.id !== planeId);
    });

    socket.on("command", (cmd) => {

    const room = rooms[socket.room];
    if (!room) return;

    const userPlanes = room.planes[socket.id];
    if (!userPlanes) return;

    const plane = userPlanes.find(p => p.id === cmd.planeId);
    if (!plane) return;

    switch (cmd.type) {

        case "ADD_ROUTE_POINT":
            plane.route.push(cmd.point);
            break;

        case "SET_STATE":
            plane.state = cmd.state;
            break;

        case "CLEAR_ROUTE":
            plane.route = [];
            break;

        // =====================================
        // 🔥 NUEVO: ARRASTRAR AERONAVE
        // =====================================

        case "DRAG_PLANE":

            plane.lat = cmd.lat;
            plane.lng = cmd.lng;

            plane.heading = calculateHeading(
                cmd.lat,
                cmd.lng,
                GLOBAL_POINTS.VOR_SCO.lat,
                GLOBAL_POINTS.VOR_SCO.lng
            );

            plane.state = "manual"; // opcional pero recomendado
            break;
    }

    // 🔁 Siempre emitir nuevo estado después de cualquier comando
    io.to(socket.room).emit("state", room.planes);
});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log("Servidor corriendo en puerto " + PORT);
});