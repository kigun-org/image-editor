import { test, expect } from './helpers';

export function styleIsolationTests(modulePath: string) {
  test('isolates the full reset and styles in both directions', async ({ page }) => {
    await page.route('**/isolation-host/', route => route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><title>Style isolation</title></head><body>
        <h1>Host heading</h1><p>Host paragraph</p>
        <button class="btn btn-primary">Host button</button>
        <input class="input" aria-label="Host input">
        <select class="select" aria-label="Host select"><option>Option</option></select>
        <div class="alert alert-warning">Host alert</div>
        <div id="first"></div><div id="second"></div></body></html>`,
    }));
    await page.goto('/isolation-host/');
    const outside = () => page.locator('h1, body > p, body > button, body > input, body > select, body > .alert').evaluateAll(elements =>
      elements.map(element => {
        const style = getComputedStyle(element);
        return Object.fromEntries(Array.from(style).map(key => [key, style.getPropertyValue(key)]));
      }),
    );
    const before = await outside();
    await page.evaluate(async modulePath => {
      const { default: Editor } = await import(/* @vite-ignore */ modulePath);
      const instances = ['first', 'second'].map(id => new Editor({
        target: document.getElementById(id), props: { saveCallback: async () => {} },
      }));
      Object.assign(window, {
        destroyIsolationEditors: () => instances.forEach(editor => editor.$destroy()),
        remountIsolationEditor: () => {
          instances[1].$destroy();
          instances[1] = new Editor({ target: document.getElementById('second'), props: { saveCallback: async () => {} } });
        },
      });
    }, modulePath);
    await expect(page.locator('.image-editor')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Upload an image', exact: true })).toHaveCount(2);
    expect(await outside()).toEqual(before);
    expect(await page.locator('head style, head link[rel=stylesheet]').count()).toBe(0);

    const editor = page.locator('#first .image-editor');
    const inside = () => editor.locator('h2, p, button').evaluateAll(elements => elements.map(element => {
      const style = getComputedStyle(element);
      return [style.font, style.color, style.backgroundColor, style.letterSpacing, style.textTransform,
        style.margin, style.padding, style.border, style.boxSizing];
    }));
    const clean = await inside();
    for (const order of ['before', 'after']) {
      await page.evaluate(order => {
        const style = document.createElement('style');
        style.textContent = `html { font-size: 29px; --color-primary: red; --ie-color-primary: red; }
          * { color: magenta !important; font-family: monospace !important; letter-spacing: 7px !important; text-transform: uppercase !important; }
          button, input, select, h2, p, .btn, .alert { border: 9px solid red !important; padding: 30px !important; background: lime !important; }
          body { direction: rtl; line-height: 4; }`;
        if (order === 'before') document.head.prepend(style); else document.head.append(style);
      }, order);
      expect(await inside()).toEqual(clean);
      // Mounting under existing host rules must also remain isolated.
      await page.evaluate(() => (window as unknown as { remountIsolationEditor(): void }).remountIsolationEditor());
      expect(await page.locator('#second .image-editor').locator('h2, p, button').evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        return [style.font, style.color, style.backgroundColor, style.letterSpacing, style.textTransform,
          style.margin, style.padding, style.border, style.boxSizing];
      }))).toEqual(clean);
      await page.locator('head style').evaluateAll(styles => styles.forEach(style => style.remove()));
    }

    const reset = await editor.evaluate(root => {
      const probe = document.createElement('div');
      probe.innerHTML = '<h1>Heading</h1><p>Paragraph</p><ul><li>Item</li></ul><input><img alt="Probe">';
      root.append(probe);
      const values = Array.from(probe.children).map(element => {
        const style = getComputedStyle(element);
        return { margin: style.margin, padding: style.padding, boxSizing: style.boxSizing, listStyle: style.listStyleType, display: style.display };
      });
      const rootStyle = getComputedStyle(root);
      const result = { values, rootBoxSizing: rootStyle.boxSizing };
      probe.remove();
      return result;
    });
    expect(reset.rootBoxSizing).toBe('border-box');
    for (const value of reset.values) expect(value).toMatchObject({ margin: '0px', padding: '0px', boxSizing: 'border-box' });
    expect(reset.values[2].listStyle).toBe('none');
    expect(reset.values[4].display).toBe('block');
    await page.evaluate(() => (window as unknown as { destroyIsolationEditors(): void }).destroyIsolationEditors());
    await expect(page.locator('[data-image-editor-host]')).toHaveCount(0);
    expect(await outside()).toEqual(before);
  });
}
