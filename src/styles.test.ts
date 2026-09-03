/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const styles = readFileSync(join(process.cwd(), 'src/styles.css'), 'utf8');

it('keeps the first toolbar action group horizontal', () => {
  const toolbarStyles = styles.split('\n').filter((line) => line.includes('.management-toolbar') || line.includes('.management-actions')).join('\n');
  document.head.innerHTML = `<style>${toolbarStyles}</style>`;
  document.body.innerHTML = '<div class="management-toolbar"><div class="management-actions"><button>A</button><button>B</button></div></div>';

  expect(getComputedStyle(document.querySelector('.management-actions')!).display).toBe('flex');
});
