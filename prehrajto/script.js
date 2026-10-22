/// <reference path="./script.d.ts" />
/*
 * Prehraj.to — Grayjay plugin (prehrajto.cz)
 *
 * search  : GET /hledej/<query>   -> HTML (div.video__picture--container cards)
 * details : GET <detail url>      -> HTML with `videos.push({src:"https://pf-storageN.premiumcdn.net/...mp4?..."})`
 *           (anonymous, server-side extraction; URL valid ~24h)
 */
const PLATFORM = "Prehraj.to";
const ID = "9e0ed463-8a2e-4fab-a1c6-1157d076cd00";
const SITE = "https://prehrajto.cz";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const CDN_RE = /https:\/\/pf-storage\d+\.premiumcdn\.net\/\d+\/[A-Za-z0-9]+\.mp4\?[^"'\s\\]+/g;
const VTT_RE = /https:\/\/pf-storage\d+\.premiumcdn\.net\/\d+\/[A-Za-z0-9]+\.vtt\?[^"'\s\\]+/g;

var CONF = null;

function L(m) { try { if (typeof log === "function") log("[prehrajto] " + m); } catch (e) {} }

function hdr(extra) {
    var h = {
        "User-Agent": UA,
        "Accept-Language": "cs,sk,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": SITE + "/",
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

function parseClock(t) {
    if (!t) return 0;
    var p = t.trim().split(":").map(function (x) { return parseInt(x, 10) || 0; });
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] || 0;
}

function unesc(s) {
    s = s || "";
    for (var i = 0; i < 3; i++) {
        var t = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
            .replace(/&nbsp;/g, " ");
        if (t === s) break;
        s = t;
    }
    return s;
}

function videoItem(name, url, thumb, vid, dur) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, String(vid || url), ID),
        name: name,
        thumbnails: new Thumbnails(thumb ? [new Thumbnail(abs(thumb), 0)] : []),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, "prehrajto", ID), PLATFORM, SITE),
        datetime: 0, duration: dur || 0,
        url: url,
        shareUrl: url,
        isLive: false,
    });
}

source.enable = function (conf, settings, savedState) { CONF = conf; };
source.saveState = function () {};

/*
 * Grayjay's JS runtime has no DOMParser/querySelectorAll -> regex parsing.
 * Each card looks like:
 *   <div class="video__picture--container" data-video-id="27125780">
 *     <a class="video video--small video--link"
 *        href="/slug/<hex>" title="Title">
 *       <img class="thumb thumb1" src="https://thumb.prehrajto.cz//...jpg">
 *       ... <div class="video__tag video__tag--time">HH:MM:SS</div>
 *       <h3 class="video__title margin-bottom-0">Title</h3>
 */
function parseCards(html) {
    var out = [], parts = (html || "").split('class="video__picture--container"');
    for (var i = 1; i < parts.length; i++) {
        var c = parts[i];
        var idm = /data-video-id="(\d+)"/.exec(c);
        var am = /<a\b[^>]*href="([^"]+)"[\s\S]*?title="([^"]*)"/.exec(c);
        if (!am) continue;
        var href = abs(am[1]);
        var title = unesc(am[2]).trim();
        var tm = /<h3[^>]*class="video__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/.exec(c);
        if (tm) title = unesc(tm[1].replace(/<[^>]*>/g, "")).trim() || title;
        var im = /<img\b[^>]*\bsrc="([^"]+)"/.exec(c);
        var dm = /video__tag--time[^>]*>([\s\S]*?)</.exec(c);
        out.push(videoItem(title, href, im ? im[1] : "", idm ? idm[1] : "",
            dm ? parseClock(dm[1].replace(/\s+/g, "")) : 0));
    }
    return out;
}

source.search = function (query, type, order, filters) {
    var out = [];
    var url = SITE + "/hledej/" + encodeURIComponent(query || "");
    if (!query) { L("search: empty query"); return new VideoPager(out, false, {}); }
    var r = http.GET(url, hdr());
    if (r && r.isOk && r.body) out = parseCards(r.body);
    L("search q=" + JSON.stringify(query) + " url=" + url +
      " code=" + (r && r.code) + " isOk=" + (r && r.isOk) +
      " hdrCE=" + (r && r.headers && (r.headers["Content-Encoding"] || r.headers["content-encoding"]) || "-") +
      " len=" + (r && r.body ? r.body.length : -1) +
      " cards=" + out.length + " head=" + JSON.stringify((r && r.body ? r.body : "").slice(0, 120)));
    return new VideoPager(out, false, { query: query, page: 1 });
};

source.isContentDetailsUrl = function (url) {
    url = url || "";
    return url.indexOf("prehrajto.cz/") >= 0 && url.indexOf("/hledej/") < 0 && url.indexOf("/prihlaseni") < 0;
};

source.getContentDetails = function (url) {
    var html = "";
    var r = http.GET(url, hdr({ "Referer": SITE + "/" }));
    if (r.isOk) html = r.body || "";
    if (!html || !CDN_RE.test(html)) {
        var hex = /([0-9a-f]{16,32})\/?$/.exec(url || "");
        if (hex) {
            var rr = http.GET(SITE + "/embed/" + hex[1], hdr({ "Referer": url }));
            if (rr.isOk) html = rr.body || html;
        }
    }
    var sources = [], subtitles = [], seen = {};
    var m;
    CDN_RE.lastIndex = 0;
    while ((m = CDN_RE.exec(html)) !== null) {
        var u = m[0];
        if (seen[u]) continue;
        seen[u] = 1;
        sources.push(new VideoUrlSource({ url: u, name: "MP4", container: "video/mp4" }));
    }
    // Grayjay's runtime does not expose a `SubtitleSource` global, so subtitle
    // tracks are skipped; the MP4 video sources are what matter for playback.
    var name = unesc((/<title>([^<]+)<\/title>/i.exec(html) || [])[1] || "");
    name = name.replace(/\s*[-|]\s*(online ke zhl[eé]dnut[ií]|P[rř]ehraj\.to)[\s\S]*$/i, "").trim();
    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, url, ID),
        name: name,
        thumbnails: new Thumbnails([]),
        author: new PlatformAuthorLink(new PlatformID(PLATFORM, "prehrajto", ID), PLATFORM, SITE),
        url: url, shareUrl: url,
        description: "",
        video: new VideoSourceDescriptor(sources),
        subtitles: subtitles,
    });
};

source.getHome = function () {
    try {
        var p = source.search(String((new Date()).getFullYear()), null, null, {});
        return new VideoPager(p.results || [], p.hasMore, { home: 1 });
    } catch (e) { return new VideoPager([], false, { home: 1 }); }
};
