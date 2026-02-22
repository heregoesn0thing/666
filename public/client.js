// ===============================
// VARIABLES GLOBALES CLIENTE
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

// ===============================
// SOCKET
// ===============================

const socket = io();

let room = localStorage.getItem("room") || "sala1";
socket.emit("joinRoom", room);

// ===============================
// MAPA
// ===============================

let map = L.map('map').setView(
    [GLOBAL_POINTS.ARP_SPSO.lat, GLOBAL_POINTS.ARP_SPSO.lng],
    15
);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// ===============================
// ICONO AERONAVE
// ===============================

const planeIcon = L.icon({
    iconUrl: "https://cdn-icons-png.flaticon.com/512/744/744465.png",
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

// ===============================
// ESTADO LOCAL
// ===============================

let markers = {};
let myPlaneCount = 0;

let createMode = false;
let deleteMode = false;

const createBtn = document.getElementById("createPlaneBtn");
const deleteBtn = document.getElementById("deletePlaneBtn");

// ===============================
// BOTONES
// ===============================
const showVorBtn = document.getElementById("showVorBtn");

showVorBtn.addEventListener("click", () => {
    console.log("Mostrar VOR");
});
// ===============================
// SIDEBAR TOGGLE
// ===============================

const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("sidebarToggle");

toggleBtn.addEventListener("click", () => {

    sidebar.classList.toggle("closed");

});
createBtn.addEventListener("click", () => {
    createMode = !createMode;
    deleteMode = false;
});

deleteBtn.addEventListener("click", () => {
    deleteMode = !deleteMode;
    createMode = false;
});

// ===============================
// MAP CLICK
// ===============================

map.on("click", function(e) {

    if (!createMode) return;

    socket.emit("createPlane", {
        lat: e.latlng.lat,
        lng: e.latlng.lng
    });

});

// ===============================
// RECIBIR ESTADO
// ===============================

socket.on("state", (planesByUser) => {

    for (let key in markers) {
        map.removeLayer(markers[key]);
    }
    markers = {};

    myPlaneCount = 0;

    for (let userId in planesByUser) {

        planesByUser[userId].forEach(plane => {

            const marker = L.marker(
                [plane.lat, plane.lng],
                {
                    icon: planeIcon,
                    rotationAngle: plane.heading,
                    draggable: userId === socket.id
                }
            ).addTo(map);

            markers[plane.id] = marker;

            // DRAG
            if (userId === socket.id) {
                marker.on("dragend", (e) => {

                    const pos = e.target.getLatLng();

                    socket.emit("movePlane", {
                        id: plane.id,
                        lat: pos.lat,
                        lng: pos.lng
                    });
                });
            }

            // DELETE
            marker.on("click", () => {
                if (deleteMode && userId === socket.id) {
                    socket.emit("deletePlane", plane.id);
                }
            });

        });

        if (userId === socket.id) {
            myPlaneCount = planesByUser[userId].length;
        }
    }
});

// ===============================
// 🔹 AGREGÁ AQUÍ TUS socket.on NUEVOS
// ===============================

// socket.on("nuevoEvento", (data) => {
//     ...
// });

// ===============================
// 🔹 AGREGÁ AQUÍ TUS socket.emit MANUALES
// ===============================

// socket.emit("miEvento", {...});