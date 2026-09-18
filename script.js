// ==========================================================
// M2 MOBİL MARKET - ANA JAVASCRIPT
// V1 ÇEKİRDEK ALTYAPI
// ==========================================================

"use strict";


// ==========================================================
// SUPABASE AYARLARI
// ==========================================================

window.M2_CONFIG = Object.freeze({

    SUPABASE_URL:
        "https://kbsrytrnyjutkwbahshr.supabase.co",

    SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_9DXNthWuI7Hm-Lq95Q9cYA_8dPEllhp",

    DEFAULT_CURRENCY:
        "TRY",

    DEFAULT_LOCALE:
        "tr-TR",

    STORAGE_PREFIX:
        "m2mobilmarket"

});


window.SUPABASE_BASE_URL =
    window.M2_CONFIG.SUPABASE_URL;

window.SUPABASE_API_URL =
    `${window.SUPABASE_BASE_URL}/rest/v1/`;

window.SUPABASE_KEY =
    window.M2_CONFIG.SUPABASE_PUBLISHABLE_KEY;


// ==========================================================
// LOCAL STORAGE ANAHTARLARI
// ==========================================================

const STORAGE_KEYS = Object.freeze({

    accessToken:
        `${window.M2_CONFIG.STORAGE_PREFIX}_access_token`,

    refreshToken:
        `${window.M2_CONFIG.STORAGE_PREFIX}_refresh_token`,

    user:
        `${window.M2_CONFIG.STORAGE_PREFIX}_user`

});


// ==========================================================
// UYGULAMA DURUMU
// ==========================================================

window.M2_STATE = {

    currentUser: null,

    gameProjects: [],

    gameServers: [],

    marketCategories: [],

    initialized: false

};


// ==========================================================
// TEMEL YARDIMCI FONKSİYONLAR
// ==========================================================

function safeJsonParse(value, fallback = null) {

    try {

        return JSON.parse(value);

    } catch (error) {

        return fallback;

    }

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function formatPrice(
    value,
    currency = "TRY"
) {

    const number =
        Number(value);

    if (!Number.isFinite(number)) {

        return "0 TL";

    }

    return new Intl.NumberFormat(
        window.M2_CONFIG.DEFAULT_LOCALE,
        {
            style: "currency",
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    ).format(number);

}


function createSlug(value) {

    return String(value ?? "")
        .trim()
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ş/g, "s")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}


// ==========================================================
// OTURUM DEPOLAMA
// ==========================================================

function getStoredUser() {

    return safeJsonParse(
        localStorage.getItem(
            STORAGE_KEYS.user
        ),
        null
    );

}


function saveStoredUser(user) {

    if (!user) {

        localStorage.removeItem(
            STORAGE_KEYS.user
        );

        return;

    }

    localStorage.setItem(
        STORAGE_KEYS.user,
        JSON.stringify(user)
    );

}


function clearStoredSession() {

    localStorage.removeItem(
        STORAGE_KEYS.accessToken
    );

    localStorage.removeItem(
        STORAGE_KEYS.refreshToken
    );

    localStorage.removeItem(
        STORAGE_KEYS.user
    );

    window.M2_STATE.currentUser =
        null;

}


function saveSession(data) {

    if (data?.access_token) {

        localStorage.setItem(
            STORAGE_KEYS.accessToken,
            data.access_token
        );

    }

    if (data?.refresh_token) {

        localStorage.setItem(
            STORAGE_KEYS.refreshToken,
            data.refresh_token
        );

    }

    if (data?.user) {

        saveStoredUser(
            data.user
        );

        window.M2_STATE.currentUser =
            data.user;

    }

}


// ==========================================================
// JWT KONTROLÜ
// ==========================================================

function decodeJwtPayload(token) {

    try {

        const payload =
            token?.split(".")?.[1];

        if (!payload) {

            return null;

        }

        const normalized =
            payload
                .replace(/-/g, "+")
                .replace(/_/g, "/");

        const padded =
            normalized.padEnd(
                Math.ceil(
                    normalized.length / 4
                ) * 4,
                "="
            );

        const decoded =
            atob(padded);

        const bytes =
            Uint8Array.from(
                decoded,
                character =>
                    character.charCodeAt(0)
            );

        const json =
            new TextDecoder().decode(
                bytes
            );

        return JSON.parse(json);

    } catch (error) {

        return null;

    }

}


function isAccessTokenUsable(
    token,
    bufferSeconds = 60
) {

    if (!token) {

        return false;

    }

    const payload =
        decodeJwtPayload(token);

    if (!payload?.exp) {

        return false;

    }

    return (
        payload.exp * 1000 >
        Date.now() +
        bufferSeconds * 1000
    );

}


// ==========================================================
// TOKEN YENİLEME
// ==========================================================

let refreshPromise = null;


async function refreshSupabaseSession() {

    if (refreshPromise) {

        return refreshPromise;

    }

    refreshPromise =
        (async () => {

            const refreshToken =
                localStorage.getItem(
                    STORAGE_KEYS.refreshToken
                );

            if (!refreshToken) {

                return null;

            }

            try {

                const response =
                    await fetch(
                        `${window.SUPABASE_BASE_URL}/auth/v1/token?grant_type=refresh_token`,
                        {
                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "apikey":
                                    window.SUPABASE_KEY

                            },

                            body:
                                JSON.stringify({
                                    refresh_token:
                                        refreshToken
                                })
                        }
                    );

                const data =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );

                if (!response.ok) {

                    console.error(
                        "Oturum yenileme başarısız:",
                        response.status,
                        data
                    );

                    if (
                        response.status !== 429
                    ) {

                        clearStoredSession();

                    }

                    return null;

                }

                saveSession(data);

                return (
                    data.access_token ||
                    null
                );

            } catch (error) {

                console.error(
                    "Oturum yenileme hatası:",
                    error
                );

                return null;

            }

        })();

    try {

        return await refreshPromise;

    } finally {

        refreshPromise = null;

    }

}


async function getValidAccessToken() {

    const accessToken =
        localStorage.getItem(
            STORAGE_KEYS.accessToken
        );

    if (
        isAccessTokenUsable(
            accessToken
        )
    ) {

        return accessToken;

    }

    return await refreshSupabaseSession();

}


// ==========================================================
// SUPABASE PUBLIC FETCH
// ==========================================================

async function supabasePublicFetch(
    endpoint,
    options = {}
) {

    const headers =
        new Headers(
            options.headers || {}
        );

    headers.set(
        "apikey",
        window.SUPABASE_KEY
    );

    headers.set(
        "Accept",
        "application/json"
    );

    const response =
        await fetch(
            `${window.SUPABASE_API_URL}${endpoint}`,
            {
                ...options,
                headers
            }
        );

    return response;

}


// ==========================================================
// SUPABASE AUTH FETCH
// ==========================================================

async function supabaseAuthFetch(
    endpoint,
    options = {}
) {

    let accessToken =
        await getValidAccessToken();

    if (!accessToken) {

        throw new Error(
            "Oturum bulunamadı veya süresi doldu."
        );

    }

    const request =
        async token => {

            const headers =
                new Headers(
                    options.headers || {}
                );

            headers.set(
                "apikey",
                window.SUPABASE_KEY
            );

            headers.set(
                "Authorization",
                `Bearer ${token}`
            );

            headers.set(
                "Accept",
                "application/json"
            );

            return fetch(
                endpoint.startsWith("http")
                    ? endpoint
                    : `${window.SUPABASE_API_URL}${endpoint}`,
                {
                    ...options,
                    headers
                }
            );

        };

    let response =
        await request(
            accessToken
        );

    if (
        response.status === 401
    ) {

        const refreshedToken =
            await refreshSupabaseSession();

        if (refreshedToken) {

            response =
                await request(
                    refreshedToken
                );

        }

    }

    return response;

}


// ==========================================================
// SUPABASE RESPONSE KONTROLÜ
// ==========================================================

async function parseSupabaseResponse(
    response,
    defaultError =
        "İşlem gerçekleştirilemedi."
) {

    const data =
        await response
            .json()
            .catch(
                () => null
            );

    if (!response.ok) {

        console.error(
            "Supabase isteği başarısız:",
            response.status,
            data
        );

        throw new Error(
            data?.message ||
            data?.msg ||
            data?.error_description ||
            defaultError
        );

    }

    return data;

}


// ==========================================================
// OYUN PROJELERİNİ GETİR
// ==========================================================

async function loadGameProjects() {

    const response =
        await supabasePublicFetch(
            "game_projects" +
            "?status=eq.active" +
            "&select=id,name,slug,logo_url,website_url,description,is_featured,sort_order" +
            "&order=sort_order.asc"
        );

    const data =
        await parseSupabaseResponse(
            response,
            "Oyun projeleri alınamadı."
        );

    window.M2_STATE.gameProjects =
        Array.isArray(data)
            ? data
            : [];

    return window.M2_STATE.gameProjects;

}


// ==========================================================
// SUNUCULARI GETİR
// ==========================================================

async function loadGameServers(
    gameProjectId = null
) {

    let query =
        "game_servers" +
        "?status=eq.active" +
        "&select=id,game_project_id,name,slug,is_featured,sort_order" +
        "&order=sort_order.asc";

    if (gameProjectId) {

        query +=
            `&game_project_id=eq.${encodeURIComponent(
                gameProjectId
            )}`;

    }

    const response =
        await supabasePublicFetch(
            query
        );

    const data =
        await parseSupabaseResponse(
            response,
            "Sunucular alınamadı."
        );

    window.M2_STATE.gameServers =
        Array.isArray(data)
            ? data
            : [];

    return window.M2_STATE.gameServers;

}


// ==========================================================
// MARKET KATEGORİLERİNİ GETİR
// ==========================================================

async function loadMarketCategories() {

    const response =
        await supabasePublicFetch(
            "market_categories" +
            "?is_active=eq.true" +
            "&select=id,name,slug,icon,description,sort_order" +
            "&order=sort_order.asc"
        );

    const data =
        await parseSupabaseResponse(
            response,
            "Kategoriler alınamadı."
        );

    window.M2_STATE.marketCategories =
        Array.isArray(data)
            ? data
            : [];

    return window.M2_STATE.marketCategories;

}


// ==========================================================
// ID İLE OYUN BUL
// ==========================================================

function getGameProjectById(id) {

    return (
        window.M2_STATE
            .gameProjects
            .find(
                game =>
                    Number(game.id) ===
                    Number(id)
            ) ||
        null
    );

}


// ==========================================================
// SLUG İLE OYUN BUL
// ==========================================================

function getGameProjectBySlug(slug) {

    return (
        window.M2_STATE
            .gameProjects
            .find(
                game =>
                    game.slug === slug
            ) ||
        null
    );

}


// ==========================================================
// ID İLE SUNUCU BUL
// ==========================================================

function getGameServerById(id) {

    return (
        window.M2_STATE
            .gameServers
            .find(
                server =>
                    Number(server.id) ===
                    Number(id)
            ) ||
        null
    );

}


// ==========================================================
// ID İLE KATEGORİ BUL
// ==========================================================

function getMarketCategoryById(id) {

    return (
        window.M2_STATE
            .marketCategories
            .find(
                category =>
                    Number(category.id) ===
                    Number(id)
            ) ||
        null
    );

}


// ==========================================================
// TÜRKÇE URL YARDIMCILARI
// ==========================================================

window.M2_ROUTES =
    Object.freeze({

        home:
            "/anasayfa",

        login:
            "/giris-yap",

        register:
            "/kayit-ol",

        account:
            "/hesabim",

        createListing:
            "/ilan-ver",

        myListings:
            "/ilanlarim",

        messages:
            "/mesajlarim"

    });


function getGameUrl(game) {

    if (!game?.slug) {

        return "/anasayfa";

    }

    return (
        `/oyun/${encodeURIComponent(
            game.slug
        )}`
    );

}


function getServerUrl(
    game,
    server
) {

    if (
        !game?.slug ||
        !server?.slug
    ) {

        return "/anasayfa";

    }

    return (
        `/oyun/${encodeURIComponent(
            game.slug
        )}/${encodeURIComponent(
            server.slug
        )}`
    );

}


function getListingUrl(listing) {

    if (!listing?.id) {

        return "/anasayfa";

    }

    const slug =
        createSlug(
            listing.title ||
            "ilan"
        );

    return (
        `/ilan/${encodeURIComponent(
            listing.id
        )}/${slug}`
    );

}


// ==========================================================
// UYGULAMA BAŞLATMA
// ==========================================================

async function initializeM2MobilMarket() {

    try {

        window.M2_STATE.currentUser =
            getStoredUser();

        const [
            gameProjects,
            gameServers,
            marketCategories
        ] =
            await Promise.all([

                loadGameProjects(),

                loadGameServers(),

                loadMarketCategories()

            ]);

        window.M2_STATE.initialized =
            true;

        console.log(
            "M2 Mobil Market hazır.",
            {
                oyunSayisi:
                    gameProjects.length,

                sunucuSayisi:
                    gameServers.length,

                kategoriSayisi:
                    marketCategories.length,

                oturum:
                    Boolean(
                        window.M2_STATE
                            .currentUser
                    )
            }
        );

        document.dispatchEvent(
            new CustomEvent(
                "m2:ready",
                {
                    detail: {
                        gameProjects,
                        gameServers,
                        marketCategories
                    }
                }
            )
        );

    } catch (error) {

        console.error(
            "M2 Mobil Market başlatılamadı:",
            error
        );

        document.dispatchEvent(
            new CustomEvent(
                "m2:error",
                {
                    detail: {
                        error
                    }
                }
            )
        );

    }

}


// ==========================================================
// GLOBAL API
// ==========================================================

window.M2 = Object.freeze({

    getStoredUser,

    clearStoredSession,

    getValidAccessToken,

    supabasePublicFetch,

    supabaseAuthFetch,

    loadGameProjects,

    loadGameServers,

    loadMarketCategories,

    getGameProjectById,

    getGameProjectBySlug,

    getGameServerById,

    getMarketCategoryById,

    getGameUrl,

    getServerUrl,

    getListingUrl,

    formatPrice,

    createSlug,

    escapeHtml

});


// ==========================================================
// DOM HAZIR OLDUĞUNDA BAŞLAT
// ==========================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeM2MobilMarket
);
