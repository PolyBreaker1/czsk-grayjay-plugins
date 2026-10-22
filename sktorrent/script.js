/// <reference path="./script.d.ts" />
/*
 * SkTOnline — Grayjay plugin (online.sktorrent.eu)
 *
 * search   : GET /search/videos?search_query=<q>  -> HTML cards (div.well.well-sm)
 * home     : GET /                      -> HTML (same card markup)
 * details  : GET /video/<id>            -> <source .../h264/<id>_720p.mp4> + <track>
 *
 * NOTE: Grayjay's JS runtime has no DOMParser/querySelectorAll -> regex parsing.
 */
const PLATFORM = "SkTOnline";
const ID = "95f08c53-4f92-46c5-b1ff-9b9bb718ebf0";
const SITE = "https://online.sktorrent.eu";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

var CONF = null;

/*
 * online.sktorrent.eu serves dynamic pages with a MALFORMED gzip body:
 *   [8-byte truncated gzip header: 1f 8b 08 00 00 00 00 00]
 *   [raw zlib stream: 78 da ...]   [no gzip trailer]
 * Browsers tolerate it; strict decoders do not:
 *   - .NET (standard `http` package, AutomaticDecompression=gzip)
 *       -> "The archive entry was compressed using an unsupported compression method."
 *   - libcurl --compressed -> CURLE_BAD_CONTENT_ENCODING
 * The server DOES return clean, uncompressed HTML when the request does not
 * advertise gzip (Accept-Encoding: identity). .NET always advertises gzip, so
 * use the `httpimp` package (libcurl-impersonate) and force
 * "Accept-Encoding: identity" — a custom header overrides libcurl's built-in
 * gzip/deflate/br/zstd list, so the plain HTML arrives untouched.
 */
var H = (typeof httpimp !== "undefined") ? httpimp : http;

function hdr(extra) {
    var h = {
        "User-Agent": UA,
        "Accept-Encoding": "identity",
        "Accept-Language": "sk,cs,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
}

function abs(u) {
    if (!u) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.charAt(0) === "/") return SITE + u;
    return u;
}

function unesc(s) {
    s = s || "";
    for (var i = 0; i < 3; i++) {
        var t = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
        if (t === s) break;
        s = t;
    }
    return s;
}

function parseClock(t) {
    if (!t) return 0;
    var p = t.trim().split(":").map(function (x) { return parseInt(x, 10) || 0; });
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] || 0;
}

function parseWells(html) {
    var out = [], parts = (html || "").split('class="well well-sm"');
    for (var i = 1; i < parts.length; i++) {
        var c = parts[i];
        var hm = /href="\/video\/(\d+)\//.exec(c);
        if (!hm) continue;
        var tm = /<img src="([^"]+)"/.exec(c);
        var tlm = /<span class="video-title[^"]*">([^<]*)<\/span>/.exec(c)
               || /<img[^>]*title="([^"]*)"/.exec(c);
        var dm = /<div class="duration">([\s\S]*?)<\/div>/.exec(c);
        out.push({
            id: hm[1],
            thumb: tm ? tm[1] : "",
            name: tlm ? unesc(tlm[1]).trim() : ("Video " + hm[1]),
            dur: dm ? parseClock(dm[1].replace(/\s+/g, "")) : 0,
        });
    }
    return out;
}

function makeVideo(o) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, o.id, ID),
        name: o.name,
        thumbnails: new Thumbnails(o.thumb ? [new Thumbnail(abs(o.thumb), 0)] : []),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, "sktorrent", ID), PLATFORM, SITE),
        datetime: 0, duration: o.dur || 0,
        url: SITE + "/video/" + o.id, shareUrl: SITE + "/video/" + o.id,
        isLive: false,
    });
}

source.enable = function (conf, settings, savedState) { CONF = conf; };
source.saveState = function () {};

source.getHome = function () {
    var r = H.GET(SITE + "/", hdr());
    if (!r || !r.isOk || !r.body) return new VideoPager([], false, { home: 1 });
    return new VideoPager(parseWells(r.body).map(makeVideo), false, { home: 1 });
};

source.search = function (query, type, order, filters) {
    var r = H.GET(SITE + "/search/videos?search_query=" + encodeURIComponent(query || ""), hdr());
    if (!r || !r.isOk || !r.body) return new VideoPager([], false, {});
    return new VideoPager(parseWells(r.body).map(makeVideo), false, { query: query });
};

source.searchSuggestions = function (query, type) { return []; };

source.isContentDetailsUrl = function (url) {
    return !!url && /\/video\/\d+/.test(url);
};

source.getContentDetails = function (url) {
    var m = /\/video\/(\d+)/.exec(url || "");
    var vid = m ? m[1] : "";
    var pageUrl = SITE + "/video/" + vid;
    var r = H.GET(pageUrl, hdr());
    var body = (r && r.isOk && r.body) ? r.body : "";
    var sources = [], subtitles = [];

    var tm = /<title>([^<]+)<\/title>/.exec(body);
    var title = tm ? unesc(tm[1]).replace(/\s*[-|]\s*SkTonline.*$/i, "").replace(/\s*\|.*$/, "").trim() : "";

    var sre = /<source\b[^>]*>/g, sm;
    while ((sm = sre.exec(body)) !== null) {
        var tag = sm[0];
        var um = /src="([^"]+)"/.exec(tag);
        if (!um || um[1].indexOf(".mp4") < 0) continue;
        var lm = /label='([^']*)'/.exec(tag) || /label="([^"]*)"/.exec(tag);
        var rm = /res='([^']*)'/.exec(tag) || /res="([^"]*)"/.exec(tag);
        var res = rm ? (parseInt(rm[1], 10) || 0) : 0;
        sources.push(new VideoUrlSource({
            url: abs(um[1]),
            name: lm ? (lm[1] + "p") : "MP4",
            width: res, height: res,
            container: "video/mp4",
        }));
    }

    var tre = /<track\b[^>]*>/g, trm;
    // Grayjay's runtime does not expose a `SubtitleSource` global, so subtitle
    // tracks are intentionally skipped; the MP4 video sources are what matter.
    void tre; void trm; void subtitles;

    sources.sort(function (a, b) { return (b.height || 0) - (a.height || 0); });
    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, String(vid), ID),
        name: title,
        thumbnails: new Thumbnails([]),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, "sktorrent", ID), PLATFORM, SITE),
        url: pageUrl, shareUrl: pageUrl,
        description: "",
        video: new VideoSourceDescriptor(sources),
        subtitles: subtitles,
    });
};
