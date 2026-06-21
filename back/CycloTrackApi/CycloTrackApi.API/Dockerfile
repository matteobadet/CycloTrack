FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["CycloTrackApi.API/CycloTrackApi.API.csproj", "CycloTrackApi.API/"]
COPY ["CycloTrackApi.Core/CycloTrackApi.Core.csproj", "CycloTrackApi.Core/"]
COPY ["CycloTrackApi.Infrastructure/CycloTrackApi.Infrastructure.csproj", "CycloTrackApi.Infrastructure/"]
RUN dotnet restore "CycloTrackApi.API/CycloTrackApi.API.csproj"
COPY . .
RUN dotnet build "CycloTrackApi.API/CycloTrackApi.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CycloTrackApi.API/CycloTrackApi.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CycloTrackApi.API.dll"]
