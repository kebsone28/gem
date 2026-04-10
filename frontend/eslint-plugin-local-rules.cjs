/**
 * eslint-plugin-local-rules.cjs
 * 
 * Règles ESLint custom pour le projet PROQUELEC GEM-SAAS
 * Détecte automatiquement les anomalies UI/UX identifiées dans l'audit
 * 
 * Installation: ce fichier est référencé via le plugin 'local-rules'
 * dans .eslintrc.cjs (utilise eslint-plugin-local-rules)
 */

module.exports = {
  rules: {

    // ─────────────────────────────────────────────────────────────
    // RÈGLE 1 : Tailles de texte trop petites
    // Détecte text-[8px], text-[9px], text-[10px], text-[11px]
    // ─────────────────────────────────────────────────────────────
    'no-tiny-text': {
      meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: {
          description: 'Interdit les tailles de texte inférieures à 12px (text-xs)',
        },
        schema: [],
        messages: {
          tooSmall:
            '🔴 Taille de texte "{{ value }}" trop petite (min: 12px / text-xs). ' +
            'Remplacer par text-xs ou plus grand.',
        },
      },
      create(context) {
        const TINY_PATTERN = /\btext-\[(8|9|10|11)px\]/g;

        function checkNode(node, value) {
          if (typeof value !== 'string') return;
          let match;
          while ((match = TINY_PATTERN.exec(value)) !== null) {
            context.report({
              node,
              messageId: 'tooSmall',
              data: { value: match[0] },
              fix(fixer) {
                const fixed = value.replace(TINY_PATTERN, 'text-xs');
                return fixer.replaceText(node, `"${fixed}"`);
              },
            });
          }
          TINY_PATTERN.lastIndex = 0;
        }

        return {
          JSXAttribute(node) {
            if (node.name.name !== 'className') return;
            const val = node.value;
            if (!val) return;
            if (val.type === 'Literal') checkNode(val, val.value);
            if (
              val.type === 'JSXExpressionContainer' &&
              val.expression.type === 'TemplateLiteral'
            ) {
              val.expression.quasis.forEach((q) =>
                checkNode(q, q.value.raw)
              );
            }
          },
        };
      },
    },

    // ─────────────────────────────────────────────────────────────
    // RÈGLE 2 : min-w-0 manquant dans les flex containers
    // Avertit si un div flex n'a pas min-w-0 sur ses enfants
    // ─────────────────────────────────────────────────────────────
    'flex-child-min-w-0': {
      meta: {
        type: 'suggestion',
        docs: {
          description:
            'Les enfants directs d\'un conteneur flex doivent avoir min-w-0 pour éviter le débordement.',
        },
        schema: [],
        messages: {
          missingMinW0:
            '🟠 Enfant flex sans min-w-0. Ajouter "min-w-0" pour éviter le débordement de texte.',
        },
      },
      create(context) {
        function hasClass(node, cls) {
          const val = node?.value;
          if (!val) return false;
          if (val.type === 'Literal') return val.value?.includes(cls);
          if (
            val.type === 'JSXExpressionContainer' &&
            val.expression?.type === 'TemplateLiteral'
          ) {
            return val.expression.quasis.some((q) =>
              q.value.raw.includes(cls)
            );
          }
          return false;
        }

        function getClassName(node) {
          return node.openingElement?.attributes?.find(
            (a) => a.name?.name === 'className'
          );
        }

        function isFlex(node) {
          const cn = getClassName(node);
          if (!cn) return false;
          return (
            hasClass(cn, 'flex ') ||
            hasClass(cn, ' flex') ||
            hasClass(cn, 'flex-1') ||
            hasClass(cn, 'flex-row') ||
            hasClass(cn, 'flex-col')
          );
        }

        return {
          JSXElement(node) {
            if (!isFlex(node)) return;
            node.children
              .filter((c) => c.type === 'JSXElement')
              .forEach((child) => {
                const cn = getClassName(child);
                if (!cn) return;
                const hasTruncate = hasClass(cn, 'truncate');
                const hasMinW = hasClass(cn, 'min-w-0');
                const hasOverflow = hasClass(cn, 'overflow-hidden');
                if (!hasTruncate && !hasMinW && !hasOverflow) {
                  context.report({
                    node: child,
                    messageId: 'missingMinW0',
                  });
                }
              });
          },
        };
      },
    },

    // ─────────────────────────────────────────────────────────────
    // RÈGLE 3 : Bouton icône sans aria-label
    // ─────────────────────────────────────────────────────────────
    'icon-button-aria-label': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Un <button> qui contient uniquement une icône doit avoir aria-label.',
        },
        schema: [],
        messages: {
          missingLabel:
            '🟠 Bouton icône sans aria-label. Ajouter aria-label="..." pour l\'accessibilité.',
        },
      },
      create(context) {
        const ICON_COMPONENTS = new Set([
          'MapPin', 'LayoutList', 'Search', 'RefreshCw', 'Plus',
          'Wifi', 'Trash2', 'ChevronDown', 'ChevronUp', 'X',
          'Edit', 'Eye', 'Settings', 'Bell', 'Menu', 'ArrowLeft',
        ]);

        function isIconOnly(node) {
          const children = node.children.filter(
            (c) =>
              c.type !== 'JSXText' ||
              c.value.trim() !== ''
          );
          if (children.length !== 1) return false;
          const child = children[0];
          return (
            child.type === 'JSXElement' &&
            ICON_COMPONENTS.has(child.openingElement?.name?.name)
          );
        }

        function hasAriaLabel(node) {
          return node.openingElement.attributes.some(
            (a) =>
              a.name?.name === 'aria-label' ||
              a.name?.name === 'aria-labelledby'
          );
        }

        return {
          JSXElement(node) {
            if (node.openingElement?.name?.name !== 'button') return;
            if (isIconOnly(node) && !hasAriaLabel(node)) {
              context.report({ node, messageId: 'missingLabel' });
            }
          },
        };
      },
    },

    // ─────────────────────────────────────────────────────────────
    // RÈGLE 4 : Fautes de frappe communes dans les strings JSX
    // ─────────────────────────────────────────────────────────────
    'no-typos-jsx': {
      meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: { description: 'Détecte les fautes de frappe connues dans le JSX.' },
        schema: [],
        messages: {
          typo: '🔴 Faute de frappe détectée : "{{ wrong }}" → "{{ correct }}"',
        },
      },
      create(context) {
        const TYPOS = {
          'MÉNERGE': 'MÉNAGE',
          'MENÉRGE': 'MÉNAGE',
          'ménérge': 'ménage',
        };

        return {
          Literal(node) {
            if (typeof node.value !== 'string') return;
            for (const [wrong, correct] of Object.entries(TYPOS)) {
              if (node.value.includes(wrong)) {
                context.report({
                  node,
                  messageId: 'typo',
                  data: { wrong, correct },
                  fix: (fixer) =>
                    fixer.replaceText(
                      node,
                      `"${node.value.replaceAll(wrong, correct)}"`
                    ),
                });
              }
            }
          },
        };
      },
    },

  },
};
