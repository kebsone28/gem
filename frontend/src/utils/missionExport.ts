export function exportMissionsCSV(missions: any[]) {
  if (!missions || !missions.length) {
    alert('Aucune mission à exporter');
    return;
  }

  const headers = ['id', 'title', 'location', 'status', 'createdAt', 'updatedAt'];
  const rows = missions.map((m) =>
    headers
      .map((h) => {
        const v = m[h];
        if (typeof v === 'string') return `"${String(v).replace(/"/g, '""')}"`;
        return v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `missions-export-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportMissionsJSON(missions: any[]) {
  if (!missions || !missions.length) {
    alert('Aucune mission à exporter');
    return;
  }
  const data = JSON.stringify(missions, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `missions-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportMissionsNDJSON(missions: any[]) {
  if (!missions || !missions.length) {
    alert('Aucune mission à exporter');
    return;
  }
  const lines = missions.map((m) => JSON.stringify(m)).join('\n');
  const blob = new Blob([lines], { type: 'application/x-ndjson' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `missions-export-${new Date().toISOString().slice(0, 10)}.ndjson`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
