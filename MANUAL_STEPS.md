# Étapes manuelles — configuration de bout en bout

Ce guide couvre tout ce qui **ne peut pas être automatisé** : les clés d'API, les identifiants et
les autorisations qui, par nature, dépendent de tes propres comptes. Suis les étapes dans l'ordre.

Chaque section précise **quoi créer** et **où le coller**. J'ai toujours choisi la voie la plus
simple pour quelqu'un qui apprend en autodidacte, et j'explique pourquoi.

---

## 0. Pré-requis

- **Docker Desktop** installé et lancé.
- Un compte **Google** (pour Gmail + Gemini) et un compte **Notion**.
- 15 à 20 minutes.

---

## 1. Démarrer n8n en local

```bash
# À la racine du projet :
cp .env.example .env          # (Windows PowerShell : Copy-Item .env.example .env)
```

Ouvre `.env` et renseigne au minimum `N8N_ENCRYPTION_KEY` (une longue chaîne aléatoire).
Les autres variables peuvent être complétées au fur et à mesure.

```bash
docker compose up -d
```

Ouvre ensuite **http://localhost:5678** dans ton navigateur et crée ton compte propriétaire
(local, il reste sur ta machine). n8n est prêt.

---

## 2. Créer la clé API Google Gemini

1. Va sur **https://aistudio.google.com/app/apikey** (Google AI Studio).
2. Clique sur **Create API key** et copie la clé générée.

**Où la coller dans n8n :**

1. Menu de gauche → **Credentials** → **Add credential**.
2. Cherche et choisis **Header Auth**.
3. Renseigne :
   - **Name** (nom du credential) : `Gemini API` ← *exactement ce nom, il est référencé dans le workflow.*
   - **Header Name** : `x-goog-api-key`
   - **Header Value** : *ta clé Gemini*
4. **Save**.

> **Pourquoi Header Auth plutôt que de mettre la clé dans l'URL ?** La clé reste stockée dans le
> credential chiffré de n8n et n'apparaît jamais en clair dans le workflow exporté. C'est plus
> propre et plus sûr pour un dépôt public.

---

## 3. Créer les identifiants Gmail (OAuth2)

Le nœud *Gmail Trigger* et le nœud d'envoi utilisent **Gmail OAuth2**. C'est la voie recommandée
par n8n (plus robuste que l'IMAP + mot de passe d'application, et elle couvre lecture **et** envoi
avec un seul credential).

1. Va sur **https://console.cloud.google.com/** → crée (ou choisis) un projet.
2. **APIs & Services → Library** → active **Gmail API**.
3. **APIs & Services → OAuth consent screen** → type **External** → renseigne le minimum,
   ajoute ton adresse Gmail dans **Test users**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** → type
   **Web application**.
   - Dans **Authorized redirect URIs**, colle l'URL que n8n t'affiche à l'étape suivante
     (généralement `http://localhost:5678/rest/oauth2-credential/callback`).
5. Copie le **Client ID** et le **Client Secret**.

**Où les coller dans n8n :**

1. **Credentials → Add credential → Gmail OAuth2 API**.
2. **Name** : `Gmail - Alerte Emploi` ← *exactement ce nom.*
3. Colle **Client ID** et **Client Secret**, puis clique **Sign in with Google** et autorise.
4. **Save**.

> **Pourquoi OAuth2 et pas IMAP ?** Un seul credential sert à la fois à *lire* les alertes et à
> *envoyer* la notification. Avec IMAP il faudrait un second credential SMTP. OAuth2 est aussi la
> méthode que Google encourage et qui évite les mots de passe d'application.

---

## 4. Créer l'intégration Notion et partager la base

### a) Créer la base

Dans Notion, crée une base de données (table) avec **exactement** ces propriétés :

| Propriété | Type Notion |
|---|---|
| `Intitulé` | **Title** (la colonne titre par défaut) |
| `Entreprise` | Text |
| `Lieu` | Text |
| `Lien` | URL |
| `Date d'ajout` | Date |

### b) Créer l'intégration

1. Va sur **https://www.notion.so/my-integrations** → **New integration**.
2. Donne-lui un nom (ex : `Veille Emploi`), associe-la à ton espace, crée-la.
3. Copie le **Internal Integration Secret** (commence par `ntn_` ou `secret_`).

### c) Partager la base avec l'intégration

1. Ouvre ta base Notion → menu **⋯** en haut à droite → **Connections** (ou *Add connections*).
2. Sélectionne ton intégration `Veille Emploi`.

> ⚠️ **Ne confonds pas les deux valeurs Notion** (piège classique) :
> - le **jeton** commence par `ntn_…` → il va dans le **credential n8n** (étape ci-dessous), **jamais** dans `.env` ;
> - l'**ID de la base** fait 32 caractères hexadécimaux → il va dans `NOTION_DATABASE_ID` du `.env`.

### d) Récupérer l'ID de la base

Ouvre la base en pleine page. L'URL ressemble à :

```
https://www.notion.so/monespace/8a1b2c3d4e5f6071829304a5b6c7d8e9?v=...
                                └──────────── ID de la base (32 caractères) ────────────┘
```

Copie les **32 caractères** avant le `?`. Colle-les dans `.env` :

```
NOTION_DATABASE_ID=8a1b2c3d4e5f6071829304a5b6c7d8e9
```

Puis relance n8n pour prendre en compte la variable : `docker compose up -d`.

**Où coller le secret Notion dans n8n :**

1. **Credentials → Add credential → Notion API**.
2. **Name** : `Notion - Veille Emploi` ← *exactement ce nom.*
3. **Internal Integration Secret** : *ton secret Notion*.
4. **Save**.

> **Pourquoi l'intégration interne plutôt qu'OAuth ?** Pour une base personnelle, l'intégration
> interne est la plus simple : un seul secret, pas de flux d'autorisation. On la réserve à sa
> propre base, ce qui est exactement notre cas.

---

## 5. Importer et configurer le workflow

### Import

**Option A (interface, la plus simple) :**
n8n → menu **⋯** (en haut à droite) → **Import from File** → choisis
`workflows/veille-emploi.json`.

**Option B (script, si tu as créé une clé n8n API) :**
```bash
N8N_API_KEY=ta_cle node scripts/import-workflow.js
```
(La clé se crée dans n8n → **Settings → n8n API**.)

### Brancher les credentials

Ouvre le workflow. Sur chaque nœud coloré, vérifie que le bon credential est sélectionné (les noms
correspondent à ceux définis plus haut) :

| Nœud | Credential attendu |
|---|---|
| Gmail - Alerte Emploi | `Gmail - Alerte Emploi` |
| Extraction IA (Gemini) | `Gemini API` |
| Enregistrer dans Notion | `Notion - Veille Emploi` |
| Notifier par e-mail | `Gmail - Alerte Emploi` |

> Sur le nœud **Enregistrer dans Notion**, ouvre la liste **Database** et re-sélectionne ta base
> pour que n8n récupère les propriétés exactes. Vérifie que les champs `Entreprise`, `Lieu`,
> `Lien`, `Date d'ajout` sont bien mappés.

---

## 6. Activer et tester

1. En haut à droite du workflow, bascule le bouton **Active**.
2. Envoie-toi (ou attends) un e-mail d'alerte emploi qui correspond à `GMAIL_SEARCH_QUERY`.
3. Reviens dans n8n → onglet **Executions** : tu dois voir une exécution réussie.
4. Vérifie que la nouvelle offre apparaît dans ta base Notion et que tu as reçu l'e-mail récap.

> **Pour tester sans attendre :** ouvre le workflow, clique **Execute workflow** puis, sur le nœud
> Gmail Trigger, choisis un e-mail existant à rejouer. Tu peux aussi *pin* une donnée de test sur
> le premier nœud.

---

## Récapitulatif des noms exacts à respecter

| Élément | Nom exact |
|---|---|
| Credential Gemini (Header Auth) | `Gemini API` |
| Credential Gmail (OAuth2) | `Gmail - Alerte Emploi` |
| Credential Notion (API) | `Notion - Veille Emploi` |
| Variable base Notion (`.env`) | `NOTION_DATABASE_ID` |
| Variable adresse notif (`.env`) | `NOTIFICATION_EMAIL` |
