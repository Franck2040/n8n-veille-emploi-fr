#!/usr/bin/env node
/**
 * Importe workflows/veille-emploi.json dans une instance n8n via son API REST.
 *
 * Pré-requis :
 *  - n8n lancé (docker compose up -d) et accessible ;
 *  - une clé API n8n créée dans Paramètres → n8n API (voir MANUAL_STEPS.md).
 *
 * Variables d'environnement :
 *  - N8N_BASE_URL  (défaut : http://localhost:5678)
 *  - N8N_API_KEY   (obligatoire)
 *
 * Usage :
 *   N8N_API_KEY=xxxx node scripts/import-workflow.js
 *
 * Ce script est OPTIONNEL : on peut aussi importer le JSON à la main
 * depuis l'interface n8n (menu ⋯ → Import from File).
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = (process.env.N8N_BASE_URL || 'http://localhost:5678').replace(/\/$/, '');
const API_KEY = process.env.N8N_API_KEY;
const WORKFLOW_PATH = path.join(__dirname, '..', 'workflows', 'veille-emploi.json');

async function main() {
  if (!API_KEY) {
    console.error('❌ Variable N8N_API_KEY manquante. Crée une clé dans n8n → Paramètres → n8n API.');
    process.exit(1);
  }

  const wf = JSON.parse(fs.readFileSync(WORKFLOW_PATH, 'utf8'));

  // L'API n8n n'accepte que certains champs à la création.
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {}
  };

  const res = await fetch(`${BASE_URL}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': API_KEY
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Import échoué (HTTP ${res.status}) : ${text}`);
    process.exit(1);
  }

  const created = await res.json();
  console.log(`✅ Workflow importé avec l'ID ${created.id} — nom : "${created.name}"`);
  console.log('   Ouvre-le dans n8n, configure les credentials, puis active-le.');
}

main().catch((e) => {
  console.error('❌ Erreur : ' + e.message);
  process.exit(1);
});
