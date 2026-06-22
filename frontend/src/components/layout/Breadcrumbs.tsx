import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useProject } from '@contexts/ProjectContext';
import { getAllModules } from '@core/kernel/registry';
import { CATEGORY_METADATA } from '@core/navigation';

export function matchRoutePattern(pattern: string, pathname: string): boolean {
  const regexSource = '^' + pattern.replace(/:[^\s/]+/g, '[^/]+') + '$';
  const regex = new RegExp(regexSource);
  return regex.test(pathname);
}

export function Breadcrumbs() {
  const location = useLocation();
  const { project } = useProject();
  const pathname = location.pathname;

  // Trouver le module correspondant au chemin actuel
  const matchedModule = getAllModules().find((m) => matchRoutePattern(m.route, pathname));

  const breadcrumbItems = [];

  // 1. Accueil (toujours présent)
  breadcrumbItems.push({
    label: 'Accueil',
    to: '/projects',
    icon: Home
  });

  // 2. Projet Actif (si sélectionné)
  if (project) {
    breadcrumbItems.push({
      label: project.name,
      to: `/projects?project=${project.id}`
    });
  }

  // 3. Catégorie et Module (si trouvés)
  if (matchedModule && matchedModule.key !== 'home') {
    const catMeta = matchedModule.category !== 'UTILITAIRE' ? CATEGORY_METADATA[matchedModule.category] : null;
    
    if (catMeta) {
      breadcrumbItems.push({
        label: catMeta.label,
        to: null // Visual only
      });
    }

    breadcrumbItems.push({
      label: matchedModule.name,
      to: matchedModule.route
    });
  }

  // Si on est sur une route qui n'est pas un module direct, on fallback sur le parsing des segments
  if (breadcrumbItems.length === 1 && pathname !== '/projects' && pathname !== '/') {
    const segments = pathname.split('/').filter(Boolean);
    segments.forEach((seg, index) => {
      const to = '/' + segments.slice(0, index + 1).join('/');
      // Capitalize first letter
      const label = seg.charAt(0).toUpperCase() + seg.slice(1);
      breadcrumbItems.push({
        label,
        to: index === segments.length - 1 ? null : to
      });
    });
  }

  return (
    <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;
        const Icon = item.icon;

        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            )}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="flex items-center gap-1.5 hover:text-blue-300 transition-colors text-slate-400"
              >
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span className={`flex items-center gap-1.5 ${isLast ? 'text-white font-bold' : 'text-slate-500'}`}>
                {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}
                <span>{item.label}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
