async function callPublicFreeAI(query) {
  try {
    const response = await fetch(
      `https://text.pollinations.ai/${encodeURIComponent(query)}?model=openai`
    );
    if (!response.ok) throw new Error('Service public Pollinations indisponible.');
    return await response.text();
  } catch (e) {
    throw e;
  }
}

async function test() {
  const queries = [
    'Hello world',
    'What is AI?',
    'Explain electricity',
    'Bonjour, comment allez-vous?'
  ];

  for (const q of queries) {
    console.log(`\nTesting: "${q}"`);
    try {
      const result = await callPublicFreeAI(q);
      console.log('Response:', result.substring(0, 200) + '...');
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

test();