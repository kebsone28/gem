import React, { useState, useMemo } from 'react';

interface HelpViewProps {
  role?: 'admin' | 'prestataire';
}

interface HelpSection {
  id: string;
  icon: string;
  title: string;
  adminOnly?: boolean;
  content: {
    description: string;
    steps: string[];
    tips: string[];
    shortcuts?: { keys: string; action: string }[];
  };
}

const ALL_SECTIONS: HelpSection[] = [
  {
    id: 'overview',
    icon: '🌍',
    title: 'Vue d\'ensemble',
    content: {
      description: 'Le module Carto Grappes est un outil de suivi et pilotage des opérations de raccordement électrique. Il permet de suivre l\'avancement par village, grappe et ménage.',
      steps: [
        'Connectez-vous avec vos identifiants fournis par le chef de projet.',
        'Vous arrivez sur le tableau de bord principal avec les KPIs.',
        'Utilisez les onglets en haut pour naviguer entre les différentes vues.',
        'La vue carte affiche tous les villages et l\'état d\'avancement.',
        'Le bordereau permet de saisir les statuts par ménage.',
        'Consultez les fiches pour le suivi qualité et production.',
      ],
      tips: [
        'Les données se synchronisent automatiquement en arrière-plan.',
        'En cas de perte de connexion, les saisies restent sauvegardées localement.',
        'Le code couleur permet d\'identifier rapidement l\'état : vert = fait, orange = en cours, rouge = bloqué.',
      ],
    },
  },
  {
    id: 'carto',
    icon: '🗺️',
    title: 'Cartographie',
    content: {
      description: 'La carte interactive affiche les villages et ménages avec leur état d\'avancement. Cliquez sur un marqueur pour voir les détails.',
      steps: [
        'Filtrez par région, village, lot ou statut dans la barre supérieure.',
        'Cliquez sur un village groupé (cercle) pour zoomer et voir les ménages individuels.',
        'Cliquez sur un marqueur individuel pour voir les détails du ménage.',
        'Utilisez les boutons popup : "Saisie" pour ouvrir le formulaire terrain, "Photo" pour la caméra.',
        '"Voir ménages" centre la carte sur les ménages du village sélectionné.',
        '"Affecter" permet de réaffecter un ménage à une autre grappe.',
        'Le bouton "Région" en haut permet de filtrer géographiquement.',
      ],
      tips: [
        'Les cercles agrégés changent de taille selon le nombre de ménages.',
        'Un point rouge indique un ménage bloqué, orange = en cours, vert = fait.',
        'Le compteur en bas à droite indique le nombre de marqueurs visibles.',
        'La carte est basée sur OpenStreetMap et fonctionne hors-ligne si les tuiles sont en cache.',
      ],
      shortcuts: [
        { keys: 'Molette souris', action: 'Zoomer / Dézoomer' },
        { keys: 'Clic gauche + glisser', action: 'Déplacer la carte' },
        { keys: 'Double clic', action: 'Zoomer rapidement' },
        { keys: 'Échap', action: 'Fermer un popup ouvert' },
      ],
    },
  },
  {
    id: 'bordereau',
    icon: '📋',
    title: 'Bordereau',
    content: {
      description: 'Le bordereau est la vue principale de saisie. Il liste tous les ménages et permet de mettre à jour les statuts pour chaque lot (A, B, C).',
      steps: [
        'Sélectionnez le lot concerné (A : Pré-câblage, B : Installation, C : Raccordement).',
        'Filtrez par village, grappe ou statut pour cibler les ménages à traiter.',
        'Pour chaque ménage, sélectionnez le nouveau statut dans le menu déroulant.',
        'Si le statut nécessite une justification (bloqué, non conforme), un champ texte apparaît.',
        'Le statut "Fait" marque la tâche comme complétée pour ce ménage/lot.',
        'Le statut "Conforme" coché valide la qualité de l\'intervention.',
        'Les modifications sont sauvegardées automatiquement.',
      ],
      tips: [
        'Utilisez le filtre "En cours" pour retrouver rapidement les ménages à traiter.',
        'Les ménages avec un statut "Bloqué" nécessitent une justification détaillée.',
        'Le bordereau peut être exporté en CSV depuis l\'onglet Export.',
        'Les statuts bloqués sont automatiquement remontés dans les alertes.',
      ],
    },
  },
  {
    id: 'fiches',
    icon: '📄',
    title: 'Fiches',
    content: {
      description: 'Les fiches de suivi documentent les opérations terrain : production, installation, contrôle qualité et réception.',
      steps: [
        'Accédez à l\'onglet Fiches depuis la barre de navigation.',
        'Choisissez le niveau de fiche : Niveau 1 (production), Niveau 2 (activité), Niveau 3 (qualité/réception).',
        'Cliquez sur "Nouvelle fiche" pour créer un formulaire vierge.',
        'Remplissez les champs obligatoires : région, grappe, date, puis les données spécifiques.',
        'Les champs grisés sont calculés automatiquement.',
        'Sauvegardez la fiche — elle est immédiatement accessible aux autres utilisateurs.',
        'Consultez l\'historique des fiches depuis l\'onglet Historique.',
      ],
      tips: [
        'Une fiche par jour par équipe est requise pour les niveaux 1 et 2.',
        'Les fiches de niveau 3 (PV de réception) nécessitent les signatures du chef de projet et du contrôleur.',
        'La situation mensuelle de facturation (F12) est calculée automatiquement à partir des données validées.',
        'Les fiches incomplètes sont signalées en jaune dans la liste.',
      ],
    },
  },
  {
    id: 'planning',
    icon: '📅',
    title: 'Planning',
    content: {
      description: 'Le module planning calcule et affiche le planning prévisionnel des travaux par région et phase.',
      steps: [
        'Accédez à l\'onglet Planning dans la navigation.',
        'Configurez les paramètres : date de début, durée objectif, effectifs par phase.',
        'Le diagramme de Gantt s\'affiche automatiquement avec les phases colorées.',
        'Ajustez les effectifs par région (Kaffrine, Tambacounda) dans les champs de paramétrage.',
        'Les jours fériés et événements religieux (Magal, Gamou, etc.) sont pris en compte.',
        'Les alertes de planning s\'affichent en haut si des retards sont détectés.',
        'Exportez le planning en PDF ou CSV depuis l\'onglet Export.',
      ],
      tips: [
        'Les paramètres influencent directement la date de fin — jouez avec les effectifs pour optimiser.',
        'Le mode "parallèle" traite les régions simultanément, le mode "séquentiel" les enchaîne.',
        'La saison des pluies réduit automatiquement la productivité de 50% pendant la période configurée.',
        'Les sessions de formation sont planifiées automatiquement au démarrage de chaque région.',
      ],
    },
  },
  {
    id: 'admin',
    icon: '⚙️',
    title: 'Administration',
    content: {
      description: 'L\'administration permet de configurer les modes d\'affectation des entrepreneurs, de gérer les utilisateurs et d\'organiser la structure des grappes.',
      steps: [
        'Accédez à l\'onglet Administration (réservé aux admin et chefs de projet).',
        'Configurez le mode d\'affectation par lot : Individuel, Global ou Groupe.',
        'En mode Individuel, assignez un entrepreneur par grappe.',
        'En mode Global, un seul entrepreneur couvre tout le lot.',
        'En mode Groupe, créez des groupes de grappes avec un entrepreneur chacun.',
        'Gérez les lots : utilisez "+ Gérer les lots" pour ajouter/supprimer des lots dynamiquement.',
        'Créez des grappes manuellement : "+ Créer une grappe" pour étendre le nombre de grappes par région.',
        'Utilisez le clustering GPS pour créer automatiquement des grappes par proximité géographique.',
        'Cliquez sur "Modifier" pour saisir les informations de l\'entrepreneur.',
        'Cliquez sur "Sauvegarder sur le serveur" pour persister la configuration.',
        'La section "Gestion des utilisateurs" affiche les comptes actifs et leurs permissions.',
      ],
      tips: [
        'La configuration des entrepreneurs est visible dans les fiches de suivi (champ "Prestataire").',
        'Les groupes permettent de mutualiser les entrepreneurs sur plusieurs grappes.',
        'Les régions et leurs grappes sont détectées automatiquement depuis les données des ménages.',
        'Le clustering GPS utilise les coordonnées GPS réelles des ménages pour créer des grappes optimisées.',
        'Les toggles modules dans la section utilisateurs sont indicatifs — l\'édition se fait dans l\'app principale.',
      ],
    },
  },
  {
    id: 'clustering',
    icon: '📍',
    title: 'Clustering GPS',
    adminOnly: true,
    content: {
      description: 'Le clustering GPS permet de créer automatiquement des grappes basées sur la proximité géographique des ménages. Cette fonctionnalité utilise les coordonnées GPS pour optimiser l\'organisation des grappes.',
      steps: [
        'Accédez à l\'onglet Administration et cliquez sur "📍 Clustering GPS".',
        'Sélectionnez l\'algorithme de clustering : K-Means, Hiérarchique ou DBSCAN.',
        'Configurez la distance maximale (en km) pour regrouper les ménages.',
        'Définissez le nombre de grappes cible (pour K-Means) ou les tailles min/max par grappe.',
        'Sélectionnez la région à traiter.',
        'Option 1 : Cliquez sur "🔮 Générer les clusters" pour créer les grappes avec vos paramètres actuels.',
        'Option 2 : Cliquez sur "🧠 Optimiser automatiquement" pour laisser l\'IA tester plusieurs configurations.',
        'Consultez les résultats optimisés : chaque configuration affiche son score et métriques détaillées.',
        'Sélectionnez la configuration qui vous convient dans la liste des options optimisées.',
        'Consultez les détails des grappes : centre GPS, nombre de ménages, villages et distances.',
        'Vérifiez la matrice des distances entre grappes pour valider la répartition géographique.',
        'Cliquez sur "✅ Appliquer la configuration" pour valider et sauvegarder.',
        'Pour de nouvelles grappes, utilisez "💡 Suggérer des ménages" pour obtenir les ménages les plus proches.',
      ],
      tips: [
        'K-Means est idéal quand vous connaissez le nombre exact de grappes souhaitées.',
        'L\'algorithme hiérarchique respecte la distance max et ne fusionne que les grappes suffisamment proches.',
        'DBSCAN (par densité) est adapté aux zones avec des densités de population variables.',
        'Distance max recommandée : 5-10 km pour zones rurales, 1-3 km pour zones urbaines.',
        'La matrice de distances permet d\'identifier les grappes trop isolées (distance > 15km).',
        'Utilisez "Optimiser automatiquement" pour laisser l\'IA tester 72+ configurations différentes.',
        'Le score d\'optimisation prend en compte : équilibre des tailles, dispersion géographique, isolation et ratio villages/ménages.',
        'Utilisez "Suggérer des ménages" pour étendre une grappe avec les ménages non assignés les plus proches.',
        'Les coordonnées GPS des ménages sont utilisées en priorité, avec fallback sur les positions des villages.',
      ],
      shortcuts: [
        { keys: 'Distance max', action: 'Rayon de regroupement en kilomètres' },
        { keys: 'K-Means', action: 'Force le nombre de grappes demandé' },
        { keys: 'Hiérarchique', action: 'Fusionne si distance ≤ max' },
        { keys: 'DBSCAN', action: 'Crée des clusters par densité' },
        { keys: 'Optimiser auto', action: 'Teste 72+ configurations' },
      ],
    },
  },
  {
    id: 'export',
    icon: '📤',
    title: 'Export',
    content: {
      description: 'Exportez les données du projet sous différents formats pour reporting et analyse.',
      steps: [
        'Accédez à l\'onglet Export depuis la navigation.',
        'Choisissez le type de données : bordereau, fiches, planning, alertes.',
        'Sélectionnez le format : CSV, Excel (XLSX) ou PDF.',
        'Appliquez les filtres souhaités (région, lot, période) avant l\'export.',
        'Cliquez sur "Exporter" — le téléchargement démarre automatiquement.',
        'Les exports sont horodatés et incluent le nom de l\'utilisateur.',
      ],
      tips: [
        'Le format CSV est idéal pour l\'analyse dans Excel ou Google Sheets.',
        'Le PDF inclut un en-tête avec les logos et métadonnées du projet.',
        'Les exports planning incluent le diagramme de Gantt en image.',
        'Vous pouvez planifier des exports automatiques quotidiens depuis les Paramètres.',
      ],
      shortcuts: [
        { keys: 'Ctrl + E', action: 'Ouvrir la page Export' },
        { keys: 'Ctrl + P', action: 'Exporter en PDF (raccourci global)' },
      ],
    },
  },
  {
    id: 'settings',
    icon: '🔧',
    title: 'Paramètres',
    content: {
      description: 'Configurez les préférences personnelles et les paramètres globaux de l\'application.',
      steps: [
        'Accédez à l\'onglet Paramètres depuis la navigation.',
        'Configurez votre profil : nom, email, langue préférée.',
        'Activez ou désactivez les notifications par email.',
        'Configurez la synchronisation automatique (intervalle en minutes).',
        'Pour les admin : paramètres globaux du projet, URLs API, clés de sécurité.',
        'Gardez les paramètres par défaut sauf instruction spécifique du chef de projet.',
      ],
      tips: [
        'La fréquence de synchronisation affecte la fraîcheur des données en temps réel.',
        'Désactivez les notifications email si vous utilisez uniquement l\'interface web.',
        'Les paramètres sont sauvegardés par utilisateur dans le stockage local.',
      ],
    },
  },
];

const AdminViewComponent: React.FC<HelpViewProps> = ({ role = 'admin' }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const sections = useMemo(() => {
    const base = role === 'admin' ? ALL_SECTIONS : ALL_SECTIONS.filter(s => !s.adminOnly);
    if (!searchQuery) return base;
    const q = searchQuery.toLowerCase();
    return base.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.content.description.toLowerCase().includes(q) ||
      s.content.steps.some(st => st.toLowerCase().includes(q)) ||
      s.content.tips.some(t => t.toLowerCase().includes(q))
    );
  }, [role, searchQuery]);

  const active = ALL_SECTIONS.find(s => s.id === activeSection) || ALL_SECTIONS[0];

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-800 mb-2">📖 Aide & Formation</h2>
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-xs text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {role === 'admin' ? 'Admin' : 'Prestataire'}
            </span>
            <span className="text-[10px] text-slate-400">{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-all text-left ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 font-medium'
              }`}
            >
              <span className="text-sm">{section.icon}</span>
              <span>{section.title}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="text-[10px] text-slate-400 text-center">
            Version du module<br />
            <span className="font-semibold">Carto Grappes v2.0</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{active.icon}</span>
            <div>
              <h1 className="text-lg font-bold text-slate-800">{active.title}</h1>
              <p className="text-xs text-slate-500 mt-0.5">{active.content.description}</p>
            </div>
          </div>

          {/* Steps */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px]">①</span>
              Instructions pas à pas
            </h3>
            <ol className="space-y-2">
              {active.content.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-xs text-slate-600">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Tips */}
          <div className="mb-8">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px]">💡</span>
              Astuces & Bonnes pratiques
            </h3>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              {active.content.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-amber-800">
                  <span className="text-amber-400 mt-0.5">•</span>
                  <span className="leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Shortcuts */}
          {active.content.shortcuts && active.content.shortcuts.length > 0 && (
            <div className="mb-8">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-5 h-5 bg-slate-700 text-white rounded-full flex items-center justify-center text-[10px]">⌨</span>
                Raccourcis clavier
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <table className="w-full text-xs">
                  <tbody>
                    {active.content.shortcuts.map((sc, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4">
                          <code className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold text-slate-700 shadow-sm">
                            {sc.keys}
                          </code>
                        </td>
                        <td className="py-2 text-slate-500">{sc.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-slate-200">
            {(() => {
              const currentIdx = sections.findIndex(s => s.id === active.id);
              const prev = currentIdx > 0 ? sections[currentIdx - 1] : null;
              const next = currentIdx < sections.length - 1 ? sections[currentIdx + 1] : null;
              return (
                <>
                  {prev ? (
                    <button
                      onClick={() => setActiveSection(prev.id)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                      ← {prev.icon} {prev.title}
                    </button>
                  ) : <div />}
                  {next ? (
                    <button
                      onClick={() => setActiveSection(next.id)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {next.icon} {next.title} →
                    </button>
                  ) : <div />}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

AdminViewComponent.displayName = 'HelpView';
export default AdminViewComponent;
