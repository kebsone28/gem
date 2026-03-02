/**
 * GrappeAssignmentView - Responsible for DOM generation and XSS protection.
 */
class GrappeAssignmentView {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.TEAM_TYPES = null; // Set by controller
    }

    setTeamTypes(types) {
        this.TEAM_TYPES = types;
    }

    /**
     * escape - Basic XSS protection.
     */
    escape(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * render - High-performance batch rendering using DocumentFragment.
     */
    render(items, getAssignmentsFn, computeCompletenessFn, onCardClickFn) {
        if (!this.container) return;

        const fragment = document.createDocumentFragment();

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'col-span-full py-20 text-center';
            empty.innerHTML = `
                <div class="text-gray-300 mb-4"><i class="fas fa-search fa-4x"></i></div>
                <p class="text-gray-500 font-medium">Aucune zone ne correspond à votre stratégie actuelle.</p>
            `;
            fragment.appendChild(empty);
        } else {
            items.forEach(sg => {
                const asgn = getAssignmentsFn(sg.id);
                const score = computeCompletenessFn(asgn);
                const card = this.createCardElement(sg, asgn, score, onCardClickFn);
                fragment.appendChild(card);
            });
        }

        this.container.innerHTML = '';
        this.container.appendChild(fragment);
    }

    /**
     * createCardElement - Generates a secure card element with premium design.
     */
    createCardElement(sg, asgn, score, onClick) {
        const div = document.createElement('div');
        div.className = 'glass-card relative rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl transition-all duration-500 group cursor-pointer';

        div.addEventListener('click', () => onClick(sg, asgn));

        const isComplete = score === 100;
        const scoreColorClass = isComplete ? 'high' : '';
        const progressColorClass = isComplete ? 'success' : (score > 50 ? '' : 'warning');

        div.innerHTML = `
            <div class="card-gradient-top"></div>
            <div class="p-6">
                <!-- Header -->
                <div class="flex justify-between items-start mb-6">
                    <div class="flex-1 pr-2">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="px-2 py-0.5 bg-indigo-600 text-white rounded text-[9px] font-black uppercase tracking-widest">${this.escape(sg.id)}</span>
                            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                                <i class="fas fa-map-marker-alt mr-1 text-slate-300"></i>${this.escape(sg.region)}
                            </span>
                        </div>
                        <h3 class="font-black text-slate-800 uppercase tracking-tighter text-xl leading-tight group-hover:text-indigo-600 transition-colors drop-shadow-sm">
                            ${this.escape(sg.nom)}
                        </h3>
                    </div>
                    <div class="flex flex-col items-end">
                        <div class="text-3xl font-black text-dynamic-score ${scoreColorClass}">${score}%</div>
                        <div class="text-[9px] font-black uppercase tracking-widest text-slate-400 -mt-1">Couverture</div>
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="mb-6">
                    <div class="progress-container">
                        <div class="progress-fill ${progressColorClass}" style="width: ${score}%"></div>
                    </div>
                </div>

                <!-- Trade Grid -->
                <div class="grid grid-cols-2 gap-4">
                    ${this._renderTradeSummary(asgn)}
                </div>

                <!-- Footer -->
                <div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-inner">
                            <i class="fas fa-users-cog text-xs"></i>
                        </div>
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Gestion Industrielle</span>
                    </div>
                    <div class="text-[11px] font-black uppercase tracking-widest text-indigo-600 group-hover:translate-x-1.5 transition-transform flex items-center gap-1">
                        Détails <i class="fas fa-arrow-right text-[10px]"></i>
                    </div>
                </div>
            </div>
        `;
        return div;
    }

    _renderTradeSummary(asgn) {
        if (!this.TEAM_TYPES) return '';

        const tradeMap = [
            { key: this.TEAM_TYPES.MACONS, label: 'Maçons', icon: 'fa-trowel-bricks' },
            { key: this.TEAM_TYPES.RESEAU, label: 'Réseau', icon: 'fa-network-wired' },
            { key: this.TEAM_TYPES.INTERIEUR_TYPE1, label: 'Intérieur', icon: 'fa-lightbulb' },
            { key: this.TEAM_TYPES.CONTROLE, label: 'Contrôle', icon: 'fa-clipboard-check' }
        ];

        return tradeMap.filter(item => item.key).map(item => {
            const teams = asgn[item.key] || [];
            const isDone = teams.length > 0;
            return `
                <div class="flex flex-col gap-1.5">
                    <div class="flex items-center gap-2">
                        <div class="trade-icon-box ${isDone ? 'active' : 'inactive'}">
                            <i class="fas ${item.icon}"></i>
                        </div>
                        <span class="text-[10px] font-extrabold uppercase tracking-tight ${isDone ? 'text-slate-700' : 'text-slate-300'}">${item.label}</span>
                    </div>
                    <div class="pl-9 -mt-1">
                         <span class="text-[10px] font-bold truncate block ${isDone ? 'text-slate-500' : 'text-slate-200 italic'}">
                            ${isDone ? (teams.length > 1 ? `${teams.length} équipes` : this.escape(teams[0].name || teams[0])) : 'Non affecté'}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }
}

export default GrappeAssignmentView;
