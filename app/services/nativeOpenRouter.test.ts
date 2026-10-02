import { afterEach, describe, expect, it, vi } from 'vitest';
import { modelsForCapability, transcribeWithSelectedProvider, type NativeOpenRouterModel } from './nativeOpenRouter';

afterEach(() => vi.unstubAllGlobals());

describe('selected transcription provider', () => {
  it('does not upload audio to the cloud after a local failure', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ selections: [{ capability: 'speech_to_text', mode: 'local', cloud_model: 'configured/cloud' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Local recogniser missing' }), { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const file = { name: 'test.wav', type: 'audio/wav', arrayBuffer: async () => new ArrayBuffer(0) } as File;
    await expect(transcribeWithSelectedProvider(file)).rejects.toThrow('Local recogniser missing');
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/v1/configuration', '/v1/transcriptions/local']);
  });

  it('requires a configured cloud model before sending audio', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ selections: [{ capability: 'speech_to_text', mode: 'open_router' }] })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(transcribeWithSelectedProvider({} as File)).rejects.toThrow('Choose a speech-to-text model');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('modelsForCapability', () => {
  it('uses only capability metadata returned by the native OpenRouter catalog', () => {
    const models: NativeOpenRouterModel[] = [
      { id: 'dynamic/asr', name: 'ASR', capabilities: ['speech_to_text'] },
      { id: 'dynamic/image', name: 'Image', capabilities: ['cover_art'] },
      { id: 'dynamic/text', name: 'Text', capabilities: [] },
    ];

    expect(modelsForCapability(models, 'speech_to_text').map((model) => model.id)).toEqual(['dynamic/asr']);
    expect(modelsForCapability(models, 'cover_art').map((model) => model.id)).toEqual(['dynamic/image']);
  });
});
