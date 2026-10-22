/// <reference path="./script.d.ts" />
/*
 * Bombuj.si — Grayjay plugin
 *   movies : www.bombuj.si/online-film-<slug>
 *   series : serialy.bombuj.si/serial-<slug>   (episode: /serial/<slug>-<S>x<E>)
 *
 * Search : POST /4154q37rpc4dsvbp.php (queryString=)
 * Players: prehravace_ajax.php -> player.php -> <prov>7.php?code= -> iframe embed
 * Extract: streamtape (botlink get_video) + mixdrop (unpacked MDCore.wurl) -> MP4
 */
const PLATFORM = "Bombuj.si";
const ID = "c0978fb0-e021-4e8d-9022-01edcd72fd59";
const BOMBUJ = "https://www.bombuj.si";
const SER = "https://serialy.bombuj.si";
const SEARCH = BOMBUJ + "/4154q37rpc4dsvbp.php";
const SER_SEARCH = SER + "/4154q37rpc4dsvbp.php";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";
const M_SCHEME = "bombuj:movie:";
const S_SCHEME = "bombuj:series:";
const E_SCHEME = "bombuj:episode:";

var CONF = null;

function hdr(extra) {
    var h = { "User-Agent": UA, "Accept-Language": "cs,sk,en;q=0.8",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
}
function escRe(s) { return (s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function unesc(s) {
    return (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
function abs(u) {
    if (!u) return u;
    if (u.indexOf("//") === 0) return "https:" + u;
    if (u.charAt(0) === "/") return BOMBUJ + u;
    return u;
}
function encSlug(s) { return (s || "").replace(/ /g, "%20"); }

/* ---- title helpers (ported from util.py) ---- */
function stripAccents(s) { return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function norm(s) {
    s = stripAccents((s || "").toLowerCase());
    s = s.replace(/\b(dabing|titulky|titulky?|hd|uhd|4k|1080p|720p|480p|360p|full ?hd|bluray|blu-ray|web-?dl|webrip|brrip|dvdrip|hc|digital|remastered|proper|repack|cz|sk|en)\b/g, " ");
    s = s.replace(/[^a-z0-9]+/g, " ");
    return s.replace(/\s+/g, " ").trim();
}
function tokenSet(s) { return new Set(norm(s).split(" ").filter(function (t) { return t.length > 1; })); }
var EP_RE = /(?:^|[^a-z0-9])s(\d{1,2})[\s._-]*e(\d{1,3})(?![0-9])/i;
var EP_RE2 = /(?:^|[^a-z0-9])(\d{1,2})x(\d{1,3})(?![0-9])/i;
function parseEpisode(t) {
    var m = EP_RE.exec(t || "") || EP_RE2.exec(t || "");
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : null;
}
function titleMatch(cand, query, year, season, episode, movie) {
    var cq = tokenSet(query), cc = tokenSet(cand), inter = 0;
    if (cq.size === 0 || cc.size === 0) return false;
    cq.forEach(function (t) { if (cc.has(t)) inter++; });
    if (inter / Math.max(1, cq.size) < 0.6) return false;
    if (movie && (episode === null || episode === undefined) && parseEpisode(cand) !== null) return false;
    if (episode !== null && episode !== undefined) {
        var pe = parseEpisode(cand);
        if (pe === null) return false;
        if (season !== null && season !== undefined && pe[0] !== season) return false;
        if (pe[1] !== episode) return false;
    } else if (season !== null && season !== undefined && season > 0) {
        var pe2 = parseEpisode(cand);
        if (pe2 !== null && pe2[0] !== season) return false;
    }
    if (year) {
        var ym = /(19|20)\d{2}/.exec(cand || "");
        if (ym && Math.abs(parseInt(ym[0], 10) - parseInt(year, 10)) > 1) return false;
    }
    return true;
}

/* ---- search helpers ---- */
function searchMovies(q) {
    var r = http.POST(SEARCH, "queryString=" + encodeURIComponent(q),
        hdr({ "Referer": BOMBUJ + "/", "X-Requested-With": "XMLHttpRequest",
              "Content-Type": "application/x-www-form-urlencoded" }));
    var txt = r.body || "", out = [], seen = {};
    var re = /href="\/\/(?:www\.)?bombuj\.si\/online-film-([a-z0-9-]+)"[\s\S]*?<span class="nazov">([\s\S]*?)<\/span>/g, m;
    while ((m = re.exec(txt)) !== null) {
        if (seen[m[1]]) continue; seen[m[1]] = 1;
        var raw = unesc(m[2]).trim(), ym = /\((\d{4})\)\s*$/.exec(raw);
        out.push({ slug: m[1], name: ym ? raw.replace(/\s*\(\d{4}\)\s*$/, "").trim() : raw,
                   year: ym ? ym[1] : "" });
    }
    return out;
}
function searchSeries(q) {
    var r = http.POST(SER_SEARCH, "queryString=" + encodeURIComponent(q),
        hdr({ "Referer": SER + "/", "X-Requested-With": "XMLHttpRequest",
              "Content-Type": "application/x-www-form-urlencoded" }));
    var txt = r.body || "", out = [], seen = {};
    var re = /href="\/\/serialy\.bombuj\.si\/serial-([^"#]+)[^"]*"[\s\S]*?<span class="nazov">([\s\S]*?)<\/span>[\s\S]*?<span class="zanre">(\d{4})/g, m;
    while ((m = re.exec(txt)) !== null) {
        var slug = m[1].trim().toLowerCase();
        if (!slug || seen[slug]) continue; seen[slug] = 1;
        out.push({ slug: slug, name: unesc(m[2]).trim(), year: m[3] });
    }
    return out;
}
function searchMoviesFB(q) {
    var w = (q || "").trim().split(/\s+/);
    for (var k = w.length; k >= 1; k--) {
        var rs = searchMovies(w.slice(0, k).join(" "));
        if (rs.length) return rs;
    }
    return [];
}
function searchSeriesFB(q) {
    var w = (q || "").trim().split(/\s+/);
    for (var k = w.length; k >= 1; k--) {
        var rs = searchSeries(w.slice(0, k).join(" "));
        if (rs.length) return rs;
    }
    return [];
}
function seasonEpisodes(slug, season) {
    var r = http.GET(SER + "/epizody/ajax2.php?url=" + encodeURIComponent(slug) + "&seria=" + season,
        hdr({ "Referer": SER + "/serial-" + encSlug(slug), "X-Requested-With": "XMLHttpRequest", "Accept-Encoding": "identity" }));
    var body = r.body || "", out = [];
    var re = /href='\/\/serialy\.bombuj\.si\/serial\/([a-z0-9-]+-\d+x\d+)'/g, m;
    while ((m = re.exec(body)) !== null) {
        var em = /(\d+)x(\d+)$/.exec(m[1]);
        out.push({ key: m[1], s: parseInt(em[1], 10), e: parseInt(em[2], 10) });
    }
    return out;
}
function pageEpisodes(slug) {
    var body = http.GET(SER + "/serial-" + encSlug(slug), hdr()).body || "", out = [], m;
    var re = /href="\/\/serialy\.bombuj\.si\/serial\/([^"]+?)-(\d+)x(\d+)"/g;
    while ((m = re.exec(body)) !== null) {
        var pre = m[1].replace(/%20/g, " ").trim().toLowerCase();
        if (pre !== slug.toLowerCase()) continue;
        out.push({ s: parseInt(m[2], 10), e: parseInt(m[3], 10) });
    }
    return out;
}
function maxSeason(slug) {
    var body = http.GET(SER + "/serial-" + encSlug(slug), hdr()).body || "", m, mx = 1;
    var re = /seria=(\d+)/g;
    while ((m = re.exec(body)) !== null) { var v = parseInt(m[1], 10); if (v > mx) mx = v; }
    return mx;
}
function seriesTitle(slug) {
    var body = http.GET(SER + "/serial-" + encSlug(slug), hdr()).body || "";
    var t = /<title>([^<]+)<\/title>/.exec(body);
    if (!t) return slug;
    return unesc(t[1]).replace(/\s*online seri[\s\S]*$/i, "").replace(/\s*\|.*$/, "").trim();
}
function movieTitle(slug) {
    var body = http.GET(BOMBUJ + "/online-film-" + slug, hdr()).body || "";
    var t = /<title>([^<]+)<\/title>/.exec(body);
    if (!t) return slug;
    return unesc(t[1]).replace(/\s*\|.*$/, "").replace(/\s*online[\s\S]*$/i, "").trim();
}

/* ---- grayjay items ---- */
function author() { return new PlatformAuthorLink(new PlatformID(PLATFORM, "bombuj", ID), PLATFORM, BOMBUJ); }
function movieItem(c) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, "m-" + c.slug, ID),
        name: c.name + (c.year ? " (" + c.year + ")" : ""),
        thumbnails: new Thumbnails([new Thumbnail(BOMBUJ + "/images/covers/all/" + c.slug + ".jpg", 0)]),
        author: author(), datetime: 0, duration: 0,
        url: M_SCHEME + c.slug, shareUrl: BOMBUJ + "/online-film-" + c.slug, isLive: false,
    });
}
function seriesChannel(c) {
    return new PlatformChannel({
        id: new PlatformID(PLATFORM, "s-" + c.slug, ID),
        name: c.name + (c.year ? " (" + c.year + ")" : ""),
        thumbnail: "", banner: "", subscribers: 0, description: "",
        url: S_SCHEME + c.slug,
    });
}
function episodeItem(slug, sName, s, e) {
    return new PlatformVideo({
        id: new PlatformID(PLATFORM, "e-" + slug + "-" + s + "x" + e, ID),
        name: sName + " S" + s + "E" + e,
        thumbnails: new Thumbnails([]), author: author(), datetime: 0, duration: 0,
        url: E_SCHEME + slug + ":" + s + ":" + e,
        shareUrl: SER + "/serial/" + encSlug(slug) + "-" + s + "x" + e,
    });
}

source.enable = function (conf, settings, savedState) { CONF = conf; };
source.saveState = function () {};

source.search = function (query, type, order, filters) {
    var q = (query || "").trim();
    var ep = parseEpisode(q);
    var base = q.replace(/\s*[\[(]?s\s*\d{1,2}[\s._-]*e\s*\d{1,3}[\])]?\s*/ig, " ")
                .replace(/\s*[\[(]?\d{1,2}x\d{1,3}[\])]?\s*/ig, " ").trim() || q;
    var out = [];
    var mv = searchMoviesFB(base);
    var pickedMv = mv.filter(function (c) { return titleMatch(c.name, base, c.year, null, null, true); });
    if (pickedMv.length === 0) pickedMv = mv.slice(0, 2);
    pickedMv.slice(0, 6).forEach(function (c) { out.push(movieItem(c)); });

    if (ep) {
        var sr = searchSeriesFB(base);
        var picked = sr.filter(function (c) { return titleMatch(c.name, base, c.year); });
        if (picked.length === 0) picked = sr.slice(0, 1);
        if (picked.length) {
            var slug = picked[0].slug, sName = picked[0].name;
            var eps = seasonEpisodes(slug, ep[0]);
            var hit = null, rest = [];
            eps.forEach(function (x) { if (x.e === ep[1]) hit = x; else rest.push(x); });
            if (hit) out.unshift(episodeItem(slug, sName, hit.s, hit.e));
            rest.sort(function (a, b) { return b.e - a.e; }).slice(0, 25).forEach(function (x) {
                out.push(episodeItem(slug, sName, x.s, x.e));
            });
        }
    }
    return new VideoPager(out, false, { query: query });
};

source.searchSuggestions = function (query, type) { return []; };

source.searchChannels = function (query, type, order, filters) {
    var q = (query || "").trim();
    var base = q.replace(/\s*[\[(]?s\s*\d{1,2}[\s._-]*e\s*\d{1,3}[\])]?\s*/ig, " ")
                .replace(/\s*[\[(]?\d{1,2}x\d{1,3}[\])]?\s*/ig, " ").trim() || q;
    var out = [];
    searchSeriesFB(base).slice(0, 24).forEach(function (c) { out.push(seriesChannel(c)); });
    return new ChannelPager(out, false, { query: query });
};

source.getHome = function () {
    var html = http.GET(BOMBUJ + "/filmy", hdr()).body || "";
    var out = [], seen = {};
    var chunks = html.split("hlavne_str").slice(1);
    for (var i = 0; i < chunks.length && out.length < 30; i++) {
        var cm = /images\/covers\/all\/([a-z0-9-]+)\.jpg/.exec(chunks[i]);
        var nm = /class='nazov_filmu_pagination_str'><a[^>]*>([^<]*)<\/a>/.exec(chunks[i]);
        if (!cm || !nm || seen[cm[1]]) continue;
        seen[cm[1]] = 1;
        var name = unesc(nm[1]).replace(/\s*\|.*$/, "").trim();
        out.push(movieItem({ slug: cm[1], name: name, year: (/(19|20)\d{2}/.exec(nm[1]) || [""])[0] }));
    }
    return new VideoPager(out, false, { home: 1 });
};

source.isChannelUrl = function (url) {
    return !!url && (url.indexOf(S_SCHEME) === 0 || /serialy\.bombuj\.si\/serial-/.test(url));
};
source.getChannel = function (url) {
    var slug = url.indexOf(S_SCHEME) === 0 ? url.substring(S_SCHEME.length) : (/([a-z0-9-]+)$/.exec(url) || [])[1];
    return new PlatformChannel({
        id: new PlatformID(PLATFORM, "s-" + slug, ID), name: seriesTitle(slug),
        thumbnail: "", banner: "", subscribers: 0,
        description: "", url: S_SCHEME + slug,
    });
};
source.getChannelContents = function (url, type, order, filters) {
    var slug = url.indexOf(S_SCHEME) === 0 ? url.substring(S_SCHEME.length) : (/([a-z0-9-]+)$/.exec(url) || [])[1];
    var season = maxSeason(slug);
    var name = seriesTitle(slug);
    var eps = seasonEpisodes(slug, season);
    if (eps.length === 0) eps = pageEpisodes(slug);
    var seen = {};
    eps = eps.filter(function (x) { var k = x.s + "x" + x.e; if (seen[k]) return false; seen[k] = 1; return true; })
             .sort(function (a, b) { return (b.s - a.s) || (b.e - a.e); });
    var out = eps.map(function (x) { return episodeItem(slug, name, x.s, x.e); });
    return new VideoPager(out, false, { slug: slug, season: season });
};

source.isContentDetailsUrl = function (url) {
    return !!url && (url.indexOf(M_SCHEME) === 0 || url.indexOf(E_SCHEME) === 0
        || /\/online-film-/.test(url) || /\/serial\/[a-z0-9-]+-\d+x\d+/.test(url));
};

/* ---- provider extraction ---- */
function unbase(num, base) {
    var d = "0123456789abcdefghijklmnopqrstuvwxyz", s = "";
    if (num === 0) return "0";
    while (num > 0) { s = d.charAt(num % base) + s; num = Math.floor(num / base); }
    return s;
}
function unpackJS(js) {
    var m = /eval\(function\(p,a,c,k,e,(?:d|r)\)[\s\S]*?\}\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:[^'\\]|\\.)*)'\.split\('\|'\)/.exec(js);
    if (!m) return js;
    var p = m[1].replace(/\\(['"\\/])/g, "$1"), a = parseInt(m[2], 10), c = parseInt(m[3], 10), k = m[4].split("|");
    var lookup = {};
    for (var i = 0; i < c; i++) { var key = unbase(i, a); lookup[key] = (k[i] !== undefined && k[i] !== "") ? k[i] : key; }
    return p.replace(/\b\w+\b/g, function (w) { return Object.prototype.hasOwnProperty.call(lookup, w) ? lookup[w] : w; });
}
function extractStreamtape(embed) {
    var page = http.GET(embed, hdr({ "Referer": "https://streamtape.com/" })).body || "";
    var m = /getElementById\('botlink'\)\s*\.\s*innerHTML\s*=\s*'([^']*)'\s*\+\s*\(?\s*'([^']*)'\s*\)?\s*\.substring\((\d+)\)/.exec(page);
    var url = null;
    if (m) url = m[1] + m[2].substring(parseInt(m[3], 10));
    if (!url) { var f = /innerHTML\s*=\s*'([^']*get_video[^']*)'/.exec(page); if (f) url = f[1]; }
    if (!url) return null;
    if (url.indexOf("//") === 0) url = "https:" + url;
    else if (url.charAt(0) === "/") url = "https://streamtape.com" + url;
    if (url.indexOf("stream=1") < 0) url += (url.indexOf("?") >= 0 ? "&" : "?") + "stream=1";
    return url;
}
function extractMixdrop(embed) {
    var s = http.GET(embed, hdr({ "Referer": "https://mixdrop.co/" })).body || "";
    if (s.indexOf("MDCore.wurl") < 0 && s.indexOf("eval(function(p,a,c,k,e") >= 0) s = unpackJS(s);
    var m = /MDCore\.wurl\s*=\s*["']([^"']+)["']/.exec(s);
    if (!m) m = /wurl\s*[:=]\s*["']([^"']+)["']/.exec(s);
    if (!m) m = /["'](https?:\/\/[^"']+\.mp4[^"']*)["']/.exec(s);
    if (!m) return null;
    var u = m[1].replace(/\\\//g, "/");
    if (u.indexOf("//") === 0) u = "https:" + u;
    return u;
}
function providerKind(prov) {
    prov = (prov || "").toLowerCase();
    if (prov.indexOf("streamtape") >= 0 || prov.indexOf("tape") >= 0) return "streamtape";
    if (prov.indexOf("mixdrop") >= 0 || prov.indexOf("mxdrop") >= 0) return "mixdrop";
    return null;
}
function parsePlayerLinks(txt) {
    var out = [], re = /link="([^"]*player\.php\?[^"]+)"/g, m;
    while ((m = re.exec(txt)) !== null) {
        var url = unesc(m[1]);
        if (url.indexOf("//") === 0) url = "https:" + url;
        var vm = /[?&]vh=([^&]+)/.exec(url);
        out.push({ prov: vm ? vm[1] : "", url: url });
    }
    return out;
}
function resolvePlayers(pageRef, players) {
    var sources = [], subs = [], done = {};
    for (var i = 0; i < players.length; i++) {
        var kind = providerKind(players[i].prov);
        if (!kind || done[kind]) continue;
        var purl = players[i].url.replace(/ /g, "%20");
        try {
            var pr = http.GET(purl, hdr({ "Referer": pageRef })).body || "";
            var wm = new RegExp('(?:src|data-src)="(//[^"]+/' + escRe(players[i].prov) + '7\\.php\\?code=[^"]+)"').exec(pr)
                  || /(?:src|data-src)="(\/\/[^"]+7\.php\?code=[^"]+)"/.exec(pr);
            if (!wm) continue;
            var wrapper = (wm[1].indexOf("//") === 0 ? "https:" + wm[1] : wm[1]).replace(/ /g, "%20");
            var wr = http.GET(wrapper, hdr({ "Referer": purl })).body || "";
            var em = /<iframe[^>]+src="(\/\/[^"]+)"/.exec(wr) || /<iframe[^>]+src="(https?:\/\/[^"]+)"/.exec(wr);
            if (!em) continue;
            var embed = em[1].indexOf("//") === 0 ? "https:" + em[1] : em[1];
            var url = kind === "streamtape" ? extractStreamtape(embed) : extractMixdrop(embed);
            if (url) { done[kind] = 1; sources.push(new VideoUrlSource({ url: url, name: players[i].prov + " (MP4)", container: "video/mp4" })); }
        } catch (e) { log("bombuj " + kind + " error: " + e); }
    }
    return { sources: sources, subtitles: subs };
}
function moviePlayers(slug, title) {
    var page = http.GET(BOMBUJ + "/online-film-" + slug, hdr()).body || "";
    var params = { url: slug, imdb_id: "", tmdb_id: "", vhs: "", hmd: "", name: title || "", nazovprehraj: title || "" };
    var mm = /prehravace_ajax\.php'[\s\S]*?data:\s*\{([\s\S]*?)\}/.exec(page);
    if (mm) { var re = /(\w+):\s*'([^']*)'/g, km; while ((km = re.exec(mm[1])) !== null) params[km[1]] = km[2]; }
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    var r = http.GET(BOMBUJ + "/prehravace_ajax.php?" + qs,
        hdr({ "Referer": BOMBUJ + "/online-film-" + slug, "X-Requested-With": "XMLHttpRequest" }));
    return parsePlayerLinks(r.body || "");
}

source.getContentDetails = function (url) {
    if (url.indexOf(M_SCHEME) === 0 || /online-film-/.test(url)) {
        var slug = url.indexOf(M_SCHEME) === 0 ? url.substring(M_SCHEME.length) : (/online-film-([a-z0-9-]+)/.exec(url) || [])[1];
        var title = movieTitle(slug);
        var res = resolvePlayers(BOMBUJ + "/online-film-" + slug, moviePlayers(slug, title));
        return new PlatformVideoDetails({
            id: new PlatformID(PLATFORM, "m-" + slug, ID), name: title,
            thumbnails: new Thumbnails([new Thumbnail(BOMBUJ + "/images/covers/all/" + slug + ".jpg", 0)]),
            author: author(), url: M_SCHEME + slug, shareUrl: BOMBUJ + "/online-film-" + slug,
            description: "", video: new VideoSourceDescriptor(res.sources), subtitles: res.subtitles,
        });
    }
    var mm = /bombuj:episode:([^:]+):(\d+):(\d+)/.exec(url) || /\/serial\/(.+)-(\d+)x(\d+)/.exec(url);
    var slug2 = mm[1], s = parseInt(mm[2], 10), e = parseInt(mm[3], 10);
    var epPage = http.GET(SER + "/serial/" + encSlug(slug2) + "-" + s + "x" + e, hdr({ "Referer": SER + "/serial-" + encSlug(slug2) })).body || "";
    var res2 = resolvePlayers(SER + "/serial-" + encSlug(slug2), parsePlayerLinks(epPage));
    return new PlatformVideoDetails({
        id: new PlatformID(PLATFORM, "e-" + slug2 + "-" + s + "x" + e, ID),
        name: seriesTitle(slug2) + " S" + s + "E" + e,
        thumbnails: new Thumbnails([]), author: author(),
        url: E_SCHEME + slug2 + ":" + s + ":" + e,
        shareUrl: SER + "/serial/" + encSlug(slug2) + "-" + s + "x" + e,
        description: "", video: new VideoSourceDescriptor(res2.sources), subtitles: res2.subtitles,
    });
};
