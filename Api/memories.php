<?php

/**
 * memories.php
 * 
 * Endpoint principal de l'API MemoryMap.
 * Gère les souvenirs placés sur la carte (création et récupération).
 * 
 * Routes :
 * - GET  : renvoie tous les souvenirs, avec leurs fichiers associés (photos/vidéos), en JSON
 * - POST : crée un nouveau souvenir (titre, description, latitude, longitude)
 *          + upload d'un ou plusieurs fichiers liés (table memory_files)
 * 
 * Dépendances : require_once config.php (fournit la connexion PDO $pdo)
 * 
 * @author Bosse
 * @date 27/09/2026
 */

// Active le respect strict des types PHP.
declare(strict_types=1);

// Toutes les réponses de cette API sont en JSON.
header('Content-Type: application/json; charset=utf-8');

// Charge la connexion PDO.
require_once __DIR__ . '/config.php';

// Envoie une réponse JSON puis arrête le script.
function respond(array $data, int $status = 200): never
{
	http_response_code($status);
	echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
	exit;
}

// Transforme l'upload PHP en une liste simple, même pour plusieurs fichiers.
function normaliserFichiers(array $fichiers): array
{
	if (!isset($fichiers['name'])) {
		return [];
	}

	$fichiersNormalises = [];
	$nombreFichiers = is_array($fichiers['name']) ? count($fichiers['name']) : 1;

	// On prépare chaque fichier dans le même format.
	for ($index = 0; $index < $nombreFichiers; $index++) {
		$fichiersNormalises[] = [
			'name' => is_array($fichiers['name']) ? $fichiers['name'][$index] : $fichiers['name'],
			'type' => is_array($fichiers['type']) ? $fichiers['type'][$index] : $fichiers['type'],
			'tmp_name' => is_array($fichiers['tmp_name']) ? $fichiers['tmp_name'][$index] : $fichiers['tmp_name'],
			'error' => is_array($fichiers['error']) ? $fichiers['error'][$index] : $fichiers['error'],
			'size' => is_array($fichiers['size']) ? $fichiers['size'][$index] : $fichiers['size'],
		];
	}

	return $fichiersNormalises;
}

// Récupère la méthode HTTP utilisée.
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// GET : récupère les souvenirs et leurs fichiers.
if ($method === 'GET') {
	$souvenirs = $pdo->query(
            'SELECT id, title, description, latitude, longitude, created_at
            FROM memories
            ORDER BY created_at DESC, id DESC'
        )->fetchAll();

	$requeteFichiers = $pdo->query(
            'SELECT id, memory_id, file_path, file_type, position
            FROM memory_files
            ORDER BY memory_id, position, id'
        );

	$fichiersParSouvenir = [];
	foreach ($requeteFichiers as $fichier) {
		$fichiersParSouvenir[$fichier['memory_id']][] = $fichier;
	}

	foreach ($souvenirs as &$souvenir) {
		$souvenir['files'] = $fichiersParSouvenir[$souvenir['id']] ?? [];
	}
	unset($souvenir);

	respond(['memories' => $souvenirs]);
}

if ($method === 'DELETE') {
	$requete = json_decode((string) file_get_contents('php://input'), true);
	$memoryId = filter_var($requete['id'] ?? null, FILTER_VALIDATE_INT);
	if ($memoryId === false || $memoryId === null || $memoryId < 1) {
		respond(['error' => 'L’identifiant du souvenir est invalide.'], 422);
	}

	try {
		$pdo->beginTransaction();

		$memoryCheck = $pdo->prepare('SELECT id FROM memories WHERE id = :memory_id FOR UPDATE');
		$memoryCheck->execute([':memory_id' => $memoryId]);
		if (!$memoryCheck->fetchColumn()) {
			$pdo->rollBack();
			respond(['error' => 'Ce souvenir est introuvable.'], 404);
		}

		$fileQuery = $pdo->prepare('SELECT file_path FROM memory_files WHERE memory_id = :memory_id');
		$fileQuery->execute([':memory_id' => $memoryId]);
		$filePaths = $fileQuery->fetchAll(PDO::FETCH_COLUMN);

		$deleteStatement = $pdo->prepare('DELETE FROM memories WHERE id = :memory_id');
		$deleteStatement->execute([':memory_id' => $memoryId]);
		$pdo->commit();
	} catch (Throwable $exception) {
		if ($pdo->inTransaction()) {
			$pdo->rollBack();
		}

		respond(['error' => 'Impossible de supprimer le souvenir.'], 500);
	}

	$uploadRoot = realpath(__DIR__ . '/../uploads');
	$referencedFile = $pdo->prepare('SELECT COUNT(*) FROM memory_files WHERE file_path = :file_path');
	foreach ($filePaths as $filePath) {
		$fileOnDisk = realpath(__DIR__ . '/../' . ltrim((string) $filePath, '/\\'));
		if ($uploadRoot === false || $fileOnDisk === false ||
			!str_starts_with($fileOnDisk, $uploadRoot . DIRECTORY_SEPARATOR) || !is_file($fileOnDisk)) {
			continue;
		}

		$referencedFile->execute([':file_path' => $filePath]);
		if ((int) $referencedFile->fetchColumn() === 0) {
			@unlink($fileOnDisk);
		}
	}

	respond([
		'message' => 'Souvenir supprimé avec succès.',
		'id' => $memoryId,
	]);
}

// Seules les méthodes GET, POST et DELETE sont autorisées.
if ($method !== 'POST') {
	header('Allow: GET, POST, DELETE');
	respond(['error' => 'Méthode HTTP non autorisée.'], 405);
}

// Une action peut ajouter des médias à un souvenir au lieu d'en créer un nouveau.
$action = (string) ($_POST['action'] ?? 'create');
$memoryId = null;
$title = '';
$description = '';
$latitude = false;
$longitude = false;

if ($action === 'append_files') {
	$memoryId = filter_var($_POST['memory_id'] ?? null, FILTER_VALIDATE_INT);
	if ($memoryId === false || $memoryId === null || $memoryId < 1) {
		respond(['error' => 'Le souvenir à compléter est invalide.'], 422);
	}

	$memoryCheck = $pdo->prepare('SELECT id FROM memories WHERE id = :memory_id');
	$memoryCheck->execute([':memory_id' => $memoryId]);
	if (!$memoryCheck->fetchColumn()) {
		respond(['error' => 'Le souvenir à compléter est introuvable.'], 404);
	}
} elseif ($action === 'create') {
	// Récupère les données envoyées par le formulaire de création.
	$title = trim((string) ($_POST['title'] ?? ''));
	$description = trim((string) ($_POST['description'] ?? ''));
	$latitude = filter_var($_POST['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
	$longitude = filter_var($_POST['longitude'] ?? null, FILTER_VALIDATE_FLOAT);

	if ($title === '' || mb_strlen($title) > 255) {
		respond(['error' => 'Le titre est obligatoire et doit contenir au maximum 255 caractères.'], 422);
	}

	if ($latitude === false || $latitude < -90 || $latitude > 90 ||
		$longitude === false || $longitude < -180 || $longitude > 180) {
		respond(['error' => 'Les coordonnées GPS sont invalides.'], 422);
	}
} else {
	respond(['error' => 'Action non reconnue.'], 400);
}

// Prépare le dossier et les fichiers envoyés.
$fichiersEnvoyes = normaliserFichiers($_FILES['files'] ?? []);
$dossierUpload = __DIR__ . '/../uploads';
$fichiersEnregistres = [];

if (!is_dir($dossierUpload) && !mkdir($dossierUpload, 0755, true)) {
	respond(['error' => 'Le dossier d’upload est indisponible.'], 500);
}

// Autorise uniquement certains formats image et vidéo.
$finfo = new finfo(FILEINFO_MIME_TYPE);
$allowedTypes = [
	'image/jpeg' => 'image',
	'image/png' => 'image',
	'image/gif' => 'image',
	'image/webp' => 'image',
	'video/mp4' => 'video',
	'video/webm' => 'video',
	'video/quicktime' => 'video',
];

foreach ($fichiersEnvoyes as $index => $fichier) {
	if ($fichier['error'] === UPLOAD_ERR_NO_FILE) {
		continue;
	}

	if ($fichier['error'] !== UPLOAD_ERR_OK || $fichier['size'] > 50 * 1024 * 1024) {
		respond(['error' => 'Un fichier est invalide ou dépasse la taille maximale de 50 Mo.'], 422);
	}

	// Vérifie le vrai type du fichier, puis lui donne un nom aléatoire.
	$typeMime = $finfo->file($fichier['tmp_name']);
	if (!isset($allowedTypes[$typeMime])) {
		respond(['error' => 'Seuls les fichiers image et vidéo sont acceptés.'], 422);
	}

	$extension = strtolower(pathinfo($fichier['name'], PATHINFO_EXTENSION));
	$nomFichier = bin2hex(random_bytes(16)) . ($extension !== '' ? ".{$extension}" : '');
	$destination = $dossierUpload . DIRECTORY_SEPARATOR . $nomFichier;

	if (!move_uploaded_file($fichier['tmp_name'], $destination)) {
		respond(['error' => 'Impossible d’enregistrer un fichier uploadé.'], 500);
	}

	$fichiersEnregistres[] = [
		'path' => 'uploads/' . $nomFichier,
		'type' => $allowedTypes[$typeMime],
		'position' => $index,
		'absolute_path' => $destination,
	];
}

if ($action === 'append_files' && $fichiersEnregistres === []) {
	respond(['error' => 'Sélectionnez au moins une photo ou une vidéo.'], 422);
}

try {
	// Enregistre le souvenir et ses fichiers dans une seule transaction.
	$pdo->beginTransaction();

	$positionDebut = 0;
	if ($action === 'create') {
		$memoryStatement = $pdo->prepare(
			'INSERT INTO memories (title, description, latitude, longitude)
			 VALUES (:title, :description, :latitude, :longitude)'
		);
		$memoryStatement->execute([
			':title' => $title,
			':description' => $description !== '' ? $description : null,
			':latitude' => $latitude,
			':longitude' => $longitude,
		]);

		$memoryId = (int) $pdo->lastInsertId();
	} else {
		$positionStatement = $pdo->prepare(
			'SELECT COALESCE(MAX(position), -1) + 1 FROM memory_files WHERE memory_id = :memory_id'
		);
		$positionStatement->execute([':memory_id' => $memoryId]);
		$positionDebut = (int) $positionStatement->fetchColumn();
	}

	$fileStatement = $pdo->prepare(
		'INSERT INTO memory_files (memory_id, file_path, file_type, position)
		 VALUES (:memory_id, :file_path, :file_type, :position)'
	);

	foreach ($fichiersEnregistres as $fichier) {
		$fileStatement->execute([
			':memory_id' => $memoryId,
			':file_path' => $fichier['path'],
			':file_type' => $fichier['type'],
			':position' => $positionDebut + $fichier['position'],
		]);
	}

	$pdo->commit();
} catch (Throwable $exception) {
	if ($pdo->inTransaction()) {
		$pdo->rollBack();
	}

	foreach ($fichiersEnregistres as $fichier) {
		@unlink($fichier['absolute_path']);
	}

	respond(['error' => 'Impossible de créer le souvenir.'], 500);
}

respond([
	'message' => $action === 'create'
		? 'Souvenir créé avec succès.'
		: 'Médias ajoutés au souvenir avec succès.',
	'id' => $memoryId,
	], $action === 'create' ? 201 : 200);
