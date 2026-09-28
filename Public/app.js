//----CONFIGURATION-----
    // Clé de l'API MapTiler
    const MAPTILER_KEY = "TPsGta1SymPBZiEUmTeD";
    const API_URL = '../api/memories.php';

// Centre de départ de la carte : [longitude, latitude]
    const CENTRE_DEPART = [2.3522, 48.8566]; // Paris
    const ZOOM_DEPART = 11; // Niveau de zoom

//----INITIALISATION DE LA CARTE-----
    const map = new maplibregl.Map({
        container: 'map', // id de l'élément HTML qui contiendra la carte
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`, // style de la carte
        center: CENTRE_DEPART, // coordonnées du centre de la carte
        zoom: ZOOM_DEPART, // niveau de zoom
    });

// Boutons de zoom et de rotation
    map.addControl(new maplibregl.NavigationControl());

// Au clic sur la carte, on affiche les coordonnées dans la console
    map.on('click', (e) => {
        console.log('Longitude :', e.lngLat.lng, '| Latitude :', e.lngLat.lat);
    });