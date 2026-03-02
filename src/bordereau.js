(() => {
    const waitForDb = () => new Promise((resolve) => {
        const t = setInterval(() => {
            if (window.db && (window.householdRepository || window.HouseholdRepository) && (window.teamRepository || window.TeamRepository)) {
                clearInterval(t);
                resolve();
            }
        }, 30);
    });

    const getHouseholds = async () => {
        if (window.HouseholdRepository?.getAll) return await window.HouseholdRepository.getAll();
        return await window.householdRepository.getAll();
    };

    const getTeams = async () => {
        if (window.TeamRepository?.getAll) return await window.TeamRepository.getAll();
        return await window.teamRepository.getAll();
    };

    function colorForType(type) {
        const palette = {
            'Préparateur': '#eef2ff',
            'Livreur': '#ecfeff',
            'Maçon': '#fff7ed',
            'Réseau': '#f0fdf4',
            'Intérieur': '#fef2f2',
            'Contrôleur': '#f5f3ff',
            'Superviseur': '#e0f2fe'
        };
        return palette[type] || '#f8fafc';
    }

    function colorForStatus(status) {
        const s = (status || '').toLowerCase();
        if (s.includes('conforme')) return '#ecfdf3';
        if (s.includes('en cours') || s.includes('progress')) return '#fffbeb';
        if (s.includes('non') || s.includes('retard')) return '#fef2f2';
        return '#f8fafc';
    }

    function colorForType(type) {
        const palette = {
            'Préparateur': '#eef2ff',
            'Livreur': '#ecfeff',
            'Maçon': '#fff7ed',
            'Réseau': '#f0fdf4',
            'Intérieur': '#fef2f2',
            'Contrôleur': '#f5f3ff',
            'Superviseur': '#e0f2fe'
        };
        return palette[type] || '#f8fafc';
    }

    function loadTeamMeta(id) {
        try {
            return JSON.parse(localStorage.getItem(`team_meta_${id}`)) || {};
        } catch {
            return {};
        }
    }

    function saveTeamMeta(id, meta) {
        localStorage.setItem(`team_meta_${id}`, JSON.stringify(meta));
    }

    function groupByVillage(items) {
        const map = new Map();
        items.forEach(h => {
            const loc = h.location || {};
            const village = (loc.village || loc.commune || 'Non renseigné').trim();
            if (!map.has(village)) map.set(village, []);
            map.get(village).push(h);
        });
        return map;
    }

    function renderStats(all, grouped, currentVillage) {
        document.getElementById('statTotal').textContent = all.length.toLocaleString();
        document.getElementById('statVillages').textContent = grouped.size;
        document.getElementById('statVillageCount').textContent = currentVillage ? currentVillage.length.toLocaleString() : '-';
        const badge = document.getElementById('selectedBadge');
        if (currentVillage) {
            badge.classList.remove('hidden');
            badge.textContent = `${currentVillage.length} ménages`;
        } else {
            badge.classList.add('hidden');
        }
    }

    function renderSelect(grouped) {
        const select = document.getElementById('villageSelect');
        select.innerHTML = '<option value=\"\">Tous les villages</option>';
        [...grouped.keys()].sort().forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = `${v} (${grouped.get(v).length})`;
            select.appendChild(opt);
        });
    }

    function renderTable(rows) {
        const body = document.querySelector('#householdTable tbody');
        body.innerHTML = rows.map(h => {
            const loc = h.location || {};
            const owner = h.owner || {};
            const coords = loc.coordinates || {};
            const rowColor = colorForStatus(h.status);
            return `<tr>
                <td style="background:${rowColor}">${h.id || ''}</td>
                <td>${owner.name || ''}</td>
                <td>${owner.phone || owner.telephone || ''}</td>
                <td>${loc.region || loc.department || ''}</td>
                <td>${loc.commune || loc.department || ''}</td>
                <td>${loc.village || loc.commune || ''}</td>
                <td>${coords.latitude ?? ''}</td>
                <td>${coords.longitude ?? ''}</td>
                <td>${loc.precision || ''}</td>
                <td>${h.status || ''}</td>
            </tr>`;
        }).join('');
    }

    function filterRows(allRows, village, query) {
        return allRows.filter(h => {
            const loc = h.location || {};
            const inVillage = !village || (loc.village || loc.commune || '').trim() === village;
            if (!inVillage) return false;
            if (!query) return true;
            const owner = h.owner || {};
            const hay = `${h.id} ${owner.name || ''} ${owner.phone || ''} ${loc.region || ''}`.toLowerCase();
            return hay.includes(query.toLowerCase());
        });
    }

    function toCsv(rows) {
        const header = ['id', 'chef_menage', 'telephone', 'region', 'commune', 'village', 'latitude', 'longitude', 'info', 'statut'];
        const lines = [header.join(';')];
        rows.forEach(h => {
            const loc = h.location || {};
            const owner = h.owner || {};
            const coords = loc.coordinates || {};
            lines.push([
                h.id || '',
                (owner.name || '').replace(/;/g, ','),
                owner.phone || owner.telephone || '',
                loc.region || loc.department || '',
                loc.commune || loc.department || '',
                loc.village || loc.commune || '',
                coords.latitude ?? '',
                coords.longitude ?? '',
                loc.precision || '',
                h.status || ''
            ].join(';'));
        });
        return lines.join('\n');
    }

    function downloadExcel(rows, name, assignments = {}) {
        const header = ['ID', 'Chef', 'Téléphone', 'Région', 'Commune', 'Village', 'Latitude', 'Longitude', 'Info', 'Statut'];
        const data = rows.map(h => {
            const loc = h.location || {};
            const owner = h.owner || {};
            const coords = loc.coordinates || {};
            return [
                h.id || '',
                owner.name || '',
                owner.phone || owner.telephone || '',
                loc.region || loc.department || '',
                loc.commune || loc.department || '',
                loc.village || loc.commune || '',
                coords.latitude ?? '',
                coords.longitude ?? '',
                loc.precision || '',
                h.status || ''
            ];
        });
        const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bordereau');

        // Onglet affectations village
        const affRows = [['Type', 'Équipe assignée']];
        Object.entries(assignments).forEach(([type, id]) => {
            affRows.push([type, id || '']);
        });
        const ws2 = XLSX.utils.aoa_to_sheet(affRows);
        XLSX.utils.book_append_sheet(wb, ws2, 'Affectations');

        XLSX.writeFile(wb, `bordereau_${name}.xlsx`);
    }

    function downloadWord(rows, name, assignments = {}) {
        const header = ['ID', 'Chef', 'Téléphone', 'Région', 'Commune', 'Village', 'Latitude', 'Longitude', 'Info', 'Statut'];
        const table = rows.map(h => {
            const loc = h.location || {};
            const owner = h.owner || {};
            const coords = loc.coordinates || {};
            return `
                <tr>
                    <td>${h.id || ''}</td>
                    <td>${owner.name || ''}</td>
                    <td>${owner.phone || owner.telephone || ''}</td>
                    <td>${loc.region || loc.department || ''}</td>
                    <td>${loc.commune || loc.department || ''}</td>
                    <td>${loc.village || loc.commune || ''}</td>
                    <td>${coords.latitude ?? ''}</td>
                    <td>${coords.longitude ?? ''}</td>
                    <td>${loc.precision || ''}</td>
                <td>${h.status || ''}</td>
            </tr>`;
        }).join('');
        const affHtml = Object.keys(assignments).length
            ? `<h3>Affectations</h3><ul>${Object.entries(assignments).map(([t, id]) => `<li>${t}: ${id || 'Non assignée'}</li>`).join('')}</ul>`
            : '';

        const html = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office'
              xmlns:w='urn:schemas-microsoft-com:office:word'
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><style>
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #ccc; padding: 6px; font-size: 12px; }
            th { background: #f3f4f6; }
        </style></head>
        <body>
            <h2>Bordereau — ${name}</h2>
            <table>
                <tr>${header.map(h => `<th>${h}</th>`).join('')}</tr>
                ${table}
            </table>
            ${affHtml}
        </body>
        </html>`;

        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bordereau_${name}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function renderAssignments(village, teams) {
        const container = document.getElementById('assignContainer');
        const summary = document.getElementById('assignSummary');
        container.innerHTML = '';
        summary.textContent = village ? `Village : ${village}` : 'Sélectionnez un village pour affecter les équipes';
        if (!village) return;

        const assignments = loadAssignments();
        const villageAssign = assignments[village] || {};

        // Regrouper les équipes par type normalisé
        const map = new Map();
        teams.forEach(t => {
            const type = (t.type || '').trim() || 'Inconnu';
            if (!map.has(type)) map.set(type, []);
            map.get(type).push(t);
        });

        map.forEach((list, type) => {
            const div = document.createElement('div');
            div.className = 'border border-gray-200 rounded-lg p-3';
            const label = document.createElement('div');
            label.className = 'text-sm font-semibold text-gray-700 mb-1';
            label.textContent = type;
            const select = document.createElement('select');
            select.className = 'w-full border border-gray-300 rounded-md px-2 py-2 text-sm';
            const noneOpt = document.createElement('option');
            noneOpt.value = '';
            noneOpt.textContent = 'Aucune équipe';
            select.appendChild(noneOpt);
            list.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = t.name || `${type} #${t.id}`;
                if (villageAssign[type] == t.id) opt.selected = true;
                select.appendChild(opt);
            });
            select.addEventListener('change', () => {
                const assignments = loadAssignments();
                assignments[village] = assignments[village] || {};
                assignments[village][type] = select.value || null;
                saveAssignments(assignments);
            });
            div.appendChild(label);
            div.appendChild(select);
            container.appendChild(div);
        });
    }

    function renderTeamTable(teams) {
        const body = document.querySelector('#teamTable tbody');
        if (!body) return;
        body.innerHTML = teams.map(team => {
            const meta = loadTeamMeta(team.id);
            return `
                <tr style="background:${colorForType(team.type)}">
                    <td>${team.type || ''}</td>
                    <td>${team.name || team.id || ''}</td>
                    <td><input data-team="${team.id}" data-field="numero" class="border border-gray-300 rounded px-2 py-1 w-32 text-sm" value="${meta.numero || ''}"></td>
                    <td><input data-team="${team.id}" data-field="entreprise" class="border border-gray-300 rounded px-2 py-1 w-48 text-sm" value="${meta.entreprise || ''}"></td>
                </tr>`;
        }).join('');

        body.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const id = input.dataset.team;
                const field = input.dataset.field;
                const meta = loadTeamMeta(id);
                meta[field] = input.value;
                saveTeamMeta(id, meta);
            });
        });
    }

    async function init() {
        await waitForDb();
        const households = await getHouseholds();
        const teams = await getTeams();
        const grouped = groupByVillage(households);
        renderSelect(grouped);
        renderStats(households, grouped);
        renderTable(households);
        renderTeamTable(teams);

        const select = document.getElementById('villageSelect');
        const search = document.getElementById('searchInput');
        const downloadExcelBtn = document.getElementById('downloadExcelBtn');
        const downloadWordBtn = document.getElementById('downloadWordBtn');

        const refresh = () => {
            const village = select.value || '';
            const query = search.value || '';
            const filtered = filterRows(households, village, query);
            renderTable(filtered);
            renderStats(households, grouped, village ? grouped.get(village) : null);
            renderAssignments(village, teams);
        };

        select.addEventListener('change', refresh);
        search.addEventListener('input', refresh);

        downloadExcelBtn.addEventListener('click', () => {
            const village = select.value || 'tous';
            const rows = filterRows(households, select.value || '', search.value || '');
            const assignments = loadAssignments()[select.value || ''] || {};
            downloadExcel(rows, village, assignments);
        });

        downloadWordBtn.addEventListener('click', () => {
            const village = select.value || 'tous';
            const rows = filterRows(households, select.value || '', search.value || '');
            const assignments = loadAssignments()[select.value || ''] || {};
            downloadWord(rows, village, assignments);
        });

        // Toggle team table visibility
        const teamToggleBtn = document.getElementById('teamToggleBtn');
        const teamContainer = document.getElementById('teamTableContainer');
        const hhToggleBtn = document.getElementById('householdToggleBtn');
        const hhContainer = document.getElementById('householdTableContainer');
        if (teamToggleBtn && teamContainer) {
            teamToggleBtn.addEventListener('click', () => {
                const hidden = teamContainer.classList.toggle('hidden');
                teamToggleBtn.innerHTML = hidden
                    ? '<i class="fas fa-chevron-down"></i> Déplier'
                    : '<i class="fas fa-chevron-up"></i> Replier';
            });
        }
        if (hhToggleBtn && hhContainer) {
            hhToggleBtn.addEventListener('click', () => {
                const hidden = hhContainer.classList.toggle('hidden');
                hhToggleBtn.innerHTML = hidden
                    ? '<i class="fas fa-chevron-down"></i> Déplier'
                    : '<i class="fas fa-chevron-up"></i> Replier';
            });
        }

        // Initial render for default selection
        renderAssignments(select.value || '', teams);
    }

    document.addEventListener('DOMContentLoaded', init);
})();

function loadAssignments() {
    try {
        return JSON.parse(localStorage.getItem('village_team_assignments')) || {};
    } catch {
        return {};
    }
}

function saveAssignments(obj) {
    localStorage.setItem('village_team_assignments', JSON.stringify(obj));
}
