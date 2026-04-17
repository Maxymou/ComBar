# ComBar - Béarn Bigorre

Application PWA mobile-first de caisse / prise de commande pour bar et restauration rapide.

## Ce que fait l'application

- Prise de commande tactile rapide (boissons, consignes, sandwiches)
- Mode Happy Hour avec prix réduits et shooters offerts
- Récapitulatif de commande avec suivi de préparation
- Calculateur de monnaie (billets et pièces, rendu monnaie)
- Fonctionne **hors ligne** (PWA offline-first)
- Synchronise les commandes au retour du réseau
- Installable sur iOS et Android (ajout à l'écran d'accueil)
- **Déduplication des commandes** via `clientOrderId` (pas de doublons)
- **Validation serveur** des commandes (totaux, quantités, prix)
- **Éditeur de prix protégé** par PIN admin

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 18, TypeScript, Vite 5, vite-plugin-pwa |
| Backend | Node.js 20, Express, TypeScript |
| Base de données | PostgreSQL 16 |
| Offline | IndexedDB (via `idb`), Service Worker (Workbox) |
| Conteneurisation | Docker, Docker Compose |
| Reverse proxy | Nginx (dans le conteneur frontend) |

## Structure du projet

```
ComBar/
├── frontend/               # Application React PWA
│   ├── Dockerfile
│   ├── nginx.conf          # Config Nginx (SPA + proxy API)
│   ├── package.json
│   ├── vite.config.ts
│   ├── public/             # Assets statiques (logos, favicon)
│   └── src/
│       ├── App.tsx          # Composant principal
│       ├── App.css          # Styles complets
│       ├── components/      # Header, ProductGrid, Summary, Payment, PriceEditor
│       ├── data/            # Catalogue par défaut, dénominations monnaie
│       ├── hooks/           # useProducts, useOnlineStatus
│       ├── services/        # IndexedDB (db.ts), API (api.ts), Sync (sync.ts)
│       └── types/           # Types TypeScript
├── backend/                # API Express
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.ts         # Point d'entrée, attente DB, init
│       ├── db/              # Pool PostgreSQL, init schéma + seed
│       └── routes/          # health, products, orders
├── docker-compose.yml
├── .env.example
└── README.md
```

## Lancement

### Prérequis

- Docker
- Docker Compose

Aucune autre dépendance n'est nécessaire.

### Démarrer

```bash
docker compose up -d
```

L'application est accessible sur **http://localhost:8080** (port configurable).

### Arrêter

```bash
docker compose down
```

### Reconstruire après modification

```bash
docker compose up -d --build
```

### Réinitialiser la base de données

```bash
docker compose down -v
docker compose up -d
```

## Variables d'environnement

Copier `.env.example` en `.env` pour personnaliser :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `DB_NAME` | `combar` | Nom de la base PostgreSQL |
| `DB_USER` | `combar` | Utilisateur PostgreSQL |
| `DB_PASSWORD` | `combar` | Mot de passe PostgreSQL |
| `APP_PORT` | `8080` | Port d'accès à l'application |
| `VITE_ENABLE_PWA` | `true` | Active le Service Worker et l'installabilité PWA du frontend |

## Ports exposés

| Port | Service |
|------|---------|
| 8080 (configurable) | Frontend (Nginx) + proxy API |
| 3001 (interne) | Backend API (non exposé, accès via Nginx) |
| 5432 (interne) | PostgreSQL (non exposé) |

## Fonctionnement offline

### Stratégie

1. **Au premier chargement** : le Service Worker met en cache tous les assets (HTML, CSS, JS, images, polices)
2. **Le catalogue produits** est stocké dans IndexedDB et rechargé depuis l'API quand disponible
3. **Les commandes** sont toujours sauvegardées en local (IndexedDB) avant d'être envoyées au serveur
4. **Un indicateur visuel** affiche le statut réseau (en ligne / hors ligne) et le nombre de commandes en attente

### Ce qui fonctionne sans réseau

- Affichage complet de l'application
- Catalogue produits (depuis le cache local)
- Prise de commande
- Calcul des totaux
- Mode Happy Hour
- Calculateur de monnaie
- Enregistrement des commandes en local

### Synchronisation et sécurité

- Au retour du réseau, les commandes en attente sont automatiquement envoyées au serveur
- La synchronisation s'exécute toutes les 30 secondes quand l'appareil est en ligne
- Chaque commande porte un **`clientOrderId`** (UUID v4 généré côté client)
- Le backend utilise ce `clientOrderId` pour **garantir l'idempotence** : une commande ne peut jamais être insérée deux fois, même en cas de retry réseau ou de double sync
- Les commandes synchronisées sont **automatiquement supprimées** d'IndexedDB après confirmation serveur
- En cas d'échec partiel, seules les commandes réussies sont supprimées ; les autres seront réessayées au prochain cycle

### Validation serveur

Le backend **ne fait jamais confiance au frontend** :
- Chaque ligne est validée : `quantity > 0`, `unitPrice >= 0`, `subtotal = quantity × unitPrice`
- Le total est **recalculé côté serveur** (le total client est ignoré en cas de différence)
- Les prix sont comparés avec la base de données ; si un prix a été modifié côté client (via l'éditeur de prix), la commande est acceptée mais marquée `client_priced = true`

## Éditeur de prix

L'accès à l'éditeur de prix est protégé par un **PIN admin** (par défaut : `0000`).

Pour y accéder : cliquer sur le logo dans le header → saisir le PIN.

Le PIN est stocké localement dans IndexedDB (clé `adminPin`).

## Vérifier que tout fonctionne

1. **Frontend accessible** : ouvrir http://localhost:8080
2. **Backend santé** : `curl http://localhost:8080/health` → `{"status":"ok","db":"connected",...}`
3. **Catalogue chargé** : `curl http://localhost:8080/api/products` → liste JSON des produits
4. **PWA installable** : sur mobile, "Ajouter à l'écran d'accueil"
5. **Offline** : activer le mode avion → l'application reste fonctionnelle
6. **Sync** : créer une commande offline → désactiver le mode avion → la commande est synchronisée
7. **Idempotence** : envoyer deux fois la même commande → une seule commande en base

## API Backend

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Statut du serveur et de la DB |
| GET | `/api/products` | Liste des produits actifs |
| POST | `/api/orders` | Créer une commande (idempotent via `clientOrderId`) |
| POST | `/api/orders/sync` | Synchroniser des commandes offline (batch, idempotent) |

### Format d'une commande (POST /api/orders)

```json
{
  "clientOrderId": "550e8400-e29b-41d4-a716-446655440000",
  "total": 10.00,
  "isHappyHour": false,
  "paymentGiven": 20.00,
  "paymentChange": 10.00,
  "lines": [
    {
      "productId": "biere25",
      "productName": "Bière 25cl",
      "quantity": 5,
      "unitPrice": 2.00,
      "subtotal": 10.00,
      "isBonus": false
    }
  ]
}
```

Le `clientOrderId` est optionnel mais **fortement recommandé** pour éviter les doublons.

## Schéma base de données

- **categories** : id, name, display_order
- **products** : id, name, icon, normal_price, hh_price, hh_bonus, category_id, display_order, active
- **orders** : id, **client_order_id** (UNIQUE), client_id, total, is_happy_hour, payment_given, payment_change, status, created_at, synced_from_offline, **client_priced**
- **order_lines** : id, order_id, product_id, product_name, quantity, unit_price, subtotal, is_bonus

Le schéma, les migrations et les données initiales sont créés automatiquement au démarrage du backend.

### Colonnes ajoutées (hardening)

| Colonne | Table | Description |
|---------|-------|-------------|
| `client_order_id` | orders | UUID client pour déduplication (UNIQUE) |
| `client_priced` | orders | `true` si un prix a été modifié côté client par rapport à la DB |

## Remplacement du logo

Pour utiliser votre propre logo :

1. Placez vos fichiers dans `frontend/public/` :
   - `logo-192.png` (192x192 px)
   - `logo-512.png` (512x512 px)
   - `favicon.ico`
2. Reconstruisez : `docker compose up -d --build`
