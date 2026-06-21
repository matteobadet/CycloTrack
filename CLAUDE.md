# CycloTrack — Contexte global

Application de tracking vélo avec coaching IA, déployée en microservices Docker sur le même serveur que RandoHost.

## Architecture

```
CycloTrack/
├── back/
│   └── CycloTrackApi/    → API unique ASP.NET Core 9 (auth + rides + social + IA)
├── web/                  → Dashboard React 19 + Vite (SPA, port 82 via nginx)
├── mobile/               → App React Native + Expo (iOS + Android)
└── docker-compose.yml
```

## Services Docker

| Service          | Image           | Port hôte | Usage                        |
|------------------|-----------------|-----------|------------------------------|
| `web`            | nginx:1.27-alpine | 82      | SPA React + proxy vers l'API |
| `cyclo-api`      | build local     | 5002      | API unifiée                  |
| `postgres-cyclo` | postgres:16     | 5435      | BDD cyclotrack               |

> Ports choisis pour éviter les conflits avec RandoHost (80, 5000, 5001, 5433, 5434)

## Proxy nginx

L'API est proxifiée via nginx :
- `/cyclo-api/` → `http://cyclo-api:8080/`

URL côté frontend (substituée au runtime par `entrypoint.sh`) :
- `VITE_API_URL = http://localhost:82/cyclo-api`

## Authentification

- **JWT Bearer** avec `MapInboundClaims = false`, `ClockSkew = TimeSpan.Zero`
- **Access token** : 15 min, stocké en mémoire (Zustand)
- **Refresh token** : 7 jours, cookie HttpOnly `refresh_token`
- Intercepteur axios : 401 → refresh → retry

## Modèle de données

- **User** : Id, Email, PasswordHash, Pseudo, Height, Weight, Role, CreatedAt
- **Ride** : Id, UserId, StartedAt, EndedAt, Distance, DurationSec, ElevationGain, ElevationLoss, AvgSpeed, MaxSpeed, AvgWatts, MaxWatts, AvgBpm, MaxBpm, AvgCadence, CaloriesBurned, FeelBefore, CommentBefore, AiAnalysis
- **RidePoint** : Id, RideId, Timestamp, Lat, Lng, Altitude, Speed, Watts, Bpm, Cadence
- **Goal** : Id, UserId, Type, TargetValue, Period, StartDate, EndDate, IsAchieved
- **Follow** : FollowerId, FollowedId, CreatedAt

## Capteurs BLE (mobile)

- **CYCPLUS M1** : Cycling Power Service `0x1818` → watts + cadence
- **CYCPLUS H2PRO** : Heart Rate Service `0x180D` → BPM
- Lib : `react-native-ble-plx`

## Commandes utiles

```bash
# Démarrer tous les services
docker compose up -d

# Rebuild l'API
docker compose up -d --build cyclo-api

# Rebuild le web
docker compose up -d --build web

# Voir les logs
docker compose logs -f cyclo-api

# Accès BDD
docker exec cyclotrack-postgres-cyclo-1 psql -U postgres -d cyclotrack

# Mobile (depuis le dossier mobile/)
npx expo start
```

## Stack technique

| Couche    | Technologie                                          |
|-----------|------------------------------------------------------|
| API       | ASP.NET Core 9, EF Core, Npgsql, JWT, Swagger        |
| Web       | React 19, Vite, TanStack Query, Zustand, Tailwind    |
| Mobile    | React Native, Expo, react-native-ble-plx, expo-sqlite |
| BDD       | PostgreSQL 16                                         |
| IA        | Claude API (claude-sonnet-4-6)                        |
| Infra     | Docker Compose, nginx                                 |
