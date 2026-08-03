
async function testAutosuggest() {
  const baseURL = 'http://localhost:8000/api/v1/properties/autosuggest';
  const queries = ['Bang', 'White', '3BHK', 'NonExistent'];

  console.log('--- Testing Autosuggest API ---');

  for (const q of queries) {
    try {
      console.log(`Testing query: "${q}"`);
      const response = await fetch(`${baseURL}?q=${q}`);
      const data = await response.json();
      
      console.log(`Status: ${response.status}`);
      console.log('Results:', JSON.stringify(data, null, 2));
      console.log('-----------------------------');
    } catch (error) {
      console.error(`Error querying "${q}":`, error.message);
    }
  }
}

testAutosuggest();
