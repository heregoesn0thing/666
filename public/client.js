// ===============================
// VARIABLES GLOBALES CLIENTE
// ===============================

let fabCreateMode = false;
let fabDeleteMode = false;
let markers = {};
let myPlaneCount = 0;
let taxiMode = null;

const GLOBAL_POINTS = {
    ARP_SPSO: {
        lat: -13.744800,
        lng: -76.220411
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
// CLICK EN MAPA
// ===============================

map.on("click", function(e) {

    if (fabCreateMode) {
        socket.emit("createPlane", {
            lat: e.latlng.lat,
            lng: e.latlng.lng
        });
        return;
    }

    if (taxiMode === "create") {

        const planeId = Object.keys(markers)[0];
        if (!planeId) return;

        socket.emit("command", {
            type: "ADD_ROUTE_POINT",
            planeId: planeId,
            point: {
                lat: e.latlng.lat,
                lng: e.latlng.lng
            }
        });
    }
});

// ===============================
// RECIBIR ESTADO
// ===============================

socket.on("state", (planesByUser) => {

    // 🔄 Limpiar marcadores actuales
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
                    draggable: userId === socket.id // 🔥 SOLO TU AVIÓN
                }
            ).addTo(map);

            markers[plane.id] = marker;

            // ============================
            // DRAG CONTROLADO POR SERVIDOR
            // ============================

            if (userId === socket.id) {

                marker.on("dragend", (e) => {

                    const pos = e.target.getLatLng();

                    socket.emit("command", {
                        type: "DRAG_PLANE",
                        planeId: plane.id,
                        lat: pos.lat,
                        lng: pos.lng
                    });
                });
            }

            // ============================
            // DELETE
            // ============================

            marker.on("click", () => {
                if (fabDeleteMode && userId === socket.id) {
                    socket.emit("deletePlane", plane.id);
                }
            });
        });

        // ============================
        // MOSTRAR / OCULTAR BOTÓN DELETE
        // ============================

        if (userId === socket.id) {

            myPlaneCount = planesByUser[userId].length;

            const fabDeleteBtn = document.getElementById("fabDeletePlane");

            if (fabDeleteBtn) {
                if (myPlaneCount > 0) {
                    fabDeleteBtn.classList.remove("hidden");
                } else {
                    fabDeleteBtn.classList.add("hidden");
                    fabDeleteMode = false;
                }
            }
        }
    }
});

// ===============================
// DOM READY
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    const fabMain = document.getElementById("fabMain");
    const fabOptions = document.getElementById("fabOptions");
    const fabCreateBtn = document.getElementById("fabCreatePlane");
    const fabDeleteBtn = document.getElementById("fabDeletePlane");

    if (fabMain && fabOptions) {
        fabMain.addEventListener("click", () => {
            fabOptions.classList.toggle("active");
            fabMain.textContent =
                fabOptions.classList.contains("active") ? "×" : "+";
        });
    }

    if (fabCreateBtn) {
        fabCreateBtn.addEventListener("click", () => {
            fabCreateMode = !fabCreateMode;
            fabCreateBtn.classList.toggle("activo");
            fabDeleteMode = false;
        });
    }

    if (fabDeleteBtn) {
        fabDeleteBtn.addEventListener("click", () => {

            fabDeleteMode = !fabDeleteMode;
            fabDeleteBtn.classList.toggle("activo");

            fabCreateMode = false;
            if (fabCreateBtn) {
                fabCreateBtn.classList.remove("activo");
            }
        });
    }

    // ===============================
    // TAXI CONTROL
    // ===============================

    const taxiCreate = document.getElementById("taxiCreate");
    const taxiStart = document.getElementById("taxiStart");
    const taxiHold = document.getElementById("taxiHold");

    function resetTaxiButtons(){
        [taxiCreate, taxiStart, taxiHold].forEach(btn=>{
            if(btn) btn.classList.remove("activo");
        });
    }

    if (taxiCreate) {
        taxiCreate.addEventListener("click", () => {

            resetTaxiButtons();
            taxiCreate.classList.add("activo");
            taxiMode = "create";
        });
    }

    if (taxiStart) {
        taxiStart.addEventListener("click", () => {

            const planeId = Object.keys(markers)[0];
            if (!planeId) return;

            resetTaxiButtons();
            taxiStart.classList.add("activo");

            socket.emit("command", {
                type: "SET_STATE",
                planeId: planeId,
                state: "taxi"
            });
        });
    }

    if (taxiHold) {
        taxiHold.addEventListener("click", () => {

            const planeId = Object.keys(markers)[0];
            if (!planeId) return;

            resetTaxiButtons();
            taxiHold.classList.add("activo");

            socket.emit("command", {
                type: "SET_STATE",
                planeId: planeId,
                state: "holding"
            });
        });
    }

});

