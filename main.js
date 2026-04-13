const { Plugin, MarkdownView } = require('obsidian');
const { ViewPlugin, Decoration } = require('@codemirror/view');
const { RangeSetBuilder } = require('@codemirror/state');
const { foldEffect, foldable } = require('@codemirror/language');

// ─── CM6 ViewPlugin: скрывает %% %%, кроме строки с курсором ─────────────────

const hideCommentPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      const builder = new RangeSetBuilder();
      const doc = view.state.doc;
      
      // Получаем позицию курсора
      const cursorPos = view.state.selection.main.head;
      const cursorLine = doc.lineAt(cursorPos).number;

      for (const { from, to } of view.visibleRanges) {
        const startLine = doc.lineAt(from).number;
        const endLine = doc.lineAt(to).number;

        for (let i = startLine; i <= endLine; i++) {
          const line = doc.line(i);
          
          // НЕ скрываем если курсор на этой строке
          if (i === cursorLine) continue;
          
          // Ищем: ## %%  %% Заголовок
          const match = line.text.match(/^(#{1,6}\s+)(%%\s+%%\s*)/);
          if (match) {
            const commentStart = line.from + match[1].length;
            const commentEnd = commentStart + match[2].length;
            builder.add(
              commentStart,
              commentEnd,
              Decoration.mark({ class: 'cm-comment-hide' })
            );
          }
        }
      }

      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);

// ─── Основной класс плагина ───────────────────────────────────────────────────

module.exports = class CreaseDashHeaders extends Plugin {
  cssStyle = null;

  async onload() {
    this.addCss();
    this.registerEditorExtension(hideCommentPlugin);

    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        setTimeout(() => this.foldDashHeaders(), 200);
      })
    );

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        setTimeout(() => this.foldDashHeaders(), 200);
      })
    );

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        setTimeout(() => this.foldDashHeaders(), 100);
      })
    );
  }

  addCss() {
    const css = `
      /* Скрываем комментарий только в Live Preview */
      .is-live-preview .cm-comment-hide {
        display: none !important;
      }
    `;

    this.cssStyle = document.createElement('style');
    this.cssStyle.textContent = css;
    document.head.appendChild(this.cssStyle);
  }

  foldDashHeaders() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view?.editor) return;

    const cm = view.editor.cm;
    if (!cm) return;

    const doc = cm.state.doc;
    const effects = [];

    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      if (/^#{1,6}\s+%%\s+%%/.test(line.text)) {
        const range = foldable(cm.state, line.from, line.to);
        if (range) {
          effects.push(foldEffect.of(range));
        }
      }
    }

    if (effects.length > 0) {
      cm.dispatch({ effects });
    }
  }

  onunload() {
    if (this.cssStyle) {
      this.cssStyle.remove();
    }
  }
};