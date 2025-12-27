# 📜 Guide d'Installation - Déplacement Automatique des Backups

## 🎯 Objectif

Ce script surveille automatiquement votre dossier **Téléchargements** et déplace tous les fichiers `backup_*.xlsx` vers le dossier `Sauvegarde-donnée` dans le répertoire de l'application.

## 📁 Structure des Fichiers

```
Gestion électrification massive - GOOGLE - VSCODE/
├── scripts/
│   ├── auto-move-backups.ps1              # Script PowerShell principal
│   └── Demarrer-Gestionnaire-Backups.bat  # Lanceur (double-clic)
├── Sauvegarde-donnée/                     # Créé automatiquement
│   └── backup_2025-11-28_03-00-00.xlsx   # Vos backups ici
└── backup-mover.log                       # Journal d'activité
```

## 🚀 Installation et Utilisation

### Méthode 1 : Lancement Manuel (Recommandé pour tester)

1. **Double-cliquez** sur `Demarrer-Gestionnaire-Backups.bat`
2. Une fenêtre PowerShell s'ouvre
3. Le script commence à surveiller le dossier Téléchargements
4. **Laissez cette fenêtre ouverte** tant que vous voulez que la surveillance continue

### Méthode 2 : Démarrage Automatique avec Windows

Pour que le script démarre automatiquement à chaque démarrage de Windows :

#### Option A : Raccourci dans le dossier Démarrage

1. Appuyez sur `Win + R`
2. Tapez : `shell:startup` et appuyez sur Entrée
3. Créez un raccourci vers `Demarrer-Gestionnaire-Backups.bat`
4. Le script démarrera automatiquement à chaque connexion

#### Option B : Tâche Planifiée (Plus professionnel)

1. Ouvrez le **Planificateur de tâches** Windows
2. Cliquez sur **"Créer une tâche..."**
3. **Général** :
   - Nom : `Gestionnaire Backups Électrification`
   - Cochez "Exécuter même si l'utilisateur n'est pas connecté"
4. **Déclencheurs** :
   - Nouveau → À l'ouverture de session
5. **Actions** :
   - Nouveau → Démarrer un programme
   - Programme : `powershell.exe`
   - Arguments : `-ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Mes Sites Web\Gestion électrification massive - GOOGLE - VSCODE\scripts\auto-move-backups.ps1"`
6. **Conditions** :
   - Décochez "Démarrer uniquement si l'ordinateur est relié au secteur"
7. Cliquez sur **OK**

## 🔧 Fonctionnement

### Ce que fait le script :

1. ✅ **Crée le dossier** `Sauvegarde-donnée` s'il n'existe pas
2. 🔍 **Surveille** le dossier Téléchargements en temps réel
3. 📥 **Détecte** automatiquement les nouveaux fichiers `backup_*.xlsx`
4. 📁 **Déplace** immédiatement ces fichiers vers `Sauvegarde-donnée`
5. 🔔 **Affiche** une notification Windows à chaque déplacement
6. 📝 **Enregistre** toutes les actions dans `backup-mover.log`

### Gestion des doublons :

Si un fichier avec le même nom existe déjà, le script ajoute automatiquement un suffixe :
- `backup_2025-11-28_03-00-00.xlsx`
- `backup_2025-11-28_03-00-00_1.xlsx`
- `backup_2025-11-28_03-00-00_2.xlsx`

## 📊 Vérification

### Vérifier que le script fonctionne :

1. **Lancez le script** avec `Demarrer-Gestionnaire-Backups.bat`
2. **Ouvrez `terrain.html`** dans votre navigateur
3. **Effectuez un backup manuel** (bouton "💾 Sauvegarder")
4. **Attendez 2-3 secondes**
5. **Vérifiez** que le fichier est bien dans `Sauvegarde-donnée/`

### Consulter le journal :

Ouvrez `backup-mover.log` pour voir l'historique :
```
[2025-11-28 03:00:15] ✅ Dossier créé: C:\...\Sauvegarde-donnée
[2025-11-28 03:00:15] 🔍 Surveillance du dossier: C:\Users\...\Downloads
[2025-11-28 03:00:15] ✅ Surveillance active
[2025-11-28 03:05:22] ✅ Déplacé: backup_2025-11-28_03-05-20.xlsx → Sauvegarde-donnée
```

## ⚙️ Configuration

### Modifier le dossier de destination :

Éditez `auto-move-backups.ps1` ligne 10 :
```powershell
$backupFolder = Join-Path $appDirectory "Sauvegarde-donnée"
```

Changez `"Sauvegarde-donnée"` par le nom souhaité.

### Modifier le pattern de fichiers :

Éditez `auto-move-backups.ps1` ligne 45 :
```powershell
$watcher.Filter = "backup_*.xlsx"
```

## 🛑 Arrêter le Script

### Si lancé manuellement :
- Fermez la fenêtre PowerShell
- Ou appuyez sur `Ctrl + C` dans la fenêtre

### Si lancé automatiquement :
1. Ouvrez le **Gestionnaire des tâches** (`Ctrl + Shift + Esc`)
2. Onglet **Détails**
3. Trouvez `powershell.exe` avec le script
4. Clic droit → **Fin de tâche**

## 🐛 Dépannage

### Le script ne démarre pas

**Erreur : "L'exécution de scripts est désactivée"**

Solution :
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Les fichiers ne sont pas déplacés

1. **Vérifiez** que le script est bien en cours d'exécution
2. **Consultez** `backup-mover.log` pour les erreurs
3. **Vérifiez** que le fichier commence bien par `backup_` et se termine par `.xlsx`
4. **Attendez** 2-3 secondes après le téléchargement

### Permissions insuffisantes

Si vous avez des erreurs de permissions :
1. Clic droit sur `Demarrer-Gestionnaire-Backups.bat`
2. **Exécuter en tant qu'administrateur**

### Le dossier Sauvegarde-donnée n'est pas créé

Vérifiez que vous avez les droits d'écriture dans le dossier de l'application.

## 📞 Support

### Fichiers de diagnostic :

1. **backup-mover.log** : Journal complet des opérations
2. **Fenêtre PowerShell** : Messages en temps réel

### Commandes utiles :

**Tester manuellement le script :**
```powershell
cd "C:\Mes Sites Web\Gestion électrification massive - GOOGLE - VSCODE\scripts"
.\auto-move-backups.ps1
```

**Vérifier les processus en cours :**
```powershell
Get-Process powershell | Where-Object {$_.MainWindowTitle -like "*Gestionnaire*"}
```

## ⚡ Pour une Automatisation Totale (Recommandé)

Pour que la sauvegarde se fasse **sans aucune fenêtre popup**, configurez votre navigateur :

### Sur Microsoft Edge :
1. Allez dans **Paramètres** `...` > **Téléchargements**
2. **Désactivez** l'option : *"Demander ce qu'il faut faire avec chaque téléchargement"*

### Sur Google Chrome :
1. Allez dans **Paramètres** `⋮` > **Téléchargements**
2. **Désactivez** l'option : *"Toujours demander où enregistrer les fichiers"*

**Résultat :**
- Les fichiers se téléchargent silencieusement dans "Téléchargements"
- Le script les déplace immédiatement dans `Sauvegarde-donnée`
- Vous n'avez plus rien à cliquer !

## ✅ Avantages de cette Solution

- ✅ **Automatique** : Aucune intervention manuelle
- ✅ **Temps réel** : Déplacement immédiat
- ✅ **Notifications** : Vous êtes informé de chaque déplacement
- ✅ **Journal** : Historique complet des opérations
- ✅ **Gestion des doublons** : Pas de perte de données
- ✅ **Léger** : Consommation minimale de ressources
- ✅ **Compatible** : Fonctionne avec tous les navigateurs

## 🔄 Workflow Complet

1. **Vous activez** l'auto-backup dans `terrain.html`
2. **Le navigateur** télécharge `backup_*.xlsx` dans Téléchargements
3. **Le script** détecte le nouveau fichier
4. **Le fichier** est déplacé vers `Sauvegarde-donnée/`
5. **Une notification** vous confirme le déplacement
6. **Le journal** enregistre l'opération

## 🎉 Résultat Final

Vos backups sont maintenant **automatiquement organisés** dans un dossier dédié, sans aucune intervention manuelle !

```
Sauvegarde-donnée/
├── backup_2025-11-28_03-00-00.xlsx
├── backup_2025-11-28_03-05-00.xlsx
├── backup_2025-11-28_03-10-00.xlsx
└── backup_2025-11-28_03-15-00.xlsx
```
