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

//---- MENU DEROULANT-----
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const panel = document.getElementById('panel');
const panelTitle = document.getElementById('panel-title');
const panelContent = document.getElementById('panel-content');

//---- OUVERTURE ET FERMETURE DU MENU DEROULANT-----
menuBtn.addEventListener('click', () => {
    menuDropdown.classList.toggle('hidden');
});

//---- AU CLIC SUR UNE RUBRIQUE------
    menuDropdown.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return; // Si pas d'action, on ne fait rien
        menuDropdown.classList.add('hidden'); // On ferme le menu

        // On change le titre du panneau selon l'action
        if (action === 'souvenirs') {
            panelTitle.textContent = 'Mes Souvenirs';
        }
        if (action === 'parametres') {
            panelTitle.textContent = 'Paramètres';
        }
        
        // On vide le contenu du panneau et on l'affiche
        panelContent.innerHTML = '';
        panel.classList.remove('hidden');
        
        if (action === 'souvenirs') afficherMesSouvenirs();

    });

// Ferme le panneau
    document.getElementById('panel-close').addEventListener('click', () => {
        panel.classList.add('hidden');
    });

//----RUBRIQUE "MES SOUVENIRS" (tableau)-----
    //cette fonction crée une miniature pour un fichier (image ou vidéo)
    function creerMiniature(fichier) {
        const el = document.createElement(fichier.file_type === 'video' ? 'video' : 'img');
        el.src = '../' + fichier.file_path;
        if (fichier.file_type === 'video') {
            el.src += '#t=0.1';
            el.preload = 'metadata';
            el.muted = true;
        }
        return el;
    }

    // Cette fonction récupère les souvenirs depuis l'API et les affiche dans un tableau
    async function afficherMesSouvenirs() {
        panelContent.textContent = 'Chargement...';

        try {
            const reponse = await fetch(API_URL);
            const json = await reponse.json();
            const liste = json.memories;

            if (liste.length === 0) {
                panelContent.textContent = "Aucun souvenir pour l'instant.";
                return;
            }

            const table = document.createElement('table');
            table.innerHTML = '<thead><tr><th>Fichiers</th><th>Titre</th><th>Lieu</th><th>Date</th></tr></thead>';
            const tbody = document.createElement('tbody');

            liste.forEach((s) => {
                const ligne = document.createElement('tr');

                const cellFichiers = document.createElement('td');
                const thumbs = document.createElement('div');
                thumbs.className = 'thumbs';
                s.files.slice(0, 3).forEach((f) => thumbs.appendChild(creerMiniature(f)));
                cellFichiers.appendChild(thumbs);

                const cellTitre = document.createElement('td');
                cellTitre.textContent = s.title;

                const cellLieu = document.createElement('td');
                cellLieu.textContent = `${parseFloat(s.latitude).toFixed(3)}, ${parseFloat(s.longitude).toFixed(3)}`;

                const cellDate = document.createElement('td');
                cellDate.textContent = new Date(s.created_at.replace(' ', 'T')).toLocaleDateString('fr-FR');

                ligne.append(cellFichiers, cellTitre, cellLieu, cellDate);

                // Clic sur une ligne : ferme le panneau et envoie la carte sur le souvenir
                ligne.addEventListener('click', () => {
                    panel.classList.add('hidden');
                    map.flyTo({ center: [parseFloat(s.longitude), parseFloat(s.latitude)], zoom: 15 });
                });

                tbody.appendChild(ligne);
            });

            table.appendChild(tbody);
            panelContent.innerHTML = '';
            panelContent.appendChild(table);
        } catch (erreur) {
            panelContent.textContent = 'Impossible de charger les souvenirs.';
            console.error(erreur);
        }
    }
