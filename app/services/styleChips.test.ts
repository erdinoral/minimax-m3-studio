import { describe, expect, it } from 'vitest';
import { appendStylesToCaption, styleTextHasChip, toggleStyleInText } from './styleChips';

describe('styleChips', () => {
  it('lets chips toggle inside free-form styles text', () => {
    let text = '';
    text = toggleStyleInText(text, 'phonk');
    expect(text).toBe('phonk');
    text = toggleStyleInText(text, 'jazz');
    expect(text).toBe('phonk, jazz');
    expect(styleTextHasChip(text, 'phonk')).toBe(true);
    text = toggleStyleInText(text, 'phonk');
    expect(text).toBe('jazz');
  });

  it('keeps hand-written styles and appends chips', () => {
    const text = toggleStyleInText('dreamy night city', 'lo-fi');
    expect(text).toBe('dreamy night city, lo-fi');
  });

  it('appends styles field into generate caption', () => {
    expect(appendStylesToCaption('Genre: pop', 'lo-fi, jazz')).toBe('Genre: pop\nStyles: lo-fi, jazz');
    expect(appendStylesToCaption('', 'Styles: already labelled')).toBe('Styles: already labelled');
    expect(appendStylesToCaption('Genre: pop', '')).toBe('Genre: pop');
  });
});
