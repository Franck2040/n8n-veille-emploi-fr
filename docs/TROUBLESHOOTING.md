# Dépannage — les erreurs que j'ai rencontrées (et comment je les ai réglées)

J'ai gardé la trace des vrais problèmes croisés en montant ce workflow. Si tu forkes le projet,
tu tomberas probablement sur les mêmes — voici le raccourci.

---

## 1. `access to env vars denied` sur le nœud Gmail

**Symptôme :** dès l'exécution, le premier nœud plante avec *« access to env vars denied »*.

**Cause :** par défaut, n8n **interdit** la lecture des variables d'environnement (`{{ $env.XXX }}`)
dans les nœuds, pour des raisons de sécurité. Or le workflow lit `GMAIL_SEARCH_QUERY`,
`NOTION_DATABASE_ID`, etc. via `$env`.

**Correctif :** j'ai ajouté dans `docker-compose.yml` :

```yaml
- N8N_BLOCK_ENV_ACCESS_IN_NODE=false
```

puis recréé le conteneur (`docker compose up -d`). Les données (workflow, credentials) sont dans un
volume Docker, donc rien n'est perdu au redémarrage.

---

## 2. `Database parameter's value is invalid` sur le nœud Notion

**Symptôme :** le nœud Notion renvoie *« Database parameter's value is invalid »*.

**Cause :** le **piège classique Notion**. J'avais collé le **jeton d'intégration** (`ntn_…`) dans
`NOTION_DATABASE_ID`, alors que ce champ attend l'**ID de la base** (32 caractères hexadécimaux),
pas le jeton. Le jeton, lui, va dans le credential n8n.

| Valeur | C'est quoi | Où ça va |
|---|---|---|
| `ntn_…` | jeton secret de l'intégration | credential n8n *Notion - Veille Emploi* |
| `dc83…` (32 hex) | ID de la base | variable `NOTION_DATABASE_ID` du `.env` |

**Correctif :** mettre les 32 caractères de l'URL de la base dans `NOTION_DATABASE_ID`, redémarrer.
Et bien penser à **partager la base avec l'intégration** (base Notion → ⋯ → Connexions → ajouter
l'intégration), sinon l'API répond « objet introuvable ».

---

## 3. `body.properties.Lien.url should be populated or null, instead was ""`

**Symptôme :** Notion refuse la création de page avec une longue erreur de validation.

**Cause :** quand Gemini ne trouvait pas de lien dans le mail, le champ `lien` valait `""` (chaîne
vide). Or une propriété **URL** de Notion n'accepte pas la chaîne vide : elle veut une vraie URL
**ou `null`**.

**Correctif — rendre le flux tolérant :** dans le nœud *Structurer l'offre*, je normalise l'URL
(regex `https?://…`) et je renvoie `null` si rien de valide. Le nœud Notion utilise
`{{ $json.lien || null }}`. Résultat : une offre sans lien s'enregistre quand même, cellule vide.
J'en ai profité pour :

- récupérer le **premier lien trouvé dans le mail** si Gemini l'a raté ;
- ne **pas casser le flux** si Gemini renvoie un JSON illisible (repli sur un objet vide) ;
- mettre un **intitulé de secours** (le sujet du mail) si l'intitulé manque.

---

## 4. L'e-mail de notification affichait `undefined`

**Symptôme :** le mail récap arrivait avec *« Intitulé : undefined … Ajoutée le undefined »*.

**Cause :** après le nœud Notion, la donnée qui circule n'est plus l'offre mais la **réponse de
l'API Notion** (id de page, etc.). Le nœud d'e-mail lisait `{{ $json.intitule }}` sur cette
réponse — donc `undefined`.

**Correctif :** faire relire l'offre au nœud d'e-mail depuis le nœud de déduplication, qui contient
encore les bons champs :

```
{{ $('Dédupliquer (liens déjà vus)').item.json.intitule }}
```

---

## 5. Reprise sur incident (quotas, coupures réseau)

L'API Gemini a un **quota gratuit limité** et peut renvoyer une erreur passagère. Pour éviter qu'une
exécution échoue bêtement, j'ai activé sur les nœuds *Extraction IA (Gemini)* et *Enregistrer dans
Notion* :

```
retryOnFail = true, maxTries = 3, waitBetweenTries = 2000 ms
```

Ça ne contourne pas le quota (si le quota est épuisé, il faut attendre le reset), mais ça encaisse
les erreurs temporaires sans faire tomber tout le flux.
