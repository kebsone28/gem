export function extractFormTitle(xml: string): string {
  const match = xml.match(/<h:title[^>]*>([^<]+)<\/h:title>/i);
  return match?.[1]?.trim() || 'Formulaire sans titre';
}

export function extractFormFields(xml: string): { name: string; label: string; type: string }[] {
  const fields: { name: string; label: string; type: string }[] = [];
  const inputRegex = /<input\b[^>]*\bref="([^"]+)"[^>]*>([\s\S]*?)<\/input>/gi;
  const labelRegex = /<label[^>]*>([^<]+)<\/label>/i;

  let match;
  while ((match = inputRegex.exec(xml)) !== null) {
    const ref = match[1];
    const inner = match[2];
    const labelMatch = inner.match(labelRegex);
    fields.push({
      name: ref.split('/').pop() || ref,
      label: labelMatch?.[1]?.trim() || ref,
      type: 'text',
    });
  }
  return fields;
}

export function countFormQuestions(xml: string): number {
  const questionRegex = /<(input|select1|select|repeat|note|trigger|upload)\b/gi;
  const matches = xml.match(questionRegex);
  return matches?.length || 0;
}
