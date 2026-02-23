// 1. COLE SUA CHAVE NOVA AQUI DENTRO DAS ASPAS:
const chave = "AIzaSyDpldwL-X39ZV-YIqtUivN1OjHNqbKb3xo";

// 2. O resto do código faz a mágica sozinho:
console.log("🔍 Perguntando pro Google quais modelos estão liberados...");

fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${chave}`)
  .then(res => res.json())
  .then(dados => {
    console.log("✅ Modelos liberados para a sua chave:");
    dados.models
      .filter(m => m.supportedGenerationMethods.includes("generateContent"))
      .forEach(m => console.log(`👉 ${m.name.replace('models/', '')}`));
  })
  .catch(err => console.error("Erro ao buscar:", err));