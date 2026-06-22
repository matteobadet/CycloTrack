-- Sortie classique avec musique Spotify pour TestUser
-- TestUser ID: 5812a301-47d7-4169-aa4e-d286b4c11be8

INSERT INTO "Rides" (
  "Id", "UserId", "StartedAt", "EndedAt",
  "DistanceKm", "DurationSec", "ElevationGainM", "ElevationLossM",
  "AvgSpeedKmh", "MaxSpeedKmh",
  "AvgWatts", "MaxWatts", "AvgCadenceRpm",
  "AvgBpm", "MaxBpm", "CaloriesBurned",
  "FeelBefore", "CommentBefore", "AiAnalysis"
) VALUES (
  'c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1',
  '5812a301-47d7-4169-aa4e-d286b4c11be8',
  '2026-06-21 07:15:00+00',
  '2026-06-21 09:20:00+00',
  45.3, 7500, 712, 708,
  21.7, 51.4,
  201, 318, 87,
  145, 181, 1280,
  4, 'Bonne forme, playlist de feu chargée !', NULL
);

-- Quelques points GPS (route autour d'Aix-en-Provence)
INSERT INTO "RidePoints" ("RideId","Timestamp","Lat","Lng","AltitudeM","SpeedKmh","Watts","Bpm","CadenceRpm") VALUES
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 07:15:00+00',43.5297,5.4474,220,0,0,90,0),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 07:18:00+00',43.5341,5.4511,225,18.2,160,128,82),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 07:25:00+00',43.5412,5.4603,240,22.5,195,138,86),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 07:40:00+00',43.5589,5.4742,285,19.8,210,145,85),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 08:00:00+00',43.5803,5.4891,340,15.3,245,158,80),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 08:15:00+00',43.5941,5.5023,398,12.1,278,168,77),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 08:25:00+00',43.6012,5.5102,432,10.4,298,172,75),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 08:35:00+00',43.6087,5.5189,418,36.2,120,152,88),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 08:45:00+00',43.5934,5.5341,372,44.8,95,141,90),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 08:55:00+00',43.5712,5.5198,320,38.1,180,148,89),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 09:05:00+00',43.5521,5.5072,268,29.4,215,151,87),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 09:15:00+00',43.5341,5.4892,232,25.7,198,144,86),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2026-06-21 09:20:00+00',43.5297,5.4474,222,12.0,80,128,75);

-- Tracks Spotify avec audio features et métriques de ride
-- 1. Thunderstruck - AC/DC  (début de sortie, mise en jambes)
INSERT INTO "RideTracks" ("RideId","SpotifyTrackId","TrackName","ArtistName","AlbumArtUrl","Tempo","Energy","Valence","PolledAt","SpeedKmh","Watts","Bpm","ElevDeltaM") VALUES
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','57bgtDP4U6zkMWDCBqxGCt','Thunderstruck','AC/DC','https://i.scdn.co/image/ab67616d0000b273cb4e17d7ef2836bde1a2eb82',133,0.98,0.47,'2026-06-21 07:20:00+00',18.2,160,128,8),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','57bgtDP4U6zkMWDCBqxGCt','Thunderstruck','AC/DC','https://i.scdn.co/image/ab67616d0000b273cb4e17d7ef2836bde1a2eb82',133,0.98,0.47,'2026-06-21 07:20:30+00',20.1,178,132,6),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','57bgtDP4U6zkMWDCBqxGCt','Thunderstruck','AC/DC','https://i.scdn.co/image/ab67616d0000b273cb4e17d7ef2836bde1a2eb82',133,0.98,0.47,'2026-06-21 07:21:00+00',22.4,195,136,5),

-- 2. Eye of the Tiger - Survivor (montée progressive)
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2HHtWyy5CgaQbC7XSoOb0e','Eye of the Tiger','Survivor','https://i.scdn.co/image/ab67616d0000b273b89faa53d039b7f4fa05898b',109,0.92,0.73,'2026-06-21 07:45:00+00',19.8,210,145,12),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2HHtWyy5CgaQbC7XSoOb0e','Eye of the Tiger','Survivor','https://i.scdn.co/image/ab67616d0000b273b89faa53d039b7f4fa05898b',109,0.92,0.73,'2026-06-21 07:45:30+00',18.3,225,148,15),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','2HHtWyy5CgaQbC7XSoOb0e','Eye of the Tiger','Survivor','https://i.scdn.co/image/ab67616d0000b273b89faa53d039b7f4fa05898b',109,0.92,0.73,'2026-06-21 07:46:00+00',16.9,238,152,18),

-- 3. Lose Yourself - Eminem (col, effort max)
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','5Z01UMMf7V1o0MzF86s6WJ','Lose Yourself','Eminem','https://i.scdn.co/image/ab67616d0000b2737b06b1b0a6c4e2e8a8aa8d74',171,0.90,0.44,'2026-06-21 08:05:00+00',13.2,265,162,22),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','5Z01UMMf7V1o0MzF86s6WJ','Lose Yourself','Eminem','https://i.scdn.co/image/ab67616d0000b2735d2d4857534b471f4a8a8d74',171,0.90,0.44,'2026-06-21 08:05:30+00',11.8,285,167,25),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','5Z01UMMf7V1o0MzF86s6WJ','Lose Yourself','Eminem','https://i.scdn.co/image/ab67616d0000b2735d2d4857534b471f4a8a8d74',171,0.90,0.44,'2026-06-21 08:06:00+00',10.4,298,171,28),

-- 4. Pump It - Black Eyed Peas (sommet + début descente)
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','6NmXLjk33uBFBbFJvyB8MX','Pump It','Black Eyed Peas','https://i.scdn.co/image/ab67616d0000b273e8d0b5a4fa8a8d74a1b2c3d4',136,0.93,0.86,'2026-06-21 08:28:00+00',10.8,275,169,5),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','6NmXLjk33uBFBbFJvyB8MX','Pump It','Black Eyed Peas','https://i.scdn.co/image/ab67616d0000b273e8d0b5a4fa8a8d74a1b2c3d4',136,0.93,0.86,'2026-06-21 08:28:30+00',22.4,185,158,2),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','6NmXLjk33uBFBbFJvyB8MX','Pump It','Black Eyed Peas','https://i.scdn.co/image/ab67616d0000b273e8d0b5a4fa8a8d74a1b2c3d4',136,0.93,0.86,'2026-06-21 08:29:00+00',38.1,140,149,-10),

-- 5. Don't Stop Me Now - Queen (descente rapide, vitesse max)
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','5T8EDUDqKcs6OSOwEsfqG7','Don''t Stop Me Now','Queen','https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',156,0.84,0.97,'2026-06-21 08:40:00+00',44.8,105,142,-18),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','5T8EDUDqKcs6OSOwEsfqG7','Don''t Stop Me Now','Queen','https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',156,0.84,0.97,'2026-06-21 08:40:30+00',51.4,88,138,-20),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','5T8EDUDqKcs6OSOwEsfqG7','Don''t Stop Me Now','Queen','https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a',156,0.84,0.97,'2026-06-21 08:41:00+00',48.2,95,140,-15),

-- 6. Welcome to the Jungle - Guns N Roses (retour, rythme de croisière)
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','0o4CT4hL93GMiLGSFAMHlJ','Welcome to the Jungle','Guns N'' Roses','https://i.scdn.co/image/ab67616d0000b273a2e5b2b2c3d4e5f6a7b8c9d0',130,0.96,0.52,'2026-06-21 09:00:00+00',29.4,205,148,-5),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','0o4CT4hL93GMiLGSFAMHlJ','Welcome to the Jungle','Guns N'' Roses','https://i.scdn.co/image/ab67616d0000b273a2e5b2b2c3d4e5f6a7b8c9d0',130,0.96,0.52,'2026-06-21 09:00:30+00',31.2,198,145,-3),
('c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1','0o4CT4hL93GMiLGSFAMHlJ','Welcome to the Jungle','Guns N'' Roses','https://i.scdn.co/image/ab67616d0000b273a2e5b2b2c3d4e5f6a7b8c9d0',130,0.96,0.52,'2026-06-21 09:01:00+00',28.7,212,147,0);
