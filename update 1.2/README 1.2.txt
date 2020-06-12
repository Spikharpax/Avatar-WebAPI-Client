************************
Mise à jour version 1.2
************************

Ce patch n'est à installer que si vous avez une version 1.1
Pour une installation complète, le package d'installation AvatarWebAPIClient.7z contient déjà ce patch.

Mise à jour:
	- Ajout de la possibilité de lire une URL d'un fichier audio sauvegardé sur le Serveur (avatar.js, event 'play')
					Mot-clé SERVEURURL
					Exemple d'implémentation dans un plug-in (fichier audio.mp3 dans un répertoire "audio" sur le serveur):
						// Serveur HTTP donc necessité d'ajouté en "static" le répertoire "audio"
						let staticPath = path.resolve(join(__dirname, "audio"));
						Avatar.Documentation.setStaticPath(staticPath, () => {
							Avatar.play('SERVERURL/audio.mp3', client, () => {
									// Do stuff
							})
						});
	- Ajout de la possibilité de lire une URL (avatar.js, event 'play')
					Mot-clé %URL%
					Exemple d'implémentation dans un plug-in (fichier stone.mp3 sur un site https:/audiotune/musique80):
					Avatar.play('%URL%https:/audiotune/musique80/stone.mp3', client, () => {
							// Do stuff
					})
  - Modification de l'écoute pour une reconnaissance plus stable (chrome/speech.js)

Procédure d'installation :
	- Copiez les répertoires "resources" <CLIENT>/
	- Validez les remplacements fichiers
	- N'oubliez pas de changer la propriété "version" en 1.2 dans le fichier de propriétés Avatar.config du client
