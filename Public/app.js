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

let marqueurSelection = null;
const marqueursSouvenirs = [];

// Au clic sur la carte, on enregistre les coordonnées et on ouvre le formulaire
map.on('click', (e) => {
    console.log('Longitude :', e.lngLat.lng, '| Latitude :', e.lngLat.lat);
    if (marqueurSelection) marqueurSelection.remove();
    marqueurSelection = new maplibregl.Marker({ color: '#dc3545' })
        .setLngLat(e.lngLat)
        .addTo(map);
    ouvrirFormulaire(e.lngLat.lng, e.lngLat.lat);
});

//---- MENU DEROULANT-----
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');
const panel = document.getElementById('panel');
const panelTitle = document.getElementById('panel-title');
const panelContent = document.getElementById('panel-content');
const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalFiles = document.getElementById('modal-files');
const modalDate = document.getElementById('story-date');
const storyProgress = document.getElementById('story-progress');
const storyStage = document.getElementById('story-stage');
const storyAddButton = document.getElementById('story-add');
const storyAddFiles = document.getElementById('story-add-files');
const storyDeleteButton = document.getElementById('story-delete');
let souvenirActuel = null;
let mediaIndexActuel = 0;
let minuterieStory = null;
let debutGlissement = null;
const DUREE_IMAGE_STORY = 8000;

document.getElementById('modal-close').addEventListener('click', () => {
    fermerModalSouvenir();
});

modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) fermerModalSouvenir();
});

document.getElementById('story-prev').addEventListener('click', diapositivePrecedente);
document.getElementById('story-next').addEventListener('click', diapositiveSuivante);
storyAddButton.addEventListener('click', () => storyAddFiles.click());
storyAddFiles.addEventListener('change', ajouterMediasAuSouvenir);
storyDeleteButton.addEventListener('click', supprimerSouvenirActuel);

document.addEventListener('keydown', (e) => {
    if (modalOverlay.classList.contains('hidden')) return;
    if (e.key === 'Escape') fermerModalSouvenir();
    if (e.key === 'ArrowLeft') diapositivePrecedente();
    if (e.key === 'ArrowRight') diapositiveSuivante();
});

storyStage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') debutGlissement = e.clientX;
});

storyStage.addEventListener('pointerup', (e) => {
    if (debutGlissement === null) return;
    const distance = e.clientX - debutGlissement;
    debutGlissement = null;
    if (Math.abs(distance) < 50) return;
    if (distance < 0) diapositiveSuivante();
    else diapositivePrecedente();
});

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

    function ouvrirModalSouvenir(souvenir, fichierId = null) {
        souvenirActuel = souvenir;
        souvenirActuel.files = Array.isArray(souvenir.files) ? souvenir.files : [];
        const indexFichier = souvenir.files.findIndex(
            (fichier) => String(fichier.id) === String(fichierId)
        );
        mediaIndexActuel = indexFichier >= 0 ? indexFichier : 0;
        modalTitle.textContent = souvenir.title;
        modalDescription.textContent = souvenir.description || '';

        const dateSouvenir = new Date(String(souvenir.created_at || '').replace(' ', 'T'));
        modalDate.textContent = Number.isNaN(dateSouvenir.getTime())
            ? ''
            : dateSouvenir.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
        modalDate.dateTime = Number.isNaN(dateSouvenir.getTime()) ? '' : dateSouvenir.toISOString();

        modalOverlay.classList.remove('hidden');
        afficherDiapositiveSouvenir();
    }

    function fermerModalSouvenir() {
        if (minuterieStory) clearTimeout(minuterieStory);
        minuterieStory = null;
        modalFiles.querySelector('video')?.pause();
        souvenirActuel = null;
        modalOverlay.classList.add('hidden');
    }

    async function supprimerSouvenirActuel() {
        if (!souvenirActuel) return;
        if (!window.confirm(`Supprimer définitivement « ${souvenirActuel.title} » et ses médias ?`)) return;

        storyDeleteButton.disabled = true;
        try {
            const reponse = await fetch(API_URL, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: souvenirActuel.id }),
            });
            const resultat = await reponse.json();
            if (!reponse.ok) throw new Error(resultat.error || 'Impossible de supprimer ce souvenir.');

            fermerModalSouvenir();
            await chargerMarqueursSouvenirs();
        } catch (erreur) {
            alert(erreur.message || 'Impossible de supprimer ce souvenir.');
            console.error(erreur);
        } finally {
            storyDeleteButton.disabled = false;
        }
    }

    async function ajouterMediasAuSouvenir() {
        if (!souvenirActuel || storyAddFiles.files.length === 0) return;

        const memoryId = souvenirActuel.id;
        const fichierActuelId = souvenirActuel.files[mediaIndexActuel]?.id;
        const donnees = new FormData();
        donnees.append('action', 'append_files');
        donnees.append('memory_id', memoryId);
        for (const fichier of storyAddFiles.files) {
            donnees.append('files[]', fichier);
        }

        storyAddButton.disabled = true;
        try {
            const reponse = await fetch(API_URL, { method: 'POST', body: donnees });
            const resultat = await reponse.json();
            if (!reponse.ok) throw new Error(resultat.error || 'Impossible d’ajouter ces médias.');

            const actualisation = await fetch(API_URL);
            const json = await actualisation.json();
            const souvenirMisAJour = (json.memories || []).find(
                (souvenir) => String(souvenir.id) === String(memoryId)
            );
            if (!souvenirMisAJour) throw new Error('Le souvenir mis à jour est introuvable.');

            if (souvenirActuel && String(souvenirActuel.id) === String(memoryId)) {
                souvenirActuel = souvenirMisAJour;
                const indexConserve = souvenirMisAJour.files.findIndex(
                    (fichier) => String(fichier.id) === String(fichierActuelId)
                );
                mediaIndexActuel = indexConserve >= 0 ? indexConserve : 0;
                afficherDiapositiveSouvenir();
            }
        } catch (erreur) {
            alert(erreur.message || 'Impossible d’ajouter ces médias.');
            console.error(erreur);
        } finally {
            storyAddButton.disabled = false;
            storyAddFiles.value = '';
        }
    }

    function afficherDiapositiveSouvenir() {
        if (minuterieStory) clearTimeout(minuterieStory);
        minuterieStory = null;

        const fichiers = souvenirActuel?.files || [];
        storyProgress.replaceChildren();
        storyProgress.hidden = fichiers.length === 0;

        fichiers.forEach((_, index) => {
            const segment = document.createElement('div');
            segment.className = 'story-segment';
            if (index < mediaIndexActuel) segment.classList.add('is-complete');
            if (index === mediaIndexActuel) segment.classList.add('is-active');
            const progression = document.createElement('span');
            segment.appendChild(progression);
            storyProgress.appendChild(segment);
        });

        if (fichiers.length === 0) {
            const vide = document.createElement('p');
            vide.className = 'story-empty';
            vide.textContent = 'Aucune photo ou vidéo pour ce souvenir.';
            modalFiles.replaceChildren(vide);
            return;
        }

        const fichier = fichiers[mediaIndexActuel];
        const media = creerMiniature(fichier);
        modalFiles.replaceChildren(media);

        const progressionActive = storyProgress.querySelector('.is-active span');
        if (media instanceof HTMLVideoElement) {
            media.controls = true;
            media.playsInline = true;
            media.addEventListener('loadedmetadata', () => {
                if (Number.isFinite(media.duration)) {
                    progressionActive.style.animationDuration = `${media.duration}s`;
                }
            }, { once: true });
            media.addEventListener('ended', diapositiveSuivante, { once: true });
            media.play().catch(() => {});
        } else {
            progressionActive.style.animationDuration = `${DUREE_IMAGE_STORY}ms`;
            minuterieStory = setTimeout(diapositiveSuivante, DUREE_IMAGE_STORY);
        }
    }

    function diapositivePrecedente() {
        if (!souvenirActuel || mediaIndexActuel === 0) return;
        mediaIndexActuel--;
        afficherDiapositiveSouvenir();
    }

    function diapositiveSuivante() {
        if (!souvenirActuel) return;
        if (mediaIndexActuel >= souvenirActuel.files.length - 1) {
            fermerModalSouvenir();
            return;
        }
        mediaIndexActuel++;
        afficherDiapositiveSouvenir();
    }

    function creerMarqueurSouvenir(souvenir) {
        const bulle = document.createElement('button');
        bulle.type = 'button';
        bulle.className = 'marker';
        bulle.setAttribute('aria-label', `Ouvrir le souvenir : ${souvenir.title}`);
        bulle.title = souvenir.title;

        const premierFichier = souvenir.files[0];
        if (premierFichier) {
            const media = creerMiniature(premierFichier);
            if (media instanceof HTMLVideoElement) media.muted = true;
            bulle.appendChild(media);
        } else {
            const initiale = document.createElement('span');
            initiale.textContent = souvenir.title.trim().charAt(0).toLocaleUpperCase() || '?';
            bulle.appendChild(initiale);
        }

        bulle.addEventListener('click', (e) => {
            e.stopPropagation();
            ouvrirModalSouvenir(souvenir);
        });

        return new maplibregl.Marker({ element: bulle, anchor: 'bottom' })
            .setLngLat([Number(souvenir.longitude), Number(souvenir.latitude)])
            .addTo(map);
    }

    async function chargerMarqueursSouvenirs() {
        try {
            const reponse = await fetch(API_URL);
            if (!reponse.ok) throw new Error(`Réponse API : ${reponse.status}`);

            const json = await reponse.json();
            marqueursSouvenirs.forEach((marqueur) => marqueur.remove());
            marqueursSouvenirs.length = 0;

            (json.memories || []).forEach((souvenir) => {
                if (!Array.isArray(souvenir.files)) souvenir.files = [];
                marqueursSouvenirs.push(creerMarqueurSouvenir(souvenir));
            });
        } catch (erreur) {
            console.error('Impossible de charger les marqueurs des souvenirs.', erreur);
        }
    }

    // Cette fonction récupère les souvenirs et les range par date et type de média.
    async function afficherMesSouvenirs() {
        panelContent.textContent = 'Chargement...';

        try {
            const reponse = await fetch(API_URL);
            if (!reponse.ok) throw new Error(`Réponse API : ${reponse.status}`);
            const json = await reponse.json();
            const liste = json.memories || [];

            if (liste.length === 0) {
                panelContent.textContent = "Aucun souvenir pour l'instant.";
                return;
            }

            panelContent.innerHTML = '';
            const groupesParDate = new Map();

            liste.forEach((souvenir) => {
                const cleDate = String(souvenir.created_at || '').slice(0, 10) || 'sans-date';
                if (!groupesParDate.has(cleDate)) {
                    groupesParDate.set(cleDate, { photos: [], videos: [] });
                }

                const groupe = groupesParDate.get(cleDate);
                (souvenir.files || []).forEach((fichier) => {
                    const media = { souvenir, fichier };
                    if (fichier.file_type === 'video') groupe.videos.push(media);
                    else groupe.photos.push(media);
                });
            });

            groupesParDate.forEach((groupe, cleDate) => {
                const jour = document.createElement('section');
                jour.className = 'memory-day';

                const titreJour = document.createElement('h3');
                titreJour.className = 'memory-day-title';
                const date = cleDate === 'sans-date' ? null : new Date(`${cleDate}T00:00:00`);
                titreJour.textContent = date && !Number.isNaN(date.getTime())
                    ? date.toLocaleDateString('fr-FR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })
                    : 'Date inconnue';
                jour.appendChild(titreJour);

                [
                    { titre: 'Photos', medias: groupe.photos, type: 'image' },
                    { titre: 'Vidéos', medias: groupe.videos, type: 'video' },
                ].forEach((categorie) => {
                    const section = document.createElement('section');
                    section.className = 'memory-media-section';

                    const entete = document.createElement('div');
                    entete.className = 'memory-section-heading';
                    const titre = document.createElement('h4');
                    titre.textContent = categorie.titre;
                    const compteur = document.createElement('span');
                    compteur.textContent = categorie.medias.length;
                    entete.append(titre, compteur);
                    section.appendChild(entete);

                    if (categorie.medias.length === 0) {
                        const vide = document.createElement('p');
                        vide.className = 'memory-empty';
                        vide.textContent = `Aucune ${categorie.type === 'video' ? 'vidéo' : 'photo'} ce jour-là`;
                        section.appendChild(vide);
                    } else {
                        const grille = document.createElement('div');
                        grille.className = 'memory-media-grid';

                        categorie.medias.forEach(({ souvenir, fichier }) => {
                            const carte = document.createElement('button');
                            carte.type = 'button';
                            carte.className = 'memory-media-card';
                            carte.setAttribute('aria-label', `${souvenir.title}, ${categorie.titre.toLowerCase()}`);
                            if (categorie.type === 'video') carte.classList.add('is-video');

                            const miniature = creerMiniature(fichier);
                            miniature.className = 'memory-media-thumb';
                            carte.appendChild(miniature);

                            carte.addEventListener('click', () => {
                                panel.classList.add('hidden');
                                map.flyTo({
                                    center: [Number(souvenir.longitude), Number(souvenir.latitude)],
                                    zoom: 15,
                                });
                                ouvrirModalSouvenir(souvenir, fichier.id);
                            });

                            grille.appendChild(carte);
                        });

                        section.appendChild(grille);
                    }

                    jour.appendChild(section);
                });

                panelContent.appendChild(jour);
            });
        } catch (erreur) {
            panelContent.textContent = 'Impossible de charger les souvenirs.';
            console.error(erreur);
        }
    }

    
// ------- FORMULAIRE DE CREATION DE SOUVENIR -------
    const formSouvenir = document.getElementById('form-souvenir');
    const form = document.getElementById('memory-form'); // formulaire de création de souvenir
    const inputFiles = document.getElementById('files'); // input type="file" pour les fichiers
    const preview = document.getElementById('preview'); // div pour l'aperçu des fichiers sélectionnés
    let coordsClic = null; // coordonnées du point cliqué sur la carte

    // Ouvre le formulaire et stocke les coordonnées du clic
    function ouvrirFormulaire(lng, lat) {
        coordsClic = { lng, lat };
        // On vide le formulaire et l'aperçu
        formSouvenir.classList.remove('hidden');
    }
    
    // Ferme le formulaire et réinitialise les champs
    function fermerFormulaire() {
        formSouvenir.classList.add('hidden');
        form.reset();
        preview.innerHTML = '';
        coordsClic = null;
    }

    document.getElementById('cancel-btn').addEventListener('click', () => {
        if (marqueurSelection) marqueurSelection.remove();
        marqueurSelection = null;
        fermerFormulaire();
    });

    //apercu des fichiers selectionnés
    inputFiles.addEventListener('change', () => {
    preview.innerHTML = '';
    for (const file of inputFiles.files) {
        const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
        el.src = URL.createObjectURL(file);
        preview.appendChild(el);
    }
    });

    //renvoie vers l'API 
    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Empêche le rechargement de la page

        // On crée un FormData pour envoyer les données du formulaire
        const data =new FormData(form);
        data.append('title', document.getElementById('title').value);
        data.append('description', document.getElementById('description').value);
        data.append('latitude', coordsClic.lat);
        data.append('longitude', coordsClic.lng);
        for (const file of inputFiles.files) {
            data.append('files[]', file);
        }
        try {
            const reponse = await fetch(API_URL, { method : 'POST', body: data });
            const json = await reponse.json();

            // On vérifie si la réponse est OK
            if (!reponse.ok){
                alert(json.error || 'Erreur lors de la création du souvenir.');
                return;
            }

            console.log('Souvenir créé avec succès :', json.id); 
            if (marqueurSelection) marqueurSelection.remove();
            marqueurSelection = null;
            fermerFormulaire();
            await chargerMarqueursSouvenirs();

        }catch(erreur) { // En cas d'erreur réseau ou autre
            alert('Impossible de contacter le serveur.'); // On affiche un message d'erreur à l'utilisateur
            console.error(erreur);
        }
    });

    chargerMarqueursSouvenirs();
        

