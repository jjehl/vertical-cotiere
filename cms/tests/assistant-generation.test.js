const { test } = require('node:test');
const assert = require('node:assert/strict');
const plugin = require('../src/plugins/publication-assistant/server');

test('Large 4 : budget de génération, réponse en blocs et refus des sorties tronquées', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.MISTRAL_API_KEY;
  const originalModel = process.env.MISTRAL_MODEL;
  process.env.MISTRAL_API_KEY = 'test-key';
  process.env.MISTRAL_MODEL = 'mistral-large-4';
  const check = { cannot: { create: () => false } };
  const strapi = { plugin: () => ({ service: () => ({ create: () => check }) }) };
  const prepare = plugin.controllers.assistant({ strapi }).prepare;
  const context = () => ({ state: { user: { id: 98765 } }, request: { body: { instruction: 'Ajouter une sortie sans date.' } } });
  let finishReason = 'length';
  try {
    globalThis.fetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      assert.equal(request.reasoning_effort, 'low');
      assert.equal(request.top_p, 1);
      assert.equal(request.max_tokens, 8192);
      return Response.json({ choices: [{ finish_reason: finishReason, message: { content: [
        { type: 'thinking', thinking: [{ type: 'text', text: 'Ne pas utiliser comme JSON.' }] },
        { type: 'text', text: JSON.stringify({ status: 'needs_clarification', question: 'Quelle date ?', title: '', body: '', category: 'Sortie', meeting: null }) },
      ] } }] });
    };
    const truncated = context();
    await prepare(truncated);
    assert.equal(truncated.status, 502);
    assert.match(truncated.body.error.message, /limite de génération/);
    assert.equal(truncated.body.previewId, undefined);
    finishReason = 'stop';
    const complete = context();
    await prepare(complete);
    assert.deepEqual(complete.body, { question: 'Quelle date ?' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MISTRAL_API_KEY;
    else process.env.MISTRAL_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.MISTRAL_MODEL;
    else process.env.MISTRAL_MODEL = originalModel;
  }
});
