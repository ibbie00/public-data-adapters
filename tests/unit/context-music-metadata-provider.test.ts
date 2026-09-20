import assert from "node:assert/strict";
import test from "node:test";
import {
  createMusicMetadataApiProvider,
  getContextProviderCatalog,
  getContextResearchProviders,
  runCredentialGatedProviderSmoke
} from "../../src/lib/context-enrichment/index";

const enabledEnv = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_MUSIC_METADATA_ENABLED: "true",
  LASTFM_API_KEY: "secret-lastfm-key",
  NODE_ENV: "test",
  SPOTIFY_CLIENT_ID: "secret-spotify-id",
  SPOTIFY_CLIENT_SECRET: "secret-spotify-secret"
} as NodeJS.ProcessEnv;

test("music metadata provider is disabled by default", async () => {
  const provider = createMusicMetadataApiProvider();

  assert.equal(
    getContextResearchProviders({ NODE_ENV: "test" } as NodeJS.ProcessEnv).some(
      (item) => item.providerType === "music_metadata"
    ),
    false
  );
  assert.equal(
    (await provider.searchWithStatus("Radiohead", {
      env: { NODE_ENV: "test" } as NodeJS.ProcessEnv
    })).status,
    "PROVIDER_DISABLED"
  );
});

test("music metadata provider uses Spotify client credentials and stores metadata only", async () => {
  const provider = createMusicMetadataApiProvider({
    fetchImpl: async (url, init) => {
      if (url.hostname === "accounts.spotify.com") {
        assert.equal(init?.method, "POST");
        assert.equal((init?.headers as Record<string, string>).authorization?.startsWith("Basic "), true);
        return Response.json({ access_token: "spotify-access-token", token_type: "Bearer" });
      }

      assert.equal(url.hostname, "api.spotify.com");
      assert.equal(url.searchParams.get("q"), "Radiohead");
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer spotify-access-token");
      return Response.json({
        artists: {
          items: [
            {
              external_urls: { spotify: "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb" },
              genres: ["alternative rock", "art rock"],
              id: "4Z8W4fKeB5YxbusRsdQVPb",
              name: "Radiohead",
              popularity: 80,
              type: "artist"
            }
          ]
        },
        tracks: { items: [] },
        albums: { items: [] }
      });
    },
    now: () => new Date("2026-05-31T00:00:00.000Z")
  });
  const result = await provider.searchWithStatus("Radiohead", {
    env: enabledEnv,
    limit: 1
  });
  const asset = provider.normalize(result.results[0]!);

  provider.validate(asset);

  assert.equal(result.status, "OK");
  assert.equal(asset.providerType, "music_metadata");
  assert.equal(asset.assetType, "MUSIC_METADATA_CONTEXT");
  assert.equal(asset.sourceName, "Spotify");
  assert.equal(asset.sourceIdentifier, "spotify:4Z8W4fKeB5YxbusRsdQVPb");
  assert.equal(asset.sourceTitle, "Radiohead");
  assert.equal(asset.keyPoints?.includes("contentStoragePolicy:metadata_only"), true);
  assert.equal(asset.modelMetadata?.contentStoragePolicy, "metadata_only");
});

test("music metadata provider falls back to Last.fm when Spotify is unavailable", async () => {
  const provider = createMusicMetadataApiProvider({
    fetchImpl: async (url) => {
      if (url.hostname === "accounts.spotify.com") {
        return new Response(JSON.stringify({ error: "invalid_client" }), { status: 401 });
      }

      assert.equal(url.hostname, "ws.audioscrobbler.com");
      assert.equal(url.searchParams.get("api_key"), "secret-lastfm-key");
      return Response.json({
        results: {
          artistmatches: {
            artist: [{ listeners: "1234567", mbid: "lastfm-mbid", name: "Radiohead", url: "https://www.last.fm/music/Radiohead" }]
          }
        }
      });
    }
  });
  const result = await provider.searchWithStatus("Radiohead", {
    env: enabledEnv,
    limit: 1
  });
  const asset = provider.normalize(result.results[0]!);

  provider.validate(asset);

  assert.equal(result.status, "OK");
  assert.equal(result.results[0]?.provider, "lastfm");
  assert.equal(asset.sourceName, "Last.fm");
  assert.equal(asset.sourceIdentifier, "lastfm:lastfm-mbid");
});

test("music metadata catalog and smoke are credential gated", async () => {
  const catalogEntry = getContextProviderCatalog(enabledEnv).find(
    (entry) => entry.providerType === "music_metadata"
  );
  const provider = createMusicMetadataApiProvider({
    fetchImpl: async (url) => url.hostname === "accounts.spotify.com"
      ? Response.json({ access_token: "token" })
      : Response.json({
        artists: { items: [{ id: "artist-id", name: "Radiohead", type: "artist" }] },
        tracks: { items: [] },
        albums: { items: [] }
      })
  });

  assert.equal(catalogEntry?.implementationStatus, "live_available");
  assert.equal(
    getContextResearchProviders(enabledEnv).some((item) => item.providerType === "music_metadata"),
    true
  );

  const result = await runCredentialGatedProviderSmoke({
    catalogEntry: catalogEntry!,
    env: {
      ...enabledEnv,
      CONTEXT_PROVIDER_SMOKE_ENABLED: "true"
    },
    provider,
    query: "Radiohead"
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.validationOk, true);
});

// 이름이 정확히 맞는 것이 있을 때만 좁힌다.
//
// ⚠️ 2026-08-19: 고인이 된 포크 가수를 추모하는 글에 동시대 다른 가수가 붙었고, 음악은
// 그때 자동 공개라 글쓴이가 막을 기회도 없었다. 채점기는 이것을 못 막는다. 같은 시대
// 같은 장르의 다른 가수도 그 질의에 잘 답하기 때문이다.
test("이름이 정확히 맞는 결과가 있으면 나머지를 버린다", async () => {
  const { keepNameMatches } = await import(
    "../../src/lib/context-enrichment/providers/music-metadata-api/spotify"
  );

  const kept = keepNameMatches(
    [
      { id: "1", name: "김현식" },
      { id: "2", name: "김광석" },
      { id: "3", name: "김광석 다시 부르기" }
    ] as never,
    "김광석"
  );

  assert.deepEqual(kept.map((item) => item.name), ["김광석"]);
});

// ⚠️ 부분 일치로 좁혔다가 되돌린 자리다. `아이유` 로 부분 일치를 걸면 `아이유브이`(다른
// 팀)가 남고 `IU`(정답, 로마자로 등록)가 빠진다. 한 질의에서 정답을 버리고 오답을
// 남기므로 필터가 없느니만 못하다.
test("정확히 맞는 것이 없으면 목록을 그대로 둔다", async () => {
  const { keepNameMatches } = await import(
    "../../src/lib/context-enrichment/providers/music-metadata-api/spotify"
  );

  const items = [{ id: "1", name: "IU" }, { id: "2", name: "아이유브이" }];
  const kept = keepNameMatches(items as never, "아이유");

  assert.equal(kept.length, 2, "정확 일치가 없으면 채점기가 고르도록 남긴다");
});

test("앨범은 수록 가수 이름으로도 맞춘다", async () => {
  const { keepNameMatches } = await import(
    "../../src/lib/context-enrichment/providers/music-metadata-api/spotify"
  );

  const kept = keepNameMatches(
    [
      { artists: [{ name: "김현식" }], id: "1", name: "비처럼 음악처럼" },
      { artists: [{ name: "김광석" }], id: "2", name: "다시 부르기" }
    ] as never,
    "김광석"
  );

  assert.deepEqual(kept.map((item) => item.id), ["2"]);
});
