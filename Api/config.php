
<?php 
/**
 * config.php
 * 
 * Fichier de configuration de la connexion à la base de données MemoryMap.
 * Crée une instance PDO réutilisable dans les autres scripts de l'API.
 * 
 * À inclure via require_once en haut de chaque fichier de l'API.
 * 
 * @author Bosse
 * @date 27/09/2026
 */

$dbHost = 'localhost'; // Adresse du serveur de base de données
$dbName = 'memoriesmap'; // Nom de la base de données   
$dbUser = 'root'; // Nom d'utilisateur de la base de données
$dbPass = ''; // Mot de passe de l'utilisateur de la base de données

$dsn = "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4";

try {
	$pdo = new PDO($dsn, $dbUser, $dbPass, [
		PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
		PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
		PDO::ATTR_EMULATE_PREPARES => false,
	]);
} catch (PDOException $exception) {
	http_response_code(500);
	exit('Erreur de connexion à la base de données.');
}



