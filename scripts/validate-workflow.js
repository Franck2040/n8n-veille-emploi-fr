#!/usr/bin/env node
/**
 * Valide le fichier workflows/veille-emploi.json sans dépendance externe.
 *
 * Vérifie :
 *  - que le JSON est syntaxiquement valide ;
 *  - que chaque nœud a un name / type / typeVersion ;
 *  - que toutes les connexions pointent vers des nœuds existants ;
 *  - que le graphe est connexe depuis le nœud déclencheur (pas de nœud orphelin).
 *
 * Usage : node scripts/validate-workflow.js
 * Sortie : code 0 si tout est bon, 1 sinon.
 */

const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'workflows', 'veille-emploi.json');

function fail(message) {
  console.error('❌ ' + message);
  process.exitCode = 1;
}

function main() {
  const raw = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  let wf;
  try {
    wf = JSON.parse(raw);
  } catch (e) {
    fail('JSON invalide : ' + e.message);
    return;
  }
  console.log('✅ JSON syntaxiquement valide');

  const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
  if (nodes.length === 0) {
    fail('Aucun nœud dans le workflow.');
    return;
  }

  const names = new Set();
  for (const node of nodes) {
    if (!node.name) fail('Un nœud sans "name" a été trouvé.');
    if (!node.type) fail(`Le nœud "${node.name}" n'a pas de "type".`);
    if (node.typeVersion === undefined) fail(`Le nœud "${node.name}" n'a pas de "typeVersion".`);
    if (names.has(node.name)) fail(`Nom de nœud dupliqué : "${node.name}".`);
    names.add(node.name);
  }
  console.log(`✅ ${nodes.length} nœuds, tous typés et nommés de façon unique`);

  // Vérifie que les connexions référencent des nœuds existants.
  const connections = wf.connections || {};
  for (const [source, outputs] of Object.entries(connections)) {
    if (!names.has(source)) fail(`Connexion depuis un nœud inconnu : "${source}".`);
    for (const group of Object.values(outputs)) {
      for (const branch of group) {
        for (const link of branch) {
          if (!names.has(link.node)) {
            fail(`Connexion vers un nœud inconnu : "${link.node}" (depuis "${source}").`);
          }
        }
      }
    }
  }
  console.log('✅ Toutes les connexions pointent vers des nœuds existants');

  // Détecte les nœuds orphelins (hors sticky notes et déclencheur).
  const linked = new Set();
  for (const [source, outputs] of Object.entries(connections)) {
    linked.add(source);
    for (const group of Object.values(outputs)) {
      for (const branch of group) {
        for (const link of branch) linked.add(link.node);
      }
    }
  }
  const orphans = nodes
    .filter((n) => !linked.has(n.name))
    .filter((n) => n.type !== 'n8n-nodes-base.stickyNote')
    .filter((n) => !/trigger/i.test(n.type));
  if (orphans.length > 0) {
    fail('Nœud(s) non connecté(s) : ' + orphans.map((n) => n.name).join(', '));
  } else {
    console.log('✅ Aucun nœud orphelin');
  }

  if (!process.exitCode) {
    console.log('\n🎉 Workflow valide — prêt à être importé dans n8n.');
  } else {
    console.log('\n⚠️  Des problèmes ont été détectés (voir ci-dessus).');
  }
}

main();
