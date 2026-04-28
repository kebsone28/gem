import React from 'react';

type PremiumMessageBlock =
  | { type: 'title'; text: string }
  | { type: 'section'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'kv'; label: string; value: string };

const PREMIUM_SECTION_HEADINGS = new Set([
  'action immediate',
  'action recommandee',
  'action recommandée',
  'action corrective',
  'actions correctives',
  'action utile',
  'conclusion',
  'conclusion de controle',
  'conclusion de contrôle',
  'contexte actuel',
  'contexte terrain',
  'constats bloquants',
  'domaine(s) detecte(s)',
  'domaine(s) détecté(s)',
  'exigences techniques',
  'fiche de controle terrain',
  'fiche de contrôle terrain',
  'observation',
  'points de controle',
  'points de contrôle',
  'points de vigilance',
  'points essentiels',
  'pourquoi c\'est bloquant',
  'pratiques non conformes',
  'references',
  'références',
  'regle de reference',
  'règle de référence',
  'risque principal',
  'source',
  'verdict terrain',
]);

function normalizePremiumToken(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderInlineMarkup(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={`${token}-${index}`} className="font-black text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={`${token}-${index}`}
          className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[0.95em] font-bold text-cyan-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    return <React.Fragment key={`${token}-${index}`}>{token}</React.Fragment>;
  });
}

function parsePremiumMessageBlocks(message: string): PremiumMessageBlock[] {
  const blocks: PremiumMessageBlock[] = [];
  const lines = message.replace(/\r/g, '').split('\n');
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let hasPrimaryTitle = false;

  const flushList = () => {
    if (!listBuffer) return;
    blocks.push({ type: 'list', ordered: listBuffer.ordered, items: [...listBuffer.items] });
    listBuffer = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }

    const boldOnlyMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (boldOnlyMatch) {
      flushList();
      blocks.push({
        type: hasPrimaryTitle ? 'section' : 'title',
        text: boldOnlyMatch[1].trim(),
      });
      hasPrimaryTitle = true;
      continue;
    }

    const normalizedHeading = normalizePremiumToken(line.replace(/:$/, ''));
    if (PREMIUM_SECTION_HEADINGS.has(normalizedHeading)) {
      flushList();
      blocks.push({ type: 'section', text: line.replace(/:$/, '') });
      continue;
    }

    const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberedMatch) {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(numberedMatch[2].trim());
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(bulletMatch[1].trim());
      continue;
    }

    const kvMatch = line.match(/^([A-Za-zÀ-ÿ0-9'’()\/\-\s]{2,34})\s*:\s+(.+)$/);
    if (kvMatch) {
      flushList();
      blocks.push({
        type: 'kv',
        label: kvMatch[1].trim(),
        value: kvMatch[2].trim(),
      });
      continue;
    }

    flushList();
    blocks.push({ type: 'paragraph', text: line });
  }

  flushList();
  return blocks;
}

export const AIPremiumMessage: React.FC<{ message: string }> = ({ message }) => {
  const blocks = parsePremiumMessageBlocks(message);
  const rendered: React.ReactNode[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type === 'kv') {
      const kvBlocks = [block];
      while (index + 1 < blocks.length && blocks[index + 1].type === 'kv') {
        kvBlocks.push(blocks[index + 1] as Extract<PremiumMessageBlock, { type: 'kv' }>);
        index += 1;
      }

      rendered.push(
        <div key={`kv-group-${index}`} className="grid gap-2.5 sm:grid-cols-2">
          {kvBlocks.map((item) => (
            <div
              key={`${item.label}-${item.value}`}
              className="rounded-[1.15rem] border border-white/8 bg-white/[0.04] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {item.label}
              </p>
              <p className="mt-1.5 text-[12.5px] font-semibold leading-6 text-slate-50">
                {renderInlineMarkup(item.value)}
              </p>
            </div>
          ))}
        </div>
      );
      continue;
    }

    if (block.type === 'title') {
      rendered.push(
        <div key={`title-${index}`} className="space-y-2">
          <h4 className="text-[1.02rem] sm:text-[1.12rem] font-black tracking-[-0.02em] text-white">
            {renderInlineMarkup(block.text)}
          </h4>
        </div>
      );
      continue;
    }

    if (block.type === 'section') {
      rendered.push(
        <div key={`section-${index}`} className="pt-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-200/75">
            {renderInlineMarkup(block.text)}
          </p>
        </div>
      );
      continue;
    }

    if (block.type === 'list') {
      rendered.push(
        <div key={`list-${index}`} className="grid gap-2.5">
          {block.items.map((item, itemIndex) => (
            <div
              key={`${item}-${itemIndex}`}
              className="flex items-start gap-3 rounded-[1.15rem] border border-white/8 bg-white/[0.035] px-3.5 py-3"
            >
              {block.ordered ? (
                <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-blue-400/20 bg-blue-400/10 px-1.5 text-[10px] font-black text-blue-200">
                  {itemIndex + 1}
                </span>
              ) : (
                <span className="mt-[0.7rem] h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
              )}
              <p className="min-w-0 flex-1 text-[12.75px] font-medium leading-6 text-slate-100/92">
                {renderInlineMarkup(item)}
              </p>
            </div>
          ))}
        </div>
      );
      continue;
    }

    rendered.push(
      <p
        key={`paragraph-${index}`}
        className="text-[13px] sm:text-[13.5px] font-medium leading-7 text-slate-100/92"
      >
        {renderInlineMarkup(block.text)}
      </p>
    );
  }

  return <div className="space-y-4 sm:space-y-5">{rendered}</div>;
};

export default AIPremiumMessage;
