SELECT "TrackName", "ArtistName",
       ROUND(AVG("Watts")::numeric,0) as avg_watts,
       ROUND(AVG("SpeedKmh")::numeric,1) as avg_speed,
       SUM("ElevDeltaM") as total_elev
FROM "RideTracks"
WHERE "RideId" = 'c4f7e2a1-8b3d-4e9f-a0c5-d6e7f8a9b0c1'
GROUP BY "TrackName", "ArtistName"
ORDER BY avg_watts DESC;
