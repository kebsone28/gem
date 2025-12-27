# 💾 Système de Sauvegarde et Restauration Automatique

## Vue d'ensemble

Le système de sauvegarde automatique permet de protéger vos données contre la perte en exportant périodiquement toutes les données vers des fichiers Excel locaux. En cas de suppression des données du navigateur, vous pouvez facilement restaurer vos données depuis un fichier de backup.

## 🎯 Fonctionnalités

### Sauvegarde Automatique
- ⏱️ **Export périodique** : Toutes les 5, 10, 15, 30 ou 60 minutes
- 💾 **Sauvegarde manuelle** : Bouton "Sauvegarder" pour export immédiat
- 📁 **Fichiers horodatés** : `backup_YYYY-MM-DD_HH-mm-ss.xlsx`
- 🔔 **Notifications** : Alertes discrètes lors des sauvegardes
- 📊 **Historique** : Liste des 20 dernières sauvegardes

### Restauration Intelligente
- 🔍 **Détection automatique** : Au démarrage, vérifie si IndexedDB est vide
- 📥 **Interface intuitive** : Dialogue de sélection de fichier
- ✅ **Validation** : Vérifie la structure du fichier avant import
- 📊 **Résumé** : Affiche le nombre d'enregistrements restaurés

## 📖 Guide d'utilisation

### Activer la sauvegarde automatique

1. Ouvrez la page **Terrain** (`terrain.html`)
2. Dans la section "Gestion des Sauvegardes" (panneau de gauche)
3. Activez le toggle "Sauvegarde automatique"
4. Choisissez l'intervalle souhaité (par défaut : 5 minutes)

Les fichiers seront automatiquement téléchargés dans votre dossier **Téléchargements**.

### Effectuer une sauvegarde manuelle

1. Cliquez sur le bouton **"💾 Sauvegarder"**
2. Le fichier Excel est immédiatement téléchargé
3. Une notification confirme la réussite

### Restaurer depuis un backup

#### Méthode 1 : Restauration automatique (base vide)
1. Si IndexedDB est vide, un dialogue s'affiche automatiquement
2. Cliquez sur **"Sélectionner un fichier de backup"**
3. Choisissez le fichier Excel le plus récent
4. Attendez la fin de l'import
5. Consultez le résumé et cliquez sur **"Continuer"**
6. La page se recharge avec vos données

#### Méthode 2 : Restauration manuelle
1. Cliquez sur le bouton **"📂 Restaurer"**
2. Sélectionnez le fichier Excel de backup
3. Attendez la fin de l'import
4. Consultez le résumé

## 📁 Structure des fichiers de backup

Chaque fichier Excel contient 5 feuilles :

### 1. **Households** (Ménages)
- Toutes les données des ménages
- Coordonnées GPS, informations du chef de ménage
- Statut, zone, dates

### 2. **Projects** (Projets)
- Configuration des projets
- Paramètres, dates, zones

### 3. **Zones**
- Définition des zones géographiques
- Limites, populations

### 4. **Teams** (Équipes)
- Configuration des équipes
- Affectations, productivité

### 5. **Metadata** (Métadonnées)
- Date de sauvegarde
- Version de l'application
- Nombre total d'enregistrements
- Type de backup (auto/manuel)

## ⚙️ Configuration

### Paramètres disponibles

| Paramètre | Valeurs | Description |
|-----------|---------|-------------|
| **Auto-backup** | ON/OFF | Active/désactive la sauvegarde automatique |
| **Intervalle** | 5, 10, 15, 30, 60 min | Fréquence des sauvegardes automatiques |

### Stockage de la configuration

La configuration est sauvegardée dans `localStorage` :
```javascript
{
    autoBackupEnabled: true/false,
    backupInterval: 5, // minutes
    lastBackupDate: "2025-11-28T02:30:00Z",
    backupHistory: [...]
}
```

## 🔧 Utilisation programmatique

### Effectuer un backup manuel
```javascript
await window.backupService.performBackup(false);
```

### Restaurer depuis un fichier
```javascript
const file = /* File object */;
await window.restoreService.restoreFromFile(file);
```

### Activer/désactiver auto-backup
```javascript
window.backupService.setAutoBackupEnabled(true);
```

### Changer l'intervalle
```javascript
window.backupService.setBackupInterval(10); // 10 minutes
```

## 📊 Événements

Le système émet des événements via `EventBus` :

### backup.completed
```javascript
window.eventBus.on('backup.completed', (data) => {
    console.log('Backup réussi:', data.filename);
    console.log('Nombre de ménages:', data.recordCount);
    console.log('Auto backup:', data.isAuto);
});
```

### backup.failed
```javascript
window.eventBus.on('backup.failed', (data) => {
    console.error('Backup échoué:', data.error);
});
```

### restore.completed
```javascript
window.eventBus.on('restore.completed', (stats) => {
    console.log('Restauration réussie:', stats);
});
```

## ⚠️ Limitations et Considérations

### Limitations du navigateur
- ❌ **Pas d'écriture directe** : Les navigateurs ne peuvent pas écrire automatiquement dans un dossier spécifique
- ✅ **Téléchargements multiples** : Chaque sauvegarde crée un nouveau fichier
- 📁 **Dossier Téléchargements** : Les fichiers sont sauvegardés dans le dossier par défaut du navigateur

### Bonnes pratiques
1. **Créer un dossier dédié** : Créez un dossier "Backups" dans vos Documents
2. **Déplacer régulièrement** : Déplacez les backups du dossier Téléchargements vers votre dossier dédié
3. **Conserver plusieurs versions** : Gardez au moins les 10 derniers backups
4. **Tester la restauration** : Testez périodiquement la restauration pour vérifier l'intégrité

### Performance
- Les backups de grandes bases de données (>10 000 ménages) peuvent prendre quelques secondes
- L'auto-backup n'impacte pas les performances de l'application
- Les téléchargements sont effectués en arrière-plan

## 🐛 Dépannage

### Le backup ne se télécharge pas
- Vérifiez que les pop-ups ne sont pas bloquées
- Autorisez les téléchargements multiples dans les paramètres du navigateur
- Vérifiez l'espace disque disponible

### Erreur lors de la restauration
- Assurez-vous que le fichier est bien un backup valide
- Vérifiez que le fichier n'est pas corrompu
- Consultez la console du navigateur (F12) pour les détails de l'erreur

### Les données ne sont pas restaurées
- Vérifiez que le fichier contient bien la feuille "Households"
- Assurez-vous que la structure du fichier est correcte
- Rechargez la page après la restauration

### Auto-backup ne fonctionne pas
- Vérifiez que le toggle est bien activé
- Consultez la console pour les messages d'erreur
- Vérifiez que l'intervalle est correctement configuré

## 📞 Support

Pour toute question ou problème :
1. Consultez la console du navigateur (F12)
2. Vérifiez les messages d'erreur
3. Consultez l'historique des backups
4. Testez avec un backup manuel

## 🔄 Mises à jour futures

Fonctionnalités prévues :
- Export vers d'autres formats (JSON, CSV)
- Compression des fichiers de backup
- Synchronisation cloud (Google Drive, Dropbox)
- Backup différentiel (seulement les changements)
- Planification avancée (jours/heures spécifiques)
