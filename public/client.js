// ===============================
// VARIABLES GLOBALES CLIENTE
// ===============================

let fabCreateMode = false;
let fabDeleteMode = false;
let markers = {};
let routeLayers = [];
let ownPlaneIds = [];
let selectedPlaneId = null;
let selectedPlaneRing = null;
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

let vorRectangle = null;

function drawVorBox(vorPoint) {
    if (!vorPoint) return;

    if (vorRectangle) {
        map.removeLayer(vorRectangle);
    }

    const vorBoxHalfSize = 0.00035;
    const vorBounds = [
        [
            vorPoint.lat - vorBoxHalfSize,
            vorPoint.lng - vorBoxHalfSize
        ],
        [
            vorPoint.lat + vorBoxHalfSize,
            vorPoint.lng + vorBoxHalfSize
        ]
    ];

    vorRectangle = L.rectangle(vorBounds, {
        className: "vor-box"
    }).addTo(map).bindTooltip("VOR SCO", {
        permanent: false,
        direction: "top",
        className: "vor-label"
    });
}

function getActivePlaneId() {
    if (selectedPlaneId && ownPlaneIds.includes(selectedPlaneId)) {
        return selectedPlaneId;
    }

    if (ownPlaneIds.length === 1) {
        return ownPlaneIds[0];
    }

    return null;
}

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

        const planeId = getActivePlaneId();
        if (!planeId) {
            alert("Selecciona una aeronave tuya con click antes de crear la ruta.");
            return;
        }

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
    routeLayers.forEach((layer) => map.removeLayer(layer));
    routeLayers = [];
    ownPlaneIds = [];
    if (selectedPlaneRing) {
        map.removeLayer(selectedPlaneRing);
        selectedPlaneRing = null;
    }
    myPlaneCount = 0;

    for (let userId in planesByUser) {

        planesByUser[userId].forEach(plane => {
            const isOwnPlane = userId === socket.id;

            if (isOwnPlane) {
                ownPlaneIds.push(plane.id);
            }

            const marker = L.marker(
                [plane.lat, plane.lng],
                {
                    icon: planeIcon,
                    rotationAngle: plane.heading,
                    draggable: isOwnPlane,
                    zIndexOffset: plane.id === selectedPlaneId ? 1000 : 0
                }
            ).addTo(map);

            markers[plane.id] = marker;

            if (isOwnPlane && plane.route.length > 0) {
                const routePath = [
                    [plane.lat, plane.lng],
                    ...plane.route.map((point) => [point.lat, point.lng])
                ];

                const routeLayer = L.polyline(routePath, {
                    className: "taxi-route-line"
                }).addTo(map);

                routeLayers.push(routeLayer);
            }

            // ============================
            // DRAG CONTROLADO POR SERVIDOR
            // ============================

            if (isOwnPlane) {

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

            if (isOwnPlane) {
                marker.on("click", () => {
                    if (fabDeleteMode) {
                        socket.emit("deletePlane", plane.id);
                        return;
                    }

                    selectedPlaneId = plane.id;
                });
            }
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

    if (selectedPlaneId && !ownPlaneIds.includes(selectedPlaneId)) {
        selectedPlaneId = null;
    }

    if (selectedPlaneId && markers[selectedPlaneId]) {
        selectedPlaneRing = L.circleMarker(markers[selectedPlaneId].getLatLng(), {
            className: "selected-plane-ring",
            radius: 22
        }).addTo(map);
    }
});

socket.on("globalPoints", (points) => {
    if (!points || !points.VOR_SCO) return;
    drawVorBox(points.VOR_SCO);
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

            if (fabCreateMode) {
                resetTaxiButtons();
                setTaxiMode(null);
            }
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

    function setTaxiMode(mode) {
        taxiMode = mode;
        map.getContainer().classList.toggle("taxi-route-mode", mode === "create");
    }

    if (taxiCreate) {
        taxiCreate.addEventListener("click", () => {

            fabCreateMode = false;
            if (fabCreateBtn) {
                fabCreateBtn.classList.remove("activo");
            }

            fabDeleteMode = false;
            if (fabDeleteBtn) {
                fabDeleteBtn.classList.remove("activo");
            }

            resetTaxiButtons();
            taxiCreate.classList.add("activo");
            setTaxiMode("create");
        });
    }

    if (taxiStart) {
        taxiStart.addEventListener("click", () => {

            const planeId = getActivePlaneId();
            if (!planeId) {
                alert("Selecciona una aeronave tuya con click para iniciar taxi.");
                return;
            }

            resetTaxiButtons();
            taxiStart.classList.add("activo");
            setTaxiMode(null);

            socket.emit("command", {
                type: "SET_STATE",
                planeId: planeId,
                state: "taxi"
            });
        });
    }

    if (taxiHold) {
        taxiHold.addEventListener("click", () => {

            const planeId = getActivePlaneId();
            if (!planeId) {
                alert("Selecciona una aeronave tuya con click para poner HOLD.");
                return;
            }

            resetTaxiButtons();
            taxiHold.classList.add("activo");
            setTaxiMode(null);

            socket.emit("command", {
                type: "SET_STATE",
                planeId: planeId,
                state: "holding"
            });
        });
    }

});


