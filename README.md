# 
<H1 align="center" > <b>n8n · Veille Emploi FR </b></H1>
<p align="center"> 
  <img alt="n8n" src="https://img.shields.io/badge/n8n-workflow-EA4B71?logo=n8n&logoColor=white"/> 
  <img alt="Google Gemini" src="https://img.shields.io/badge/Google_Gemini-API-8E75B2?logo=googlegemini&logoColor=white"/> 
  <img alt="Notion" src="https://img.shields.io/badge/Notion-database-000000?logo=notion&logoColor=white"/> 
  <img alt="Docker" src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white"/> 
  <img alt="License" src="https://img.shields.io/badge/License-MIT-3fbf8f"/> 
</p>
J'automatise ma veille d'offres d'emploi avec n8n, Gemini et Notion.**  
Un mail d'alerte arrive → l'IA en extrait l'offre → elle est dédupliquée, rangée dans Notion, et je reçois un récap.



---

## Pourquoi ce projet

En cherchant un stage ou un poste, on se retrouve très vite submergé par les alertes mails (LinkedIn, Indeed, France Travail...). Fatigué de perdre du temps à copier-coller manuellement chaque offre intéressante dans mon tableau de suivi, j'ai décidé de créer ce pipeline avec **n8n** pour automatiser tout ça.

Le workflow s'occupe de tout : il intercepte mes alertes mails, analyse et structure le contenu grâce à l'API de **Google Gemini**, élimine les doublons, range proprement l'offre dans ma base de données **Notion** et m'envoie un récapitulatif par mail.

Ce projet m'a énormément plu et m'a permis de mettre un gros coup d'accélérateur sur mes compétences en automatisation. En plus de me servir au quotidien, je l'ai conçu comme un **template 100% réutilisable** : il est très simple de remplacer la source (Gmail) ou la destination (Notion) pour surveiller n'importe quel autre flux (flux RSS, veille techno, etc.).

---

## Le flux en un coup d'œil

```
📧 Mail d'alerte  →  🤖 Extraction IA (Gemini)  →  🧹 Déduplication  →  🗂️ Notion  →  🔔 Notification
```

Concrètement, six étapes s'enchaînent dans le workflow :

1. **Déclencheur Gmail** : n8n surveille ma boîte et se déclenche à l'arrivée d'un mail d'alerte.
2. **Préparation** : un nœud *Code* construit le prompt et le schéma JSON attendu.
3. **Extraction IA** : un appel à l'API **Gemini** renvoie l'offre en JSON structuré (intitulé, entreprise, lieu, lien).
4. **Structuration** : la réponse est parsée et normalisée.
5. **Déduplication** : les offres déjà vues (par leur lien) sont écartées.
6. **Notion + notification** : chaque nouvelle offre est écrite dans Notion, et je reçois un mail récap.

> Le diagramme détaillé est dans [`docs/schema-workflow.md`](docs/schema-workflow.md).

---

## Aperçu

Canvas du workflow dans n8n  
Base Notion résultante

*(Les captures sont à ajouter dans `docs/screenshots/` : les emplacements attendus y sont listés.)*

---

## Stack technique


| Brique                      | Rôle                                                                  |
| --------------------------- | --------------------------------------------------------------------- |
| **n8n** (Docker)            | Orchestrateur du workflow, hébergé en local avec volume persistant    |
| **Gmail** (Trigger + envoi) | Source des alertes et canal de notification                           |
| **Google Gemini**           | Extraction/structuration de l'offre en JSON fiable (`responseSchema`) |
| **Notion**                  | Base de données où sont rangées les offres                            |
| **Node.js** (scripts)       | Validation du workflow et import automatique (optionnels)             |


Aucune valeur sensible n'est en dur : tout passe par les **credentials n8n** et les variables `{{ $env.XXX }}` définies dans `.env`.

---

## Démarrage rapide

```bash
git clone https://github.com/Franck2040/n8n-veille-emploi-fr.git
cd n8n-veille-emploi-fr

cp .env.example .env      # puis renseigne au moins N8N_ENCRYPTION_KEY
docker compose up -d      # n8n démarre sur http://localhost:5678
```

Puis ouvre [**http://localhost:5678**](http://localhost:5678), importe [`workflows/veille-emploi.json`](workflows/veille-emploi.json) et configure les credentials.

👉 **L'installation complète, étape par étape (clés API, OAuth Google, intégration Notion), est détaillée dans [`MANUAL_STEPS.md`](MANUAL_STEPS.md).** C'est le point d'entrée à suivre.

Pour vérifier que le workflow est bien formé avant de l'importer :

```bash
node scripts/validate-workflow.js
```

---

## Utiliser ce template pour ta propre veille

Le pipeline est générique. Pour surveiller autre chose que des offres d'emploi, tu changes surtout les **extrémités** :

- **Changer la source** : remplace le nœud *Gmail Trigger* par un autre déclencheur : *RSS Feed Trigger* (pour une veille d'actualités ou un flux d'offres RSS), *IMAP Email*, un *Webhook*, ou un *Schedule* qui appelle une API. Le reste du flux ne bouge pas.
- **Changer le filtre** : la variable `GMAIL_SEARCH_QUERY` dans `.env` cible les bons mails (`from:`, `subject:`, mots-clés…). Aucune modification du workflow nécessaire.
- **Adapter l'extraction** : dans le nœud *Préparer la requête Gemini*, ajuste le prompt et le `responseSchema` pour extraire les champs qui t'intéressent (ex : prix, auteur, catégorie).
- **Changer la destination** : remplace le nœud *Notion* par *Google Sheets*, *Airtable*, une base SQL… La logique de déduplication et de notification reste identique.
- **Changer la notification** : Gmail, Slack, Telegram, Discord : n8n a un nœud pour chacun.

Autrement dit : garde le squelette **source → IA → dédup → stockage → notif**, et remplace les briques d'entrée/sortie selon ton besoin.

---

## Ce que fait la v1 (et ce qu'elle ne fait pas encore)

Autant être honnête : cette première version **centralise et range**, elle ne postule pas à ta place. Concrètement, aujourd'hui :

**Ce que ça fait :**

- lit les mails d'alerte, en extrait l'offre proprement et la range dans Notion sans copier-coller ;
- écarte les doublons ;
- t'envoie un récap.

**Ce que ça ne fait pas encore (et que je sais) :**

- ça ne récupère pas l'e-mail du recruteur (les mails d'alerte ne le contiennent pas) ;
- ça n'adapte pas mon CV à l'offre ;
- l'IA travaille surtout à partir du contenu du mail : si le mail est pauvre, l'extraction l'est aussi (elle ne va pas encore lire la page de l'offre) ;
- il faut que Docker tourne sur ma machine, et l'API Gemini a un quota gratuit limité.

C'est donc une **première brique** : la plomberie (source → IA → dédup → stockage → notif) est en place et fiable. La valeur vient avec la v2.

---

## Feuille de route (v2)

Les évolutions qui rendent l'outil vraiment utile, dans l'ordre où je compte les faire :

1. **Lire la vraie offre, pas juste le titre** : suivre le lien et donner le contenu réel de la page à l'IA (fini les décisions basées sur un intitulé).
2. **Matching CV** : comparer l'offre à mes deux CV types (1. support IT / cyber / réseau-système ; 2. graphisme / UI-UX / front) et me dire : *« ton CV général suffit »* ou *« adapte tel point »*.
3. **E-mail du recruteur** : quand la page de l'offre l'expose, l'extraire pour faciliter la relance.
4. **Récap groupé** : un seul e-mail digest par jour plutôt qu'un mail par offre.
5. **Tourner en continu** : héberger n8n (petit VPS / n8n Cloud) pour que ça marche machine éteinte.

---

## Journal des erreurs &amp; dépannage

En montant ce workflow j'ai croisé plusieurs vraies erreurs (accès aux variables d'env, confusion jeton/ID Notion, propriété URL vide, `undefined` dans l'e-mail). Je les ai toutes documentées, avec le correctif, dans [**`docs/TROUBLESHOOTING.md`**](docs/TROUBLESHOOTING.md) : utile si tu forkes.

---

## Structure du dépôt

```
n8n-veille-emploi-fr/
├── workflows/veille-emploi.json   # le workflow, importable dans n8n
├── docker-compose.yml             # n8n en local, volume persistant
├── .env.example                   # variables en placeholders (jamais de vrai secret)
├── scripts/
│   ├── validate-workflow.js       # valide le JSON et le graphe des nœuds
│   └── import-workflow.js         # import via l'API REST n8n (optionnel)
├── docs/
│   ├── schema-workflow.md         # diagramme Mermaid du flux
│   ├── TROUBLESHOOTING.md         # les erreurs rencontrées et leurs correctifs
│   └── screenshots/               # emplacements des captures
├── MANUAL_STEPS.md                # installation détaillée pas à pas
├── README.md
└── LICENSE
```

---

Ce projet m’a permis d’apprendre énormément sur l’automatisation avec **n8n**, et je suis super enthousiaste à l’idée de pousser plus loin ces fonctionnalités avec la **v2** !

Sous licence **MIT** : libre à toi de le forker et de l'adapter à ta propre veille.
