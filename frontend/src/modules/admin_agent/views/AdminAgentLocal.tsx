import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardList,
  Code2,
  ExternalLink,
  KeyRound,
  Network,
  PlayCircle,
  ServerCog,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import { PageContainer, PageHeader, Section, ContentArea, COMMON_CLASSES } from '../../../components';

const stackItems = [
  {
    title: 'Interface agent',
    value: 'OpenHands',
    detail: 'Agent open source principal pour lire le repo, modifier les fichiers, lancer des commandes et tester GED OS.',
  },
  {
    title: 'Endpoint local',
    value: 'http://localhost:11434',
    detail: 'Port local exposé par le tunnel SSH. Ne pas appeler directement le VPS depuis les outils locaux.',
  },
  {
    title: 'Endpoint Docker',
    value: 'http://host.docker.internal:11434/v1',
    detail: 'URL utilisée par OpenHands depuis son conteneur Docker pour atteindre Ollama via le tunnel.',
  },
  {
    title: 'Modèle actif',
    value: 'qwen2.5-coder:7b',
    detail: 'Modèle de code hébergé sur le VPS. Contexte configuré à 32768 tokens et keep-alive permanent.',
  },
];

const validationItems = [
  'OpenHands répond sur http://localhost:3000.',
  'Le tunnel SSH écoute localement sur 127.0.0.1:11434.',
  "L'API Ollama /v1/models expose qwen2.5-coder:7b.",
  "Le modèle répond READY sur une génération de test.",
  'ollama ps côté VPS affiche CONTEXT 32768 et UNTIL Forever.',
];

const operatingRules = [
  "Donner à l'agent des tâches courtes, vérifiables et liées à GED OS.",
  "Demander explicitement les tests attendus après chaque modification.",
  "Relire les changements avant déploiement, surtout pour les migrations, sécurité, permissions et données Kobo.",
  "Ne jamais coller de mots de passe, tokens ou clés API dans les prompts de l'agent.",
  "Limiter l'auto-approbation aux tâches non destructives et garder un humain dans la boucle pour production.",
];

function CommandBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-xs font-semibold leading-relaxed text-cyan-100 shadow-inner">
      <code>{children}</code>
    </pre>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${COMMON_CLASSES.card} p-5`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <Icon size={18} />
        </div>
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">{title}</h3>
      </div>
      <div className="text-sm leading-relaxed text-slate-300">{children}</div>
    </div>
  );
}

export default function AdminAgentLocal() {
  return (
    <PageContainer className="min-h-screen bg-slate-950 py-4 sm:py-8">
      <PageHeader
        variant="gradient"
        accent="formation"
        title="Agent Local GED OS"
        subtitle="Guide administrateur pour OpenHands, Claude Code, Ollama VPS et le tunnel SSH sécurisé."
        icon={<ServerCog size={24} className="text-blue-400" />}
      />

      <Section title="Architecture active">
        <ContentArea>
          <div className="grid gap-4 lg:grid-cols-4">
            {stackItems.map((item) => (
              <div key={item.title} className={`${COMMON_CLASSES.card} p-5`}>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {item.title}
                </p>
                <p className="mt-2 break-words text-lg font-black text-white">{item.value}</p>
                <p className="mt-3 text-xs leading-relaxed text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
        </ContentArea>
      </Section>

      <Section title="Chemin de communication">
        <ContentArea>
          <InfoPanel icon={Network} title="Flux réseau">
            <div className="grid gap-3 text-xs font-semibold text-slate-200 md:grid-cols-5">
              {['OpenHands', 'Docker host', 'Tunnel SSH', 'VPS proquelec.sn', 'Ollama'].map((step) => (
                <div key={step} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-center">
                  {step}
                </div>
              ))}
            </div>
            <p className="mt-4">
              OpenHands ne contacte pas directement Internet pour le modèle. Il appelle
              <span className="font-bold text-cyan-300"> host.docker.internal:11434</span>, qui arrive sur le port local
              sécurisé par le tunnel SSH vers le VPS.
            </p>
          </InfoPanel>
        </ContentArea>
      </Section>

      <Section title="Commandes administrateur">
        <ContentArea>
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoPanel icon={PlayCircle} title="Démarrer l'agent">
              <CommandBlock>{'powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\start-ged-agent.ps1'}</CommandBlock>
              <p className="mt-3">
                Le script vérifie le tunnel Ollama, lance OpenHands si nécessaire, monte le repo GED OS dans
                <span className="font-bold text-cyan-300"> /workspace</span> et conserve la configuration LLM.
              </p>
            </InfoPanel>

            <InfoPanel icon={Terminal} title="Arrêter l'agent">
              <CommandBlock>{'powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\stop-ged-agent.ps1'}</CommandBlock>
              <p className="mt-3">
                Cette commande arrête seulement OpenHands. Pour couper aussi le tunnel SSH, ajouter
                <span className="font-bold text-cyan-300"> -StopTunnel</span>.
              </p>
            </InfoPanel>

            <InfoPanel icon={Code2} title="Claude Code">
              <CommandBlock>{'claude.cmd --version\nclaude.cmd'}</CommandBlock>
              <p className="mt-3">
                Sous PowerShell, utiliser <span className="font-bold text-cyan-300">claude.cmd</span> car
                <span className="font-bold text-cyan-300"> claude.ps1</span> peut être bloqué par l'ExecutionPolicy.
              </p>
            </InfoPanel>

            <InfoPanel icon={ClipboardList} title="Contrôles rapides">
              <CommandBlock>{'curl.exe http://localhost:11434/v1/models\ndocker ps --filter "name=openhands-app"\nssh -i "$env:USERPROFILE\\.ssh\\gem_vps" root@proquelec.sn "ollama ps"'}</CommandBlock>
            </InfoPanel>
          </div>
        </ContentArea>
      </Section>

      <Section title="Configuration persistante">
        <ContentArea>
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoPanel icon={Bot} title="OpenHands">
              <ul className="space-y-2">
                <li>Conteneur Docker : <span className="font-bold text-cyan-300">openhands-app</span></li>
                <li>Port UI : <span className="font-bold text-cyan-300">http://localhost:3000</span></li>
                <li>Workspace : <span className="font-bold text-cyan-300">C:\Mes-Sites-Web\GEM_SAAS</span></li>
                <li>Montage agent : <span className="font-bold text-cyan-300">/workspace</span></li>
                <li>Persistance : <span className="font-bold text-cyan-300">C:\Users\User\.openhands</span></li>
              </ul>
            </InfoPanel>

            <InfoPanel icon={ServerCog} title="Ollama VPS">
              <CommandBlock>{'OLLAMA_HOST=0.0.0.0\nOLLAMA_CONTEXT_LENGTH=32768\nOLLAMA_KEEP_ALIVE=-1'}</CommandBlock>
              <p className="mt-3">
                Ces variables sont stockées dans le drop-in systemd du service Ollama sur le VPS.
              </p>
            </InfoPanel>

            <InfoPanel icon={KeyRound} title="Claude Code settings">
              <CommandBlock>{'{\n  "env": {\n    "ANTHROPIC_BASE_URL": "http://localhost:11434/v1",\n    "ANTHROPIC_AUTH_TOKEN": "ollama",\n    "ANTHROPIC_API_KEY": "not-needed"\n  }\n}'}</CommandBlock>
              <p className="mt-3">
                Fichier local : <span className="font-bold text-cyan-300">C:\Users\User\.claude\settings.json</span>.
              </p>
            </InfoPanel>

            <InfoPanel icon={ShieldCheck} title="Validation réalisée">
              <ul className="space-y-2">
                {validationItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </InfoPanel>
          </div>
        </ContentArea>
      </Section>

      <Section title="Règles d'exploitation">
        <ContentArea>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <InfoPanel icon={ShieldCheck} title="Bon usage">
              <ul className="space-y-3">
                {operatingRules.map((rule) => (
                  <li key={rule} className="flex gap-3">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </InfoPanel>

            <InfoPanel icon={AlertTriangle} title="Limites et sécurité">
              <p>
                Le modèle <span className="font-bold text-cyan-300">qwen2.5-coder:7b</span> est utile pour le
                développement quotidien, mais il reste limité pour les refontes massives. Les actions destructives,
                déploiements, migrations et suppressions doivent rester validés par un administrateur.
              </p>
              <p className="mt-3">
                Le mot de passe root ne doit jamais être stocké dans GED OS ni partagé avec l'agent. La connexion
                opérationnelle utilise la clé SSH <span className="font-bold text-cyan-300">~/.ssh/gem_vps</span>.
              </p>
            </InfoPanel>
          </div>
        </ContentArea>
      </Section>

      <Section title="Liens utiles">
        <ContentArea>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['OpenHands', 'http://localhost:3000'],
              ['Ollama models', 'http://localhost:11434/v1/models'],
              ['Documentation interne', '/aide'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-black uppercase tracking-[0.14em] text-slate-200 transition hover:border-blue-400/40 hover:bg-blue-500/10"
              >
                {label}
                <ExternalLink size={16} className="text-blue-300" />
              </a>
            ))}
          </div>
        </ContentArea>
      </Section>
    </PageContainer>
  );
}
