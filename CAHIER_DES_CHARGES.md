# CycloTrack — Cahier des charges

## 1. Vision du projet

**CycloTrack** est un écosystème composé d'une **application mobile** (tracking en temps réel) et d'une **application web** (dashboard, historique, objectifs, social), destiné aux cyclistes souhaitant suivre leurs performances et recevoir des conseils personnalisés d'un coach IA.

---

## 2. Périmètre

| Composant       | Description                                                      |
|-----------------|------------------------------------------------------------------|
| Mobile (iOS + Android) | Tracking GPS, capteurs BLE, bilan IA post-sortie          |
| Web             | Historique des sorties, objectifs, classement, feed social       |
| Backend         | API REST partagée, stockage des données, intégration Claude API  |

---

## 3. Utilisateurs

- **Multi-utilisateurs** : chaque utilisateur possède un compte avec ses propres données
- **Profil personnel** : taille, poids (utilisés pour le calcul des calories et watts estimés)
- **Authentification** : JWT + refresh token (même pattern que RandoHost)

---

## 4. Application mobile

### 4.1 Avant la sortie

- Saisie du **ressenti avant la sortie** (forme du jour : 1–5 étoiles + commentaire libre)
- Vérification / mise à jour du profil (poids du jour, taille)
- **Planification d'itinéraire** :
  - Import d'un fichier GPX
  - Tracé manuel sur la carte
  - Affichage du profil altimétrique de l'itinéraire planifié

### 4.2 Pendant la sortie (mode temps réel)

Toutes les fonctionnalités suivantes fonctionnent **hors-ligne** (données stockées localement, synchronisées au retour réseau).

| Donnée            | Source                                              |
|-------------------|-----------------------------------------------------|
| Position GPS      | GPS natif du téléphone                              |
| Tracé du parcours | Carte temps réel (MapLibre / Mapbox)                |
| Vitesse           | Calculée depuis GPS                                 |
| Dénivelé          | Calculé depuis GPS (altitude)                       |
| Puissance (watts) | Capteur CYCPLUS M1 via BLE (Cycling Power Service `0x1818`) |
| Cadence (rpm)     | Capteur CYCPLUS M1 via BLE                          |
| Fréquence cardiaque | Capteur CYCPLUS H2PRO via BLE (Heart Rate Service `0x180D`) |
| Calories brûlées  | Calculées : poids + durée + watts moyens            |

**Affichage pendant la sortie :**
- Carte avec position en temps réel + itinéraire planifié (si défini)
- Tableau de bord : vitesse actuelle / moyenne, watts, BPM, cadence, dénivelé cumulé, distance, chrono
- Alertes de déconnexion capteur BLE

**Contrôles :**
- Démarrer / Pause / Reprendre / Terminer la sortie

### 4.3 Après la sortie

- **Récapitulatif complet** : distance, durée, vitesse moy/max, watts moy/max, BPM moy/max, dénivelé +/-, calories, cadence moyenne
- **Carte du trajet** réalisé
- **Profil altimétrique** du trajet réalisé
- Bouton **"Obtenir le bilan coach"** → appel à l'IA

#### Prompt IA (coach vélo)

```
Tu es un coach professionnel de cyclisme. Analyse cette sortie et donne des conseils 
personnalisés pour que la prochaine sortie soit encore meilleure.

Données du cycliste :
- Taille : {taille} cm, Poids : {poids} kg
- Ressenti avant sortie : {ressenti}/5 — "{commentaire}"

Données de la sortie :
- Distance : {distance} km
- Durée : {duree}
- Dénivelé positif : {dplus} m / négatif : {dmoins} m
- Vitesse moyenne : {vit_moy} km/h / max : {vit_max} km/h
- Puissance moyenne : {watts_moy} W / max : {watts_max} W
- Cadence moyenne : {cadence_moy} rpm
- Fréquence cardiaque moyenne : {bpm_moy} bpm / max : {bpm_max} bpm
- Calories brûlées : {calories} kcal

Donne un bilan structuré : points positifs, points à améliorer, conseils concrets 
pour la prochaine sortie (entraînement, nutrition, récupération).
```

- Le bilan IA est **sauvegardé avec la sortie** et visible dans le dashboard web
- Synchronisation automatique vers le serveur dès qu'une connexion réseau est disponible

---

## 5. Application web (dashboard)

### 5.1 Historique des sorties

- Liste de toutes les sorties (date, distance, durée, watts moy, dénivelé)
- Page détail d'une sortie : carte + tous les graphiques + bilan IA associé
- Filtres : par période, par type (montagne / plat / mixte selon dénivelé)
- Export GPX d'une sortie

### 5.2 Statistiques personnelles

- Graphiques de progression sur le temps : watts, BPM, vitesse, dénivelé
- Totaux : km parcourus, heures en selle, dénivelé cumulé, calories (semaine / mois / année)
- Record personnels (PR) : vitesse max, watts max, plus longue sortie, etc.

### 5.3 Objectifs

Chaque objectif a une période (semaine / mois / année) et un indicateur de progression.

| Type d'objectif       | Exemple                                    |
|-----------------------|--------------------------------------------|
| Distance totale       | 500 km ce mois-ci                          |
| Dénivelé cumulé       | 5 000 m ce mois-ci                         |
| Nombre de sorties     | 3 sorties par semaine                      |
| Objectif performance  | Atteindre 250 W de moyenne sur une sortie  |

- Notification / badge quand un objectif est atteint
- Historique des objectifs passés (atteints / manqués)

### 5.4 Social

- **Feed** : voir les sorties récentes des autres membres (distance, dénivelé, carte miniature)
- **Classement** : hebdomadaire / mensuel par distance, dénivelé, ou watts moyens
- **Profil public** : stats globales d'un utilisateur (optionnel : rendre son profil privé)
- Pas de commentaires ni de likes dans la v1 — focus sur les données

---

## 6. Contraintes techniques

### Offline mobile (priorité haute)

- Le tracking GPS + capteurs BLE fonctionne sans réseau
- Les données sont stockées localement (SQLite via expo-sqlite ou MMKV)
- Synchronisation automatique en arrière-plan dès que le réseau revient
- Gestion des conflits : last-write-wins sur les sorties (une sortie = un UUID local généré au démarrage)

### Capteurs BLE

- **CYCPLUS M1** : Cycling Power Service BLE (`0x1818`) → watts + cadence
- **CYCPLUS H2PRO** : Heart Rate Service BLE (`0x180D`) → BPM
- Reconnexion automatique si perte de signal capteur
- Indicateur visuel de l'état de chaque capteur (connecté / déconnecté / signal faible)

### IA

- Modèle : **Claude API** (`claude-sonnet-4-6` ou supérieur)
- Appel déclenché manuellement (bouton) après la sortie
- Timeout 30s avec message d'erreur explicite si indisponible
- Le bilan IA est stocké en base et ne peut pas être régénéré (coût API)

---

## 7. Stack technologique envisagée

| Couche          | Technologie                                      |
|-----------------|--------------------------------------------------|
| Mobile          | React Native + Expo (iOS + Android)              |
| Capteurs BLE    | `react-native-ble-plx`                           |
| Cartes mobile   | MapLibre GL (open source)                        |
| Stockage local  | expo-sqlite (offline)                            |
| Web frontend    | React + Vite (même pattern que RandoHost)        |
| Backend API     | ASP.NET Core 9 (même stack que RandoHost)        |
| Base de données | PostgreSQL                                       |
| IA              | Claude API (Anthropic)                           |
| Auth            | JWT + refresh token (même pattern que RandoHost) |
| Infra           | Docker Compose                                   |

---

## 8. Ce qui est hors périmètre (v1)

- Navigation turn-by-turn (guidage vocal)
- Intégration Strava / Garmin Connect
- Segments (style Strava KOM)
- Plans d'entraînement automatisés
- Commentaires / likes sur les sorties
- Application desktop

---

## 9. Priorités de développement (ordre suggéré)

1. **Backend** : auth, modèle de données sorties, API REST
2. **Mobile** : tracking GPS offline + synchronisation
3. **Mobile** : connexion capteurs BLE (M1 + H2PRO)
4. **Mobile** : bilan IA post-sortie
5. **Web** : dashboard historique + stats
6. **Web** : objectifs
7. **Web** : social (feed + classement)
