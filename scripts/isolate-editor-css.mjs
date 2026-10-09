import selectorParser from 'postcss-selector-parser';

const scope = '.image-editor';
const namespaceVariables = value => value.replace(/--(?!ie-)[a-zA-Z_][\w-]*/g, name => `--ie-${name.slice(2)}`);

/** Isolate compiled framework styles, including selectors, variables and animations. */
export default function isolateEditor() {
  return {
    postcssPlugin: 'image-editor-isolation',
    OnceExit(root, { result }) {
      const filename = result.opts.from?.replaceAll('\\', '/').split('?')[0] ?? '';
      if (!filename.includes('/src/lib/')) return;
      // rem refers to the document root even inside a shadow tree.
      root.walkDecls(decl => {
        decl.value = decl.value.replace(/(-?(?:\d*\.)?\d+)rem\b/g, (_, value) => `${Number(value) * 16}px`);
      });
      if (!filename.endsWith('/src/lib/tailwind.css')) return;
      const defaults = [];

      const animations = new Map();
      root.walkAtRules(rule => {
        if (/^(?:-webkit-)?keyframes$/.test(rule.name)) {
          const old = rule.params;
          const name = old.startsWith('ie-') ? old : `ie-${old}`;
          animations.set(old, name);
          rule.params = name;
        }
        if (rule.name === 'property') {
          const initial = rule.nodes?.find(node => node.prop === 'initial-value')?.value ?? 'initial';
          defaults.push({ prop: namespaceVariables(rule.params), value: initial, source: rule.source });
          // Property registrations are not portable across shadow roots.
          rule.remove();
        }
        // Keep framework rules and injected component styles in the same cascade.
        if (rule.name === 'layer') {
          if (rule.nodes) rule.replaceWith(...rule.nodes); else rule.remove();
        }
      });
      if (defaults.length) root.prepend({ selector: '.image-editor, .image-editor *, .image-editor::before, .image-editor::after, .image-editor *::before, .image-editor *::after', nodes: defaults, source: root.source });
      root.walkDecls(decl => {
        decl.prop = namespaceVariables(decl.prop);
        decl.value = namespaceVariables(decl.value);
        if (/^(?:-webkit-)?animation(?:-name)?$/.test(decl.prop)) {
          decl.value = decl.value.replace(/[a-zA-Z_][\w-]*/g, token => animations.get(token) ?? token);
        }
      });
      root.walkRules(rule => {
        let parent = rule.parent;
        while (parent) {
          if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return;
          // Nested selectors already inherit an isolated ancestor.
          if (parent.type === 'rule') return;
          parent = parent.parent;
        }
        const rootResets = rule.selectors.filter(selector => ['*', '::before', '::after', '::backdrop', '::file-selector-button'].includes(selector.trim()))
          .map(selector => selector.trim() === '*' ? scope : `${scope}${selector.trim()}`);
        rule.selector = selectorParser(selectors => {
          selectors.each(selector => {
            selector.walk(node => {
              if ((node.type === 'pseudo' && [':root', ':host'].includes(node.value)) ||
                  (node.type === 'tag' && ['html', 'body'].includes(node.value))) {
                node.replaceWith(selectorParser.className({ value: 'image-editor' }));
              }
            });
            const first = selector.first;
            if (first) first.spaces.before = '';
            const isRoot = first?.type === 'class' && first.value === 'image-editor';
            const isRootWhere = first?.type === 'pseudo' && first.value === ':where' &&
              first.nodes?.every(branch => branch.nodes.length === 1 && branch.first?.type === 'class' && branch.first.value === 'image-editor');
            if (isRoot || isRootWhere) return;
            const prefix = selectorParser.className({ value: scope.slice(1) });
            selector.prepend(selectorParser.combinator({ value: ' ' }));
            selector.prepend(prefix);
          });
        }).processSync(rule.selector);
        if (rootResets.length) rule.selector += `, ${rootResets.join(', ')}`;
      });
    },
  };
}
