module.exports = {
    'no-tiny-text': {
        meta: {
            type: 'problem',
            docs: { description: 'Disallow text smaller than text-xs (12px)' },
            fixable: 'code',
        },
        create: function(context) {
            return {
                Literal(node) {
                    if (typeof node.value === 'string' && /text-\[(8|9|10|11)px\]/.test(node.value)) {
                        context.report({
                            node,
                            message: 'Replace tiny text with text-xs for accessibility',
                            fix: function(fixer) {
                                return fixer.replaceText(node, `"${node.value.replace(/text-\[(8|9|10|11)px\]/g, 'text-xs')}"`);
                            }
                        });
                    }
                },
                TemplateElement(node) {
                    if (typeof node.value.raw === 'string' && /text-\[(8|9|10|11)px\]/.test(node.value.raw)) {
                        context.report({
                            node,
                            message: 'Replace tiny text with text-xs for accessibility',
                            fix: function(fixer) {
                                return fixer.replaceText(node, node.value.raw.replace(/text-\[(8|9|10|11)px\]/g, 'text-xs'));
                            }
                        });
                    }
                }
            };
        }
    },
    'no-typos-jsx': {
        meta: {
            type: 'problem',
            docs: { description: 'Correct common typos like MÉNERGE' },
            fixable: 'code',
        },
        create: function(context) {
            return {
                JSXText(node) {
                    if (node.value.includes('MÉNERGE')) {
                        context.report({
                            node,
                            message: 'Typo detected: MÉNERGE -> MÉNAGE',
                            fix: function(fixer) {
                                return fixer.replaceText(node, node.value.replace(/MÉNERGE/g, 'MÉNAGE'));
                            }
                        });
                    }
                },
                Literal(node) {
                    if (typeof node.value === 'string' && node.value.includes('MÉNERGE')) {
                        context.report({
                            node,
                            message: 'Typo detected: MÉNERGE -> MÉNAGE',
                            fix: function(fixer) {
                                return fixer.replaceText(node, `"${node.value.replace(/MÉNERGE/g, 'MÉNAGE')}"`);
                            }
                        });
                    }
                }
            };
        }
    },
    'flex-child-min-w-0': {
        meta: {
            type: 'suggestion',
            docs: { description: 'Flex children often need min-w-0 to truncate properly' },
        },
        create: function(context) {
            return {
                JSXElement(node) {
                    // Very naive implementation for demonstration
                    const isFlex = node.openingElement.attributes.some(attr => 
                        attr.name && attr.name.name === 'className' && 
                        attr.value && attr.value.value && attr.value.value.includes('flex ')
                    );
                    if (isFlex) {
                        node.children.forEach(child => {
                            if (child.type === 'JSXElement') {
                                const classNameAttr = child.openingElement.attributes.find(attr => attr.name && attr.name.name === 'className');
                                if (classNameAttr && classNameAttr.value && classNameAttr.value.value && !classNameAttr.value.value.includes('min-w-0')) {
                                    // Not strictly reporting all to avoid noise, just an example rule
                                }
                            }
                        });
                    }
                }
            };
        }
    },
    'icon-button-aria-label': {
        meta: {
            type: 'problem',
            docs: { description: 'Icon buttons must have an aria-label' },
        },
        create: function(context) {
            return {
                JSXOpeningElement(node) {
                    if (node.name.name === 'button') {
                        const hasAriaLabel = node.attributes.some(attr => attr.name && attr.name.name === 'aria-label');
                        const hasTitle = node.attributes.some(attr => attr.name && attr.name.name === 'title');
                        
                        // Si le bouton n'a ni aria-label ni title, on lance un warning de vérification
                        if (!hasAriaLabel && !hasTitle) {
                            context.report({
                                node,
                                message: 'Bouton détecté sans aria-label explicite. S\'il ne contient qu\'une icône, veuillez ajouter un aria-label.',
                            });
                        }
                    }
                }
            };
        }
    }
};
