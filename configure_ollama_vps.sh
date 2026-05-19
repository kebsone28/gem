#!/bin/bash
set -e

echo "🚀 Configuration Ollama sur VPS proquelec.sn"
echo "=============================================="

# 1. Vérifier si Ollama est installé
echo "📋 Vérification d'Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama n'est pas installé. Installation..."
    curl -fsSL https://ollama.ai/install.sh | sh
else
    echo "✅ Ollama est déjà installé"
fi

# 2. Vérifier le statut du service Ollama
echo ""
echo "📊 Statut du service Ollama..."
if sudo systemctl is-active --quiet ollama; then
    echo "✅ Service Ollama est actif"
else
    echo "⚠️  Service Ollama n'est pas actif - Démarrage..."
    sudo systemctl start ollama
fi

# 3. Modifier la configuration Ollama pour écouter sur 0.0.0.0
echo ""
echo "🔧 Configuration de la liaison externe..."
OLLAMA_SERVICE="/etc/systemd/system/ollama.service"

if [ -f "$OLLAMA_SERVICE" ]; then
    echo "Fichier trouvé: $OLLAMA_SERVICE"

    # Vérifier si OLLAMA_HOST est déjà configuré
    if grep -q "OLLAMA_HOST" "$OLLAMA_SERVICE"; then
        echo "✅ OLLAMA_HOST est déjà configuré"
        grep "OLLAMA_HOST" "$OLLAMA_SERVICE" || true
    else
        echo "Ajout de OLLAMA_HOST=0.0.0.0:11434..."
        # Créer une sauvegarde
        sudo cp "$OLLAMA_SERVICE" "${OLLAMA_SERVICE}.backup"

        # Modifier le fichier pour ajouter OLLAMA_HOST
        sudo sed -i '/\[Service\]/a Environment="OLLAMA_HOST=0.0.0.0:11434"' "$OLLAMA_SERVICE"

        echo "✅ Configuration mise à jour"
        echo "Sauvegarde créée: ${OLLAMA_SERVICE}.backup"
    fi
else
    echo "⚠️  Fichier de service non trouvé: $OLLAMA_SERVICE"
fi

# 4. Recharger et redémarrer Ollama
echo ""
echo "🔄 Redémarrage du service Ollama..."
sudo systemctl daemon-reload
sudo systemctl restart ollama

# Attendre que le service démarre
sleep 3

if sudo systemctl is-active --quiet ollama; then
    echo "✅ Service Ollama redémarré avec succès"
else
    echo "❌ Erreur: Service Ollama ne s'est pas démarré"
    sudo journalctl -u ollama -n 20 --no-paging
    exit 1
fi

# 5. Vérifier la liaison du port
echo ""
echo "🔍 Vérification du port 11434..."
if netstat -tln 2>/dev/null | grep -q ":11434" || ss -tln 2>/dev/null | grep -q ":11434"; then
    echo "✅ Port 11434 est ouvert et écoutant"
    ss -tln 2>/dev/null | grep ":11434" || netstat -tln 2>/dev/null | grep ":11434" || echo "Port détecté"
else
    echo "⚠️  Port 11434 n'est pas détecté (vérification du service...)"
fi

# 6. Configurer le firewall
echo ""
echo "🛡️  Configuration du firewall..."
if command -v ufw &> /dev/null; then
    echo "UFW détecté"
    if sudo ufw status | grep -q "11434"; then
        echo "✅ Règle firewall pour port 11434 existe déjà"
    else
        echo "Ajout de la règle UFW pour port 11434..."
        sudo ufw allow 11434/tcp
        echo "✅ Règle firewall ajoutée"
    fi
elif command -v firewall-cmd &> /dev/null; then
    echo "firewall-cmd détecté"
    sudo firewall-cmd --permanent --add-port=11434/tcp
    sudo firewall-cmd --reload
    echo "✅ Règle firewall ajoutée"
else
    echo "⚠️  Aucun gestionnaire de firewall détecté"
fi

# 7. Tester l'endpoint Ollama localement
echo ""
echo "🧪 Test de l'endpoint Ollama..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Endpoint Ollama répond correctement"
    echo "📦 Modèles disponibles:"
    curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o '"name":"[^"]*"' | sed 's/"name":"/  - /' | sed 's/"$//' || echo "  (Modèles énumérés)"
else
    echo "⚠️  Endpoint Ollama ne répond pas encore (services en démarrage...)"
fi

echo ""
echo "======================================"
echo "✅ Configuration Ollama terminée!"
echo "======================================"
