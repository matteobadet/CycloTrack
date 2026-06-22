CREATE TABLE IF NOT EXISTS "Comments" (
  "Id" uuid NOT NULL,
  "RideId" uuid NOT NULL,
  "UserId" uuid NOT NULL,
  "Text" text NOT NULL,
  "CreatedAt" timestamp with time zone NOT NULL,
  CONSTRAINT "PK_Comments" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Comments_Rides_RideId" FOREIGN KEY ("RideId") REFERENCES "Rides"("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_Comments_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IX_Comments_RideId" ON "Comments"("RideId");
CREATE INDEX IF NOT EXISTS "IX_Comments_UserId" ON "Comments"("UserId");

CREATE TABLE IF NOT EXISTS "Reactions" (
  "Id" uuid NOT NULL,
  "RideId" uuid NOT NULL,
  "UserId" uuid NOT NULL,
  "Emoji" text NOT NULL,
  "CreatedAt" timestamp with time zone NOT NULL,
  CONSTRAINT "PK_Reactions" PRIMARY KEY ("Id"),
  CONSTRAINT "FK_Reactions_Rides_RideId" FOREIGN KEY ("RideId") REFERENCES "Rides"("Id") ON DELETE CASCADE,
  CONSTRAINT "FK_Reactions_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "IX_Reactions_RideId" ON "Reactions"("RideId");
CREATE INDEX IF NOT EXISTS "IX_Reactions_UserId" ON "Reactions"("UserId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20260622000000_AddCommentsAndReactions', '9.0.17')
ON CONFLICT DO NOTHING;
