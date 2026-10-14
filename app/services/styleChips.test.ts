import { describe, expect, it } from 'vitest';
import { appendStylesToCaption, basicStylesText, splitStoredCaption, styleTextHasChip, toggleStyleInText } from './styleChips';

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

  it('separates an old expanded Styles block from the structured caption', () => {
    const old = 'Global Metadata:\nPop\nVocal Details:\nLead\nArrangement:\nVerse\nStyles: pop, guitar\nWarm live feel.\nInstrument lock (from Styles — must be audible):\nGuitar required';
    expect(splitStoredCaption(old)).toEqual({ caption: 'Global Metadata:\nPop\nVocal Details:\nLead\nArrangement:\nVerse', styles: 'pop, guitar\nWarm live feel.' });
  });

  it('keeps short user Styles intact but shortens legacy producer briefs', () => {
    expect(basicStylesText('lo-fi, piano, female vocals')).toBe('lo-fi, piano, female vocals');
    const brief = 'Lo-fi piano ballad with female vocals. ' + 'Warm and intimate production. '.repeat(20);
    expect(basicStylesText(brief)).toBe('Lo-fi piano ballad with female vocals.');
  });
});
