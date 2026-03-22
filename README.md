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

### Synchronisation

- Au retour du réseau, les commandes en attente sont automatiquement envoyées au serveur
- La synchronisation s'exécute toutes les 30 secondes quand l'appareil est en ligne
- Les commandes synchronisées sont marquées comme telles dans IndexedDB

## Vérifier que tout fonctionne

1. **Frontend accessible** : ouvrir http://localhost:8080
2. **Backend santé** : `curl http://localhost:8080/health` → `{"status":"ok","db":"connected",...}`
3. **Catalogue chargé** : `curl http://localhost:8080/api/products` → liste JSON des produits
4. **PWA installable** : sur mobile, "Ajouter à l'écran d'accueil"
5. **Offline** : activer le mode avion → l'application reste fonctionnelle
6. **Sync** : créer une commande offline → désactiver le mode avion → la commande est synchronisée

## API Backend

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Statut du serveur et de la DB |
| GET | `/api/products` | Liste des produits actifs |
| POST | `/api/orders` | Créer une commande |
| POST | `/api/orders/sync` | Synchroniser des commandes offline (batch) |

## Schéma base de données

- **categories** : id, name, display_order
- **products** : id, name, icon, normal_price, hh_price, hh_bonus, category_id, display_order, active
- **orders** : id, client_id, total, is_happy_hour, payment_given, payment_change, status, created_at, synced_from_offline
- **order_lines** : id, order_id, product_id, product_name, quantity, unit_price, subtotal, is_bonus

Le schéma et les données initiales sont créés automatiquement au démarrage du backend.

## Remplacement du logo

Pour utiliser votre propre logo :

1. Placez vos fichiers dans `frontend/public/` :
   - `logo-192.png` (192x192 px)
   - `logo-512.png` (512x512 px)
   - `favicon.ico`
2. Reconstruisez : `docker compose up -d --build`
