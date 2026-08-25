/**
 * Generated from WebBreacher WhatsMyName wmn-data.json because social
 * analysis needs broad offline coverage without fabricating matches. If this
 * catalog shrinks below 300 entries, the Social analyzer stops meeting its
 * public-network coverage promise.
 *
 * existsStatus/existsString and missingStatus/missingString are the real
 * per-site detection rule WhatsMyName uses -- what the HTTP response looks
 * like when the account exists vs. when it does not. A bare "HTTP 200" check
 * would be wrong for most sites, since many return 200 for both a real
 * profile and a "not found" page; matching the response against the rule
 * that actually distinguishes the two is what makes real verification
 * possible. "protected" sites (Cloudflare, captcha, etc.) are excluded from
 * verification rather than guessed at, since a direct fetch cannot reliably
 * pass those checks.
 *
 * Regenerate with: node scripts/generate-social-catalog.mjs
 */
export interface SocialNetworkTemplate {
  readonly name: string;
  readonly uri: string;
  readonly existsStatus: number;
  readonly existsString: string;
  readonly missingStatus: number;
  readonly missingString: string;
  readonly protected: boolean;
}

export const generatedSocialNetworks: readonly SocialNetworkTemplate[] = [
  {
    "name": "247CTF",
    "uri": "https://247ctf.com/progress/{account}",
    "existsStatus": 200,
    "existsString": "avatar-container d-flex",
    "missingStatus": 302,
    "missingString": "",
    "protected": true
  },
  {
    "name": "247sports",
    "uri": "https://247sports.com/User/{account}/",
    "existsStatus": 200,
    "existsString": "staff-header-container",
    "missingStatus": 404,
    "missingString": "<title>247Sports</title>",
    "protected": true
  },
  {
    "name": "35photo",
    "uri": "https://35photo.pro/@{account}/",
    "existsStatus": 200,
    "existsString": "userNameBlock",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "3dtoday",
    "uri": "https://3dtoday.ru/blogs/{account}",
    "existsStatus": 200,
    "existsString": "class=\"header_user_name",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "7cup",
    "uri": "https://www.7cups.com/@{account}",
    "existsStatus": 200,
    "existsString": "Profile - 7 Cups",
    "missingStatus": 404,
    "missingString": "Oops! The content you're attempting to access could not be found.",
    "protected": false
  },
  {
    "name": "7dach",
    "uri": "https://7dach.ru/profile/{account}",
    "existsStatus": 200,
    "existsString": "Информация / Профиль",
    "missingStatus": 404,
    "missingString": "<title>Ошибка / 7dach.ru",
    "protected": false
  },
  {
    "name": "about.me",
    "uri": "https://about.me/{account}",
    "existsStatus": 200,
    "existsString": " | about.me",
    "missingStatus": 404,
    "missingString": "<title>about.me</title>",
    "protected": false
  },
  {
    "name": "ACF",
    "uri": "https://support.advancedcustomfields.com/forums/users/{account}/",
    "existsStatus": 200,
    "existsString": "bbp-user-body",
    "missingStatus": 404,
    "missingString": "<title>Page Not Found - ACF Support</title>",
    "protected": false
  },
  {
    "name": "AdmireMe.VIP",
    "uri": "https://admireme.vip/{account}/",
    "existsStatus": 200,
    "existsString": "creator-stat subscriber",
    "missingStatus": 404,
    "missingString": "<title>Page Not Found |",
    "protected": false
  },
  {
    "name": "adultism",
    "uri": "https://www.adultism.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "Last login:",
    "missingStatus": 404,
    "missingString": "<title> Not Found",
    "protected": false
  },
  {
    "name": "ADVFN",
    "uri": "https://uk.advfn.com/forum/profile/{account}",
    "existsStatus": 200,
    "existsString": "Profile | ADVFN",
    "missingStatus": 404,
    "missingString": "ADVFN ERROR - Page Not Found",
    "protected": false
  },
  {
    "name": "Albicla",
    "uri": "https://albicla.com/{account}/post/1",
    "existsStatus": 500,
    "existsString": "500 Post tymczasowo niedostępny",
    "missingStatus": 200,
    "missingString": "404 Nie znaleziono użytkownika",
    "protected": false
  },
  {
    "name": "alik",
    "uri": "https://www.alik.cz/u/{account}",
    "existsStatus": 200,
    "existsString": "Vizitka – Alík.cz</title>",
    "missingStatus": 404,
    "missingString": "<title>Vizitka nenalezena",
    "protected": false
  },
  {
    "name": "Alura",
    "uri": "https://cursos.alura.com.br/user/{account}",
    "existsStatus": 200,
    "existsString": "Perfil de",
    "missingStatus": 404,
    "missingString": "\"error\":\"Not Found\"",
    "protected": false
  },
  {
    "name": "Ameblo",
    "uri": "https://ameblo.jp/{account}",
    "existsStatus": 200,
    "existsString": "画像一覧",
    "missingStatus": 404,
    "missingString": "削除された可能性がございます。",
    "protected": false
  },
  {
    "name": "AmericanThinker",
    "uri": "https://www.americanthinker.com/author/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"author_image\"",
    "missingStatus": 404,
    "missingString": "title>404 Not Found</title>",
    "protected": false
  },
  {
    "name": "Aparat",
    "uri": "https://www.aparat.com/api/fa/v1/user/user/information/username/{account}",
    "existsStatus": 200,
    "existsString": "\"data\":{",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "Apex Legends",
    "uri": "https://api.tracker.gg/api/v2/apex/standard/profile/origin/{account}",
    "existsStatus": 200,
    "existsString": "platformInfo",
    "missingStatus": 404,
    "missingString": "CollectorResultStatus::NotFound",
    "protected": false
  },
  {
    "name": "appian Community",
    "uri": "https://community.appian.com/members/{account}",
    "existsStatus": 200,
    "existsString": "class=\"avatar-container",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Arch Linux GitLab",
    "uri": "https://gitlab.archlinux.org/api/v4/users?username={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 200,
    "missingString": "[]",
    "protected": true
  },
  {
    "name": "Arduino (Forum)",
    "uri": "https://forum.arduino.cc/u/{account}.json",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error_type\":\"not_found\"",
    "protected": false
  },
  {
    "name": "Arduino (Project Hub)",
    "uri": "https://projecthub.arduino.cc/{account}",
    "existsStatus": 200,
    "existsString": "\"userInfo\":{",
    "missingStatus": 200,
    "missingString": "\"userInfo\":null",
    "protected": false
  },
  {
    "name": "ArmorGames",
    "uri": "https://armorgames.com/user/{account}",
    "existsStatus": 200,
    "existsString": "about",
    "missingStatus": 302,
    "missingString": "404: Oh Noes!",
    "protected": false
  },
  {
    "name": "Arsmate",
    "uri": "https://arsmate.com/api/creators/{account}",
    "existsStatus": 200,
    "existsString": "\"success\":true",
    "missingStatus": 404,
    "missingString": "404,\"Server Error",
    "protected": false
  },
  {
    "name": "Artbreeder",
    "uri": "https://www.artbreeder.com/{account}",
    "existsStatus": 200,
    "existsString": "data-tutorial=\"profile-filter\"",
    "missingStatus": 404,
    "missingString": "error: {message:\"User not found\"",
    "protected": false
  },
  {
    "name": "ArtStation",
    "uri": "https://www.artstation.com/api/v2/user_profiles/{account}.json",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"User with username:",
    "protected": false
  },
  {
    "name": "asciinema",
    "uri": "https://asciinema.org/~{account}",
    "existsStatus": 200,
    "existsString": "class=\"profile-page\"",
    "missingStatus": 404,
    "missingString": "<h1>404 Not Found</h1>",
    "protected": false
  },
  {
    "name": "AtCoder",
    "uri": "https://atcoder.jp/users/{account}",
    "existsStatus": 200,
    "existsString": "<h3>Contest Status</h3>",
    "missingStatus": 404,
    "missingString": ">404 Page Not Found</h1>",
    "protected": false
  },
  {
    "name": "au.ru",
    "uri": "https://au.ru/user/{account}/",
    "existsStatus": 200,
    "existsString": "Лоты пользователя ",
    "missingStatus": 404,
    "missingString": "Пользователь не найден",
    "protected": false
  },
  {
    "name": "Audiojungle",
    "uri": "https://audiojungle.net/user/{account}",
    "existsStatus": 200,
    "existsString": "s profile on AudioJungle",
    "missingStatus": 404,
    "missingString": "404 - Nothing to see here",
    "protected": false
  },
  {
    "name": "Avid Community",
    "uri": "https://community.avid.com/members/{account}/default.aspx",
    "existsStatus": 200,
    "existsString": "My Activity",
    "missingStatus": 302,
    "missingString": "The user you requested cannot be found.",
    "protected": true
  },
  {
    "name": "babepedia",
    "uri": "https://www.babepedia.com/user/{account}",
    "existsStatus": 200,
    "existsString": "'s Page</title>",
    "missingStatus": 404,
    "missingString": "Profile not found",
    "protected": false
  },
  {
    "name": "BabyPips",
    "uri": "https://forums.babypips.com/u/{account}.json",
    "existsStatus": 200,
    "existsString": "user_badges",
    "missingStatus": 404,
    "missingString": "The requested URL or resource could not be found",
    "protected": false
  },
  {
    "name": "Bandcamp",
    "uri": "https://bandcamp.com/{account}",
    "existsStatus": 200,
    "existsString": " collection | Bandcamp</title>",
    "missingStatus": 404,
    "missingString": "<h2>Sorry, that something isn’t here.</h2>",
    "protected": false
  },
  {
    "name": "Bandlab",
    "uri": "https://www.bandlab.com/api/v1.3/users/{account}",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "Couldn’t find any matching element, it might be deleted",
    "protected": false
  },
  {
    "name": "bblog_ru",
    "uri": "https://www.babyblog.ru/user/{account}",
    "existsStatus": 200,
    "existsString": ") — дневник на Babyblog.ru",
    "missingStatus": 200,
    "missingString": "БэбиБлог - беременность, календарь беременности, дневники",
    "protected": true
  },
  {
    "name": "bdsmsingles",
    "uri": "https://www.bdsmsingles.com/members/{account}/",
    "existsStatus": 200,
    "existsString": "<title>Profile",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Beacons",
    "uri": "https://beacons.ai/{account}",
    "existsStatus": 200,
    "existsString": " - Link in Bio &amp; Creator Tools | Beacons</title>",
    "missingStatus": 200,
    "missingString": "The page you are looking for does not seem to exist anymore",
    "protected": true
  },
  {
    "name": "Behance",
    "uri": "https://www.behance.net/{account}",
    "existsStatus": 200,
    "existsString": "\"entityOwners\":[{\"username",
    "missingStatus": 404,
    "missingString": "\"entityOwners\":[]",
    "protected": false
  },
  {
    "name": "Bentbox",
    "uri": "https://bentbox.co/{account}",
    "existsStatus": 200,
    "existsString": "<div id=\"user_bar\">",
    "missingStatus": 200,
    "missingString": "This user is currently not available",
    "protected": false
  },
  {
    "name": "BiggerPockets",
    "uri": "https://www.biggerpockets.com/users/{account}",
    "existsStatus": 200,
    "existsString": "| BiggerPockets</title>",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "BIGO Live",
    "uri": "https://www.bigo.tv/user/{account}",
    "existsStatus": 200,
    "existsString": "userInfo:{nickName",
    "missingStatus": 200,
    "missingString": "userInfo:{}",
    "protected": false
  },
  {
    "name": "Bimpos",
    "uri": "https://ask.bimpos.com/user/{account}",
    "existsStatus": 200,
    "existsString": "<title>User ",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "Bio Site",
    "uri": "https://bio.site/{account}",
    "existsStatus": 200,
    "existsString": "— Bio Sites</title>",
    "missingStatus": 404,
    "missingString": "This Bio Site doesn’t exist — Bio Site</title>",
    "protected": false
  },
  {
    "name": "biolink",
    "uri": "https://bio.link/{account}",
    "existsStatus": 200,
    "existsString": "profile:username",
    "missingStatus": 404,
    "missingString": "The page you’re looking for doesn’t exist",
    "protected": false
  },
  {
    "name": "Bitbucket",
    "uri": "https://bitbucket.org/!api/2.0/repositories/{account}?page=1&pagelen=25&sort=-updated_on&q=&fields=-values.owner%2C-values.workspace",
    "existsStatus": 200,
    "existsString": "full_name",
    "missingStatus": 404,
    "missingString": "No workspace with identifier",
    "protected": false
  },
  {
    "name": "blogi.pl",
    "uri": "https://www.blogi.pl/osoba,{account}.html",
    "existsStatus": 200,
    "existsString": "Informacje ogólne",
    "missingStatus": 200,
    "missingString": "Niepoprawny adres.",
    "protected": false
  },
  {
    "name": "Blogmarks",
    "uri": "http://blogmarks.net/user/{account}",
    "existsStatus": 200,
    "existsString": "class=\"mark\"",
    "missingStatus": 200,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Blogspot",
    "uri": "https://{account}.blogspot.com/?hl=en-US",
    "existsStatus": 200,
    "existsString": "_WidgetManager._Init",
    "missingStatus": 404,
    "missingString": ">Blog not found<",
    "protected": false
  },
  {
    "name": "Bluesky Domain as User",
    "uri": "https://bsky.app/profile/{account}",
    "existsStatus": 200,
    "existsString": "on Bluesky</title>",
    "missingStatus": 200,
    "missingString": "<title>Bluesky</title>",
    "protected": false
  },
  {
    "name": "Bluesky Username",
    "uri": "https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={account}.bsky.social",
    "existsStatus": 200,
    "existsString": "\"handle\":\"",
    "missingStatus": 400,
    "missingString": "\"message\":\"Profile not found\"",
    "protected": false
  },
  {
    "name": "BoardGameGeek",
    "uri": "https://api.geekdo.com/api/accounts/validate/username?username={account}",
    "existsStatus": 200,
    "existsString": "\"message\":\"Sorry, this username is already taken.\"",
    "missingStatus": 200,
    "missingString": "\"isValid\":true",
    "protected": false
  },
  {
    "name": "Bookcrossing",
    "uri": "https://www.bookcrossing.com/mybookshelf/{account}",
    "existsStatus": 200,
    "existsString": "membersbycity/",
    "missingStatus": 404,
    "missingString": "BookCrossing - Not Found",
    "protected": true
  },
  {
    "name": "Booknode",
    "uri": "https://booknode.com/profil/{account}",
    "existsStatus": 200,
    "existsString": "<title>Profil de",
    "missingStatus": 404,
    "missingString": "<title>Page non trouvée",
    "protected": false
  },
  {
    "name": "Boosty",
    "uri": "https://api.boosty.to/v1/blog/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"blog_not_found\"",
    "protected": false
  },
  {
    "name": "Booth",
    "uri": "https://{account}.booth.pm/",
    "existsStatus": 200,
    "existsString": "- BOOTH</title>",
    "missingStatus": 302,
    "missingString": "",
    "protected": true
  },
  {
    "name": "Brickset",
    "uri": "https://brickset.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "Member since:</dt>",
    "missingStatus": 200,
    "missingString": "{name}</h1>",
    "protected": false
  },
  {
    "name": "Bugcrowd",
    "uri": "https://bugcrowd.com/profile-service/v1/profiles/{account}",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Not Found\"",
    "protected": false
  },
  {
    "name": "Bunpro",
    "uri": "https://community.bunpro.jp/u/{account}.json",
    "existsStatus": 200,
    "existsString": "username",
    "missingStatus": 404,
    "missingString": "The requested URL or resource could not be found.",
    "protected": false
  },
  {
    "name": "BuzzFeed",
    "uri": "https://www.buzzfeed.com/{account}",
    "existsStatus": 200,
    "existsString": " on BuzzFeed</title><meta",
    "missingStatus": 404,
    "missingString": "We can't find the page you're looking for",
    "protected": false
  },
  {
    "name": "cafecito",
    "uri": "https://cafecito.app/{account}",
    "existsStatus": 200,
    "existsString": " | Cafecito</title>",
    "missingStatus": 404,
    "missingString": "Es posible que el enlace que seleccionaste esté roto o que se haya eliminado la página",
    "protected": true
  },
  {
    "name": "Calendy",
    "uri": "https://calendly.com/api/booking/profiles/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"not found\"",
    "protected": false
  },
  {
    "name": "Cameo",
    "uri": "https://www.cameo.com/api/v2/users/{account}",
    "existsStatus": 200,
    "existsString": "\"_id\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"We could not find the user:",
    "protected": false
  },
  {
    "name": "Carbonmade",
    "uri": "https://{account}.carbonmade.com/",
    "existsStatus": 200,
    "existsString": "<meta name=\"description\" content=\"",
    "missingStatus": 404,
    "missingString": ".carbonmade.com not found",
    "protected": false
  },
  {
    "name": "Career.habr",
    "uri": "https://career.habr.com/{account}",
    "existsStatus": 200,
    "existsString": "— Хабр Карьера</title>",
    "missingStatus": 404,
    "missingString": "Ошибка 404",
    "protected": false
  },
  {
    "name": "carrd.co",
    "uri": "https://{account}.carrd.co",
    "existsStatus": 200,
    "existsString": "( Made with Carrd )",
    "missingStatus": 404,
    "missingString": "Sorry, the requested page could not be found.",
    "protected": false
  },
  {
    "name": "CastingCallClub",
    "uri": "https://www.castingcall.club/{account}",
    "existsStatus": 200,
    "existsString": "class=\"text-sm text-gray-500\">Joined",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "cda.pl",
    "uri": "https://www.cda.pl/{account}",
    "existsStatus": 200,
    "existsString": "Foldery",
    "missingStatus": 200,
    "missingString": "Strona na którą chcesz wejść nie istnieje",
    "protected": false
  },
  {
    "name": "Cent",
    "uri": "https://beta.cent.co/data/user/profile?userHandles={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 200,
    "missingString": "\"results\":[]",
    "protected": false
  },
  {
    "name": "cfx.re",
    "uri": "https://forum.cfx.re/u/{account}.json",
    "existsStatus": 200,
    "existsString": "created_at",
    "missingStatus": 404,
    "missingString": "The requested URL or resource could not be found.",
    "protected": false
  },
  {
    "name": "championat",
    "uri": "https://www.championat.com/user/{account}/",
    "existsStatus": 200,
    "existsString": "Личный профил",
    "missingStatus": 404,
    "missingString": "Извините, запрашиваемая страница не найдена",
    "protected": false
  },
  {
    "name": "Chamsko",
    "uri": "https://www.chamsko.pl/profil/{account}",
    "existsStatus": 200,
    "existsString": "W serwisie od",
    "missingStatus": 404,
    "missingString": "Strona nie istnieje.",
    "protected": false
  },
  {
    "name": "chatango.com",
    "uri": "https://{account}.chatango.com",
    "existsStatus": 200,
    "existsString": "<title>Chatango!",
    "missingStatus": 200,
    "missingString": "<title>Unknown User!",
    "protected": false
  },
  {
    "name": "CHEEZburger",
    "uri": "https://cheezburger.com/Editor/{account}",
    "existsStatus": 200,
    "existsString": "<title>Recent Posts from",
    "missingStatus": 404,
    "missingString": "<title>404 Not Found</title>",
    "protected": false
  },
  {
    "name": "Chess.com",
    "uri": "https://api.chess.com/pub/player/{account}",
    "existsStatus": 200,
    "existsString": "\"player_id\":",
    "missingStatus": 404,
    "missingString": "\"code\":0",
    "protected": true
  },
  {
    "name": "Chocolatey",
    "uri": "https://community.chocolatey.org/profiles/{account}",
    "existsStatus": 200,
    "existsString": "id =\"bioSection\"",
    "missingStatus": 404,
    "missingString": "id=\"error404Message\"",
    "protected": false
  },
  {
    "name": "Choko.Link",
    "uri": "https://choko.link/{account}",
    "existsStatus": 200,
    "existsString": "--title-font-family: Roboto;",
    "missingStatus": 404,
    "missingString": "The link might be incorrect or the profile has been deleted.",
    "protected": false
  },
  {
    "name": "Chomikuj.pl",
    "uri": "https://chomikuj.pl/{account}/",
    "existsStatus": 200,
    "existsString": "Foldery",
    "missingStatus": 404,
    "missingString": "Chomik o takiej nazwie nie istnieje",
    "protected": false
  },
  {
    "name": "Chyoa",
    "uri": "https://chyoa.com/user/{account}",
    "existsStatus": 200,
    "existsString": "When I'm not reading erotica I like to read",
    "missingStatus": 404,
    "missingString": "Sorry, I got distracted...",
    "protected": false
  },
  {
    "name": "Cloudflare",
    "uri": "https://community.cloudflare.com/u/{account}/card.json",
    "existsStatus": 200,
    "existsString": "user_avatar",
    "missingStatus": 404,
    "missingString": "The requested URL or resource could not be found",
    "protected": false
  },
  {
    "name": "Clubhouse",
    "uri": "https://www.clubhouse.com/@{account}",
    "existsStatus": 200,
    "existsString": "\"user\":",
    "missingStatus": 404,
    "missingString": "404",
    "protected": false
  },
  {
    "name": "cnet",
    "uri": "https://www.cnet.com/profiles/{account}/",
    "existsStatus": 200,
    "existsString": "<span>Joined CNET</span>",
    "missingStatus": 404,
    "missingString": "class=\"c-error404_message\">",
    "protected": false
  },
  {
    "name": "Coda",
    "uri": "https://coda.io/@{account}/",
    "existsStatus": 200,
    "existsString": "- Coda Profile</title>",
    "missingStatus": 404,
    "missingString": "<title>Coda | Page not found - Coda</title>",
    "protected": false
  },
  {
    "name": "Codeberg",
    "uri": "https://codeberg.org/api/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "user redirect does not exist",
    "protected": false
  },
  {
    "name": "Codecademy",
    "uri": "https://www.codecademy.com/profiles/{account}",
    "existsStatus": 200,
    "existsString": "\"type\":\"User\"",
    "missingStatus": 200,
    "missingString": "\"type\":\"UserNotFound\"",
    "protected": false
  },
  {
    "name": "CodeChef",
    "uri": "https://www.codechef.com/users/{account}",
    "existsStatus": 200,
    "existsString": "class=\"user-profile-container\"",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Codeforces",
    "uri": "https://codeforces.com/api/user.info?handles={account}",
    "existsStatus": 200,
    "existsString": "\"status\":\"OK\"",
    "missingStatus": 400,
    "missingString": "\"status\":\"FAILED\"",
    "protected": false
  },
  {
    "name": "codementor",
    "uri": "https://www.codementor.io/@{account}",
    "existsStatus": 200,
    "existsString": "ABOUT ME",
    "missingStatus": 404,
    "missingString": "404/favicon.png",
    "protected": false
  },
  {
    "name": "CodePen",
    "uri": "https://codepen.io/{account}",
    "existsStatus": 200,
    "existsString": "property=\"og:url\"",
    "missingStatus": 404,
    "missingString": "data-test-id=\"text-404\"",
    "protected": true
  },
  {
    "name": "Coderwall",
    "uri": "https://coderwall.com/{account}/",
    "existsStatus": 200,
    "existsString": "s profile |",
    "missingStatus": 404,
    "missingString": "404! Our feels when that url is used",
    "protected": false
  },
  {
    "name": "CodeSandbox",
    "uri": "https://codesandbox.io/api/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"data\":",
    "missingStatus": 422,
    "missingString": "Could not find user with username",
    "protected": false
  },
  {
    "name": "Codewars",
    "uri": "https://www.codewars.com/api/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"reason\":\"not found\"",
    "protected": false
  },
  {
    "name": "Commudle",
    "uri": "https://json.commudle.com/api/v2/users?username={account}",
    "existsStatus": 200,
    "existsString": "\"status\":200",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "Community Adobe",
    "uri": "https://community.adobe.com/t5/forums/searchpage/tab/user?q={account}",
    "existsStatus": 200,
    "existsString": "UserSearchItemContainer",
    "missingStatus": 200,
    "missingString": "No search results found.",
    "protected": false
  },
  {
    "name": "coroflot",
    "uri": "https://www.coroflot.com/{account}",
    "existsStatus": 200,
    "existsString": "portfolio",
    "missingStatus": 404,
    "missingString": "Looking for something?",
    "protected": false
  },
  {
    "name": "Coub",
    "uri": "https://coub.com/api/v2/channels/{account}",
    "existsStatus": 200,
    "existsString": "\"user_id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Unhandled exception\"",
    "protected": false
  },
  {
    "name": "cowboys4angels",
    "uri": "https://cowboys4angels.com/cowboy/{account}/",
    "existsStatus": 200,
    "existsString": " - Cowboys 4 Angels</title>",
    "missingStatus": 404,
    "missingString": "Error Page not found",
    "protected": false
  },
  {
    "name": "Cracked",
    "uri": "https://www.cracked.com/members/{account}",
    "existsStatus": 200,
    "existsString": "Member Since",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "crevado",
    "uri": "https://{account}.crevado.com/",
    "existsStatus": 200,
    "existsString": "Portfolio",
    "missingStatus": 404,
    "missingString": "Site not found :-(",
    "protected": false
  },
  {
    "name": "Cropty",
    "uri": "https://api.cropty.io/v1/auth/{account}",
    "existsStatus": 200,
    "existsString": "\"name\":",
    "missingStatus": 404,
    "missingString": "\"errors\":",
    "protected": false
  },
  {
    "name": "Crowdin",
    "uri": "https://crowdin.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "id=\"profile-page\"",
    "missingStatus": 404,
    "missingString": "class=\"error-page\"",
    "protected": false
  },
  {
    "name": "Cults3D",
    "uri": "https://cults3d.com/en/users/{account}/creations",
    "existsStatus": 200,
    "existsString": "All the 3D models of",
    "missingStatus": 404,
    "missingString": "Oh dear, this page is not working!",
    "protected": false
  },
  {
    "name": "Cytoid",
    "uri": "https://cytoid.io/profile/{account}",
    "existsStatus": 200,
    "existsString": "Joined",
    "missingStatus": 404,
    "missingString": "Profile not found",
    "protected": false
  },
  {
    "name": "Daily Kos",
    "uri": "https://www.dailykos.com/user/{account}",
    "existsStatus": 200,
    "existsString": "id=\"userData\"",
    "missingStatus": 404,
    "missingString": "Page not found! (404)",
    "protected": false
  },
  {
    "name": "Dailymotion",
    "uri": "https://api.dailymotion.com/user/{account}?fields=id,username,screenname,description,avatar_720_url,cover_250_url,followers_total,following_total,videos_total,country,created_time,verified,url",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"code\":404",
    "protected": false
  },
  {
    "name": "darudar",
    "uri": "https://darudar.org/users/{account}/",
    "existsStatus": 200,
    "existsString": ". Дарудар",
    "missingStatus": 404,
    "missingString": "404. Дару~дар: миру~мир!",
    "protected": false
  },
  {
    "name": "dateinasia",
    "uri": "https://www.dateinasia.com/{account}",
    "existsStatus": 200,
    "existsString": "About me",
    "missingStatus": 404,
    "missingString": "The page you are looking for does not exist",
    "protected": false
  },
  {
    "name": "datezone",
    "uri": "https://en.datezone.com/users/{account}",
    "existsStatus": 200,
    "existsString": "property=\"og:url\"",
    "missingStatus": 404,
    "missingString": "<title>Page not found</title>",
    "protected": false
  },
  {
    "name": "Dating.ru",
    "uri": "https://dating.ru/{account}/",
    "existsStatus": 200,
    "existsString": "| dating.ru",
    "missingStatus": 404,
    "missingString": "Такой страницы не существует.",
    "protected": false
  },
  {
    "name": "Demotywatory",
    "uri": "https://demotywatory.pl/user/{account}",
    "existsStatus": 200,
    "existsString": "Z nami od:",
    "missingStatus": 200,
    "missingString": "Użytkownik o podanym pseudonimie nie istnieje.",
    "protected": false
  },
  {
    "name": "depop",
    "uri": "https://www.depop.com/{account}/",
    "existsStatus": 200,
    "existsString": "s Shop - Depop",
    "missingStatus": 404,
    "missingString": "Sorry, that page doesn't exist",
    "protected": false
  },
  {
    "name": "Designspriation",
    "uri": "https://www.designspiration.com/{account}/",
    "existsStatus": 200,
    "existsString": "has discovered on Designspiration",
    "missingStatus": 404,
    "missingString": "Content Not Found",
    "protected": false
  },
  {
    "name": "destream",
    "uri": "https://api.destream.net/siteapi/v2/live/details/{account}",
    "existsStatus": 200,
    "existsString": "\"userName\":",
    "missingStatus": 400,
    "missingString": "\"errorMessage\":\"Error happened.\"",
    "protected": false
  },
  {
    "name": "Destructoid",
    "uri": "https://www.destructoid.com/?name={account}",
    "existsStatus": 200,
    "existsString": "Follow",
    "missingStatus": 200,
    "missingString": "Error in query",
    "protected": false
  },
  {
    "name": "dev.to",
    "uri": "https://dev.to/api/users/by_username?url={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": true
  },
  {
    "name": "DeviantArt",
    "uri": "https://www.deviantart.com/{account}",
    "existsStatus": 200,
    "existsString": " | DeviantArt</title>",
    "missingStatus": 404,
    "missingString": "DeviantArt: 404",
    "protected": false
  },
  {
    "name": "devRant",
    "uri": "https://devrant.com/api/get-user-id?app=3&username={account}",
    "existsStatus": 200,
    "existsString": "\"success\":true",
    "missingStatus": 400,
    "missingString": "\"success\":false",
    "protected": false
  },
  {
    "name": "DFG",
    "uri": "https://www.dfg.com.br/user/{account}",
    "existsStatus": 200,
    "existsString": "class=\"container user-information\"",
    "missingStatus": 404,
    "missingString": "content=\"https://www.dfg.com.br/Layout/HandleStatusCode/404\"",
    "protected": true
  },
  {
    "name": "Diablo",
    "uri": "https://diablo2.io/member/{account}/",
    "existsStatus": 200,
    "existsString": "Viewing profile - ",
    "missingStatus": 404,
    "missingString": "The requested user does not exist",
    "protected": false
  },
  {
    "name": "DIBIZ",
    "uri": "https://www.dibiz.com/{account}",
    "existsStatus": 200,
    "existsString": "Add to contacts</span>",
    "missingStatus": 404,
    "missingString": "An Error Has Occurred",
    "protected": false
  },
  {
    "name": "Digitalspy",
    "uri": "https://forums.digitalspy.com/profile/discussions/{account}",
    "existsStatus": 200,
    "existsString": "About",
    "missingStatus": 404,
    "missingString": "User not found",
    "protected": false
  },
  {
    "name": "diigo",
    "uri": "https://www.diigo.com/interact_api/load_profile_info?name={account}",
    "existsStatus": 200,
    "existsString": "regist_at",
    "missingStatus": 200,
    "missingString": "{}",
    "protected": false
  },
  {
    "name": "Discogs",
    "uri": "https://api.discogs.com/users/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"message\": \"User does not exist or may have been deleted.\"",
    "protected": false
  },
  {
    "name": "Discord (Invite)",
    "uri": "https://discord.com/api/v9/invites/{account}?with_counts=true&with_expiration=true",
    "existsStatus": 200,
    "existsString": "\"channel\":",
    "missingStatus": 404,
    "missingString": "\"message\": \"Unknown Invite\"",
    "protected": false
  },
  {
    "name": "Discourse",
    "uri": "https://meta.discourse.org/u/{account}/summary.json",
    "existsStatus": 200,
    "existsString": "topics",
    "missingStatus": 404,
    "missingString": "The requested URL or resource could not be found.",
    "protected": false
  },
  {
    "name": "discuss.elastic.co",
    "uri": "https://discuss.elastic.co/u/{account}",
    "existsStatus": 200,
    "existsString": "<title>  Profile",
    "missingStatus": 404,
    "missingString": "Oops!",
    "protected": false
  },
  {
    "name": "Disqus",
    "uri": "https://disqus.com/api/3.0/users/details?user=username:{account}&api_key=E8Uh5l5fHZ6gD8U3KycjAIAk46f68Zw7C6eW8WSjZvCLXebZ7p0r1yrYDrLilk2F",
    "existsStatus": 200,
    "existsString": "\"code\":0",
    "missingStatus": 400,
    "missingString": "\"code\":2",
    "protected": false
  },
  {
    "name": "Dissenter",
    "uri": "https://dissenter.com/user/{account}",
    "existsStatus": 200,
    "existsString": "Dissenter | The Comment Section of the Internet",
    "missingStatus": 404,
    "missingString": "That user is not registered here.",
    "protected": false
  },
  {
    "name": "Docker Hub (Organization)",
    "uri": "https://hub.docker.com/v2/orgs/{account}/",
    "existsStatus": 200,
    "existsString": "\"uuid\":",
    "missingStatus": 404,
    "missingString": "\"orgname\":[\"",
    "protected": false
  },
  {
    "name": "Docker Hub (User)",
    "uri": "https://hub.docker.com/v2/users/{account}/",
    "existsStatus": 200,
    "existsString": "\"uuid\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"User not found\"",
    "protected": false
  },
  {
    "name": "Dojoverse",
    "uri": "https://dojoverse.com/members/{account}/",
    "existsStatus": 200,
    "existsString": "Joined",
    "missingStatus": 404,
    "missingString": "Looks like you got lost!.",
    "protected": false
  },
  {
    "name": "donate.stream",
    "uri": "https://donate.stream/api/v1/streamer.get?path={account}&app=9f4e793cec820015d511dbc77b20c5c1",
    "existsStatus": 200,
    "existsString": "\"response\":",
    "missingStatus": 200,
    "missingString": "\"message\":\"Not found\"",
    "protected": true
  },
  {
    "name": "Donatello",
    "uri": "https://donatello.to/{account}",
    "existsStatus": 200,
    "existsString": "UserPage.init",
    "missingStatus": 404,
    "missingString": "<title>Сторінку не знайдено (404) - Donatello</title>",
    "protected": false
  },
  {
    "name": "Donatik",
    "uri": "https://{account}.donatik.ua/",
    "existsStatus": 200,
    "existsString": "\\\"__typename\\\":\\\"UserPageOutput\\\"",
    "missingStatus": 500,
    "missingString": "id=\"__next_error__\"",
    "protected": false
  },
  {
    "name": "Donation Alerts",
    "uri": "https://www.donationalerts.com/api/v1/user/{account}/donationpagesettings",
    "existsStatus": 200,
    "existsString": "\"data\":",
    "missingStatus": 202,
    "missingString": "\"success\":false",
    "protected": false
  },
  {
    "name": "DonationPay",
    "uri": "https://give.donationpay.org/hopewell-fund/{account}/",
    "existsStatus": 200,
    "existsString": "id=\"dp-payment-form\"",
    "missingStatus": 404,
    "missingString": "<title>404 Not Found</title>",
    "protected": false
  },
  {
    "name": "Donatty",
    "uri": "https://api.donatty.com/users/find/{account}",
    "existsStatus": 200,
    "existsString": "\"response\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"internal error\"",
    "protected": true
  },
  {
    "name": "dot.cards",
    "uri": "https://dot.cards/{account}",
    "existsStatus": 200,
    "existsString": "status\": \"success",
    "missingStatus": 200,
    "missingString": "status\": \"username_not_found",
    "protected": false
  },
  {
    "name": "Dota2.ru",
    "uri": "https://dota2.ru/forum/search/?type=user&keywords={account}&sort_by=username",
    "existsStatus": 200,
    "existsString": "class=\"forum-section__item forum-section__item--first\"",
    "missingStatus": 200,
    "missingString": "id=\"no-activity-posts\"",
    "protected": false
  },
  {
    "name": "DOTAFire",
    "uri": "https://www.dotafire.com/ajax/searchSite?text={account}&search=members",
    "existsStatus": 200,
    "existsString": "href=\"/profile/",
    "missingStatus": 200,
    "missingString": ">No results found</span>",
    "protected": false
  },
  {
    "name": "DOU",
    "uri": "https://dou.ua/users/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"page-profile\"",
    "missingStatus": 404,
    "missingString": "class=\"page-error\"",
    "protected": false
  },
  {
    "name": "Dribbble",
    "uri": "https://dribbble.com/{account}",
    "existsStatus": 200,
    "existsString": " | Dribbble",
    "missingStatus": 404,
    "missingString": "(404)</title>",
    "protected": false
  },
  {
    "name": "DRIVE2.RU",
    "uri": "https://www.drive2.ru/users/{account}/",
    "existsStatus": 200,
    "existsString": "itemprop=\"name\"",
    "missingStatus": 404,
    "missingString": "<title>404 — Страница не найдена</title>",
    "protected": true
  },
  {
    "name": "Droners",
    "uri": "https://droners.io/accounts/{account}/",
    "existsStatus": 200,
    "existsString": "- Professional Drone Pilot",
    "missingStatus": 302,
    "missingString": "(404)</title>",
    "protected": false
  },
  {
    "name": "Duolingo",
    "uri": "https://www.duolingo.com/2017-06-30/users?username={account}&_=1628308619574",
    "existsStatus": 200,
    "existsString": "joinedClassroomIds",
    "missingStatus": 200,
    "missingString": "\"users\" : []",
    "protected": false
  },
  {
    "name": "easyen",
    "uri": "https://easyen.ru/index/8-0-{account}",
    "existsStatus": 200,
    "existsString": "День рождения",
    "missingStatus": 200,
    "missingString": "Пользователь не найден",
    "protected": false
  },
  {
    "name": "eBay",
    "uri": "https://www.ebay.com/usr/{account}",
    "existsStatus": 200,
    "existsString": "on eBay</title>",
    "missingStatus": 200,
    "missingString": "The User ID you entered was not found",
    "protected": false
  },
  {
    "name": "ebay_stores",
    "uri": "https://www.ebay.com/str/{account}",
    "existsStatus": 200,
    "existsString": "| eBay Stores</title>",
    "missingStatus": 410,
    "missingString": "Sorry, this store was not found.",
    "protected": false
  },
  {
    "name": "Engadget",
    "uri": "https://www.engadget.com/about/editors/{account}/",
    "existsStatus": 200,
    "existsString": "\"displayName\"",
    "missingStatus": 200,
    "missingString": "<title>,  - Engadget</title>",
    "protected": false
  },
  {
    "name": "Etoro",
    "uri": "https://www.etoro.com/api/logininfo/v1.1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"gcid\":",
    "missingStatus": 404,
    "missingString": "\"ErrorCode\":\"NotFound\"",
    "protected": true
  },
  {
    "name": "Etsy",
    "uri": "https://www.etsy.com/people/{account}",
    "existsStatus": 200,
    "existsString": " favorite items - Etsy</title>",
    "missingStatus": 404,
    "missingString": "Sorry, the member you are looking for does not exist",
    "protected": false
  },
  {
    "name": "Evolution CMS",
    "uri": "https://community.evocms.ru/users/?search={account}",
    "existsStatus": 200,
    "existsString": "id=\"user-search\"",
    "missingStatus": 200,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Expressional.social (Mastodon Instance)",
    "uri": "https://expressional.social/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Fabswingers",
    "uri": "https://www.fabswingers.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "View Profile",
    "missingStatus": 200,
    "missingString": "The user you tried to view doesn't seem to be on the site any more",
    "protected": false
  },
  {
    "name": "Facebook",
    "uri": "https://www.facebook.com/{account}/",
    "existsStatus": 200,
    "existsString": "__isProfile",
    "missingStatus": 200,
    "missingString": "<title>Facebook</title>",
    "protected": false
  },
  {
    "name": "FACEIT",
    "uri": "https://www.faceit.com/api/users/v1/nicknames/{account}",
    "existsStatus": 200,
    "existsString": "\"result\":\"OK\"",
    "missingStatus": 404,
    "missingString": "\"message\":\"user not found\"",
    "protected": false
  },
  {
    "name": "Faktopedia",
    "uri": "https://faktopedia.pl/user/{account}",
    "existsStatus": 200,
    "existsString": "Zamieszcza fakty od:",
    "missingStatus": 200,
    "missingString": "Nie znaleziono użytkownika o podanym loginie.",
    "protected": false
  },
  {
    "name": "FanCentro",
    "uri": "https://fancentro.com/api/profile.get?profileAlias={account}&limit=1",
    "existsStatus": 200,
    "existsString": "\"status\":true",
    "missingStatus": 200,
    "missingString": "\"status\":false",
    "protected": false
  },
  {
    "name": "Fandom",
    "uri": "https://www.fandom.com/u/{account}",
    "existsStatus": 200,
    "existsString": "| Profile | Fandom",
    "missingStatus": 404,
    "missingString": "Not Found",
    "protected": false
  },
  {
    "name": "fanpop",
    "uri": "https://www.fanpop.com/fans/{account}",
    "existsStatus": 200,
    "existsString": "Fanpopping since",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Fanslist (OnlyFans)",
    "uri": "https://fanslist.com/search?q={account}",
    "existsStatus": 200,
    "existsString": "data-username=",
    "missingStatus": 200,
    "missingString": "No results found for query",
    "protected": false
  },
  {
    "name": "Fansly",
    "uri": "https://apiv3.fansly.com/api/v1/account?usernames={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 200,
    "missingString": "\"response\":[]",
    "protected": true
  },
  {
    "name": "Fark",
    "uri": "https://www.fark.com/users/{account}",
    "existsStatus": 200,
    "existsString": "Fark account number",
    "missingStatus": 200,
    "missingString": "Tastes like chicken.",
    "protected": false
  },
  {
    "name": "Federated.press (Mastodon Instance)",
    "uri": "https://federated.press/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Figma",
    "uri": "https://www.figma.com/api/profile/handle/{account}",
    "existsStatus": 200,
    "existsString": "\"status\":200",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": true
  },
  {
    "name": "Filmot Channel Search",
    "uri": "https://filmot.com/channelsearch/{account}",
    "existsStatus": 200,
    "existsString": "Subscribers",
    "missingStatus": 200,
    "missingString": "No channels found",
    "protected": false
  },
  {
    "name": "Filmot Unlisted Videos",
    "uri": "https://filmot.com/unlistedSearch?channelQuery={account}&sortField=uploaddate&sortOrder=desc&",
    "existsStatus": 200,
    "existsString": "clips found",
    "missingStatus": 200,
    "missingString": "No results",
    "protected": false
  },
  {
    "name": "Filmweb",
    "uri": "https://www.filmweb.pl/api/v1/users/{account}/id",
    "existsStatus": 200,
    "existsString": "\"userId\":",
    "missingStatus": 204,
    "missingString": "",
    "protected": false
  },
  {
    "name": "fine_art_america",
    "uri": "https://fineartamerica.com/profiles/{account}",
    "existsStatus": 200,
    "existsString": "Shop for artwork by",
    "missingStatus": 301,
    "missingString": "Browse through millions of independent artists in our extensive",
    "protected": false
  },
  {
    "name": "FL.ru",
    "uri": "https://www.fl.ru/users/{account}/portfolio/",
    "existsStatus": 200,
    "existsString": "class=\"page-profile\"",
    "missingStatus": 404,
    "missingString": "content=\"404 Not Found\"",
    "protected": true
  },
  {
    "name": "Flickr",
    "uri": "https://www.flickr.com/photos/{account}/",
    "existsStatus": 200,
    "existsString": "| Flickr",
    "missingStatus": 404,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Flightradar24",
    "uri": "https://my.flightradar24.com/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"profile-card\" data-profile-user=",
    "missingStatus": 404,
    "missingString": "class=\"main page-not-found-main",
    "protected": false
  },
  {
    "name": "Flipboard",
    "uri": "https://flipboard.com/@{account}",
    "existsStatus": 200,
    "existsString": ") on Flipboard",
    "missingStatus": 404,
    "missingString": "<title></title>",
    "protected": false
  },
  {
    "name": "flowcode",
    "uri": "https://www.flow.page/{account}",
    "existsStatus": 200,
    "existsString": "\"page\":{",
    "missingStatus": 404,
    "missingString": "\"page\":null",
    "protected": false
  },
  {
    "name": "Fodors Forum",
    "uri": "https://www.fodors.com/community/profile/{account}/forum-activity",
    "existsStatus": 200,
    "existsString": "User Profile | Fodor’s Travel</title>",
    "missingStatus": 302,
    "missingString": "Plan Your Trip Online</title>",
    "protected": false
  },
  {
    "name": "Folkd",
    "uri": "https://www.folkd.com/?app=core&module=system&controller=ajax&do=usernameExists&input={account}",
    "existsStatus": 200,
    "existsString": "\"message\":\"That display name is in use by another member.\"",
    "missingStatus": 200,
    "missingString": "\"result\":\"ok\"",
    "protected": true
  },
  {
    "name": "Fortnite Tracker",
    "uri": "https://fortnitetracker.com/profile/all/{account}",
    "existsStatus": 200,
    "existsString": "s Fortnite Stats - Fortnite Tracker",
    "missingStatus": 404,
    "missingString": "Fortnite Player Stats -",
    "protected": false
  },
  {
    "name": "forumprawne.org",
    "uri": "https://forumprawne.org/members/{account}.html",
    "existsStatus": 200,
    "existsString": "Wiadomość",
    "missingStatus": 500,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Fosstodon.org (Mastodon Instance)",
    "uri": "https://fosstodon.org/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "fotka",
    "uri": "https://api.fotka.com/v2/user/dataStatic?login={account}",
    "existsStatus": 200,
    "existsString": "\"profil\":",
    "missingStatus": 200,
    "missingString": "\"status\":\"ERROR\"",
    "protected": false
  },
  {
    "name": "Fotolog Archived Profile",
    "uri": "https://archive.org/wayback/available?url=https://www.fotolog.com/{account}",
    "existsStatus": 200,
    "existsString": "\"archived_snapshots\": {\"closest\"",
    "missingStatus": 200,
    "missingString": "\"archived_snapshots\": {}",
    "protected": false
  },
  {
    "name": "Foursquare",
    "uri": "https://foursquare.com/{account}",
    "existsStatus": 200,
    "existsString": "class=\"userProfile2Page\"",
    "missingStatus": 308,
    "missingString": "",
    "protected": false
  },
  {
    "name": "freeCodeCamp",
    "uri": "https://api.freecodecamp.org/users/get-public-profile?username={account}",
    "existsStatus": 200,
    "existsString": "\"user\":",
    "missingStatus": 404,
    "missingString": "{}",
    "protected": true
  },
  {
    "name": "Freelance.RU",
    "uri": "https://freelance.ru/{account}",
    "existsStatus": 200,
    "existsString": "class=\" user-top-container user-portfolio\"",
    "missingStatus": 404,
    "missingString": "class=\"msg_error alert alert-danger\"",
    "protected": false
  },
  {
    "name": "Freelance.ua",
    "uri": "https://freelance.ua/user/{account}/",
    "existsStatus": 200,
    "existsString": "p-profile-avatar",
    "missingStatus": 404,
    "missingString": "Схоже, дана сторінка не знайдена",
    "protected": false
  },
  {
    "name": "Freelancehunt (Employer)",
    "uri": "https://freelancehunt.com/en/employer/{account}.html",
    "existsStatus": 200,
    "existsString": "\"@id\":\"https://freelancehunt.com/en/employers\"",
    "missingStatus": 404,
    "missingString": "User not found.",
    "protected": true
  },
  {
    "name": "Freelancehunt (Freelancer)",
    "uri": "https://freelancehunt.com/en/freelancer/{account}.html",
    "existsStatus": 200,
    "existsString": "\"@id\":\"https://freelancehunt.com/en/freelancers\"",
    "missingStatus": 404,
    "missingString": "User not found.",
    "protected": true
  },
  {
    "name": "Freelancer",
    "uri": "https://www.freelancer.com/api/users/0.1/users?usernames%5B%5D={account}&compact=true",
    "existsStatus": 200,
    "existsString": "\"users\":{\"",
    "missingStatus": 200,
    "missingString": "\"users\":{}",
    "protected": false
  },
  {
    "name": "freesound",
    "uri": "https://freesound.org/people/{account}/section/stats/?ajax=1",
    "existsStatus": 200,
    "existsString": "forum posts",
    "missingStatus": 404,
    "missingString": "<h1>Page not found</h1>",
    "protected": false
  },
  {
    "name": "FriendFinder",
    "uri": "https://friendfinder.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "Last Visit:",
    "missingStatus": 302,
    "missingString": "302 Found",
    "protected": false
  },
  {
    "name": "FriendFinder-X",
    "uri": "https://www.friendfinder-x.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "'s Dating Profile on FriendFinder-x",
    "missingStatus": 302,
    "missingString": "The document has moved",
    "protected": false
  },
  {
    "name": "Fur Affinity",
    "uri": "https://www.furaffinity.net/user/{account}/",
    "existsStatus": 200,
    "existsString": "<userpage-nav-header>",
    "missingStatus": 200,
    "missingString": "<h2>System Error</h2>",
    "protected": false
  },
  {
    "name": "Gab",
    "uri": "https://gab.com/api/v1/account_by_username/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Record not found\"",
    "protected": false
  },
  {
    "name": "Game Jolt",
    "uri": "https://gamejolt.com/site-api/web/profile/@{account}/",
    "existsStatus": 200,
    "existsString": "created_on",
    "missingStatus": 404,
    "missingString": "null,",
    "protected": false
  },
  {
    "name": "game_debate",
    "uri": "https://www.game-debate.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "| , , GB pc game performance",
    "missingStatus": 404,
    "missingString": "Not Found",
    "protected": false
  },
  {
    "name": "Gamer DVR",
    "uri": "https://gamerdvr.com/gamer/{account}",
    "existsStatus": 200,
    "existsString": "class=\"gamerpic\"",
    "missingStatus": 302,
    "missingString": "<body>You are being <",
    "protected": false
  },
  {
    "name": "Gamespot",
    "uri": "https://www.gamespot.com/profile/{account}/summary/activity/?ajax",
    "existsStatus": 200,
    "existsString": "\"success\":true",
    "missingStatus": 200,
    "missingString": "\"success\":false",
    "protected": true
  },
  {
    "name": "Garmin Connect",
    "uri": "https://connect.garmin.com/app/profile/{account}",
    "existsStatus": 200,
    "existsString": "window.VIEWER_USERPREFERENCES = {",
    "missingStatus": 200,
    "missingString": "window.VIEWER_USERPREFERENCES = null",
    "protected": false
  },
  {
    "name": "GDBrowser",
    "uri": "https://gdbrowser.com/api/profile/{account}",
    "existsStatus": 200,
    "existsString": "\"accountID\":",
    "missingStatus": 500,
    "missingString": "-1",
    "protected": false
  },
  {
    "name": "GeeksForGeeks",
    "uri": "https://authapi.geeksforgeeks.org/api-get/user-profile-info/?handle={account}",
    "existsStatus": 200,
    "existsString": "\"message\":\"data retrieved successfully\"",
    "missingStatus": 400,
    "missingString": "\"message\":\"User not found!\"",
    "protected": false
  },
  {
    "name": "Genius (Artist)",
    "uri": "https://genius.com/artists/{account}",
    "existsStatus": 200,
    "existsString": "class=\"profile_header\"",
    "missingStatus": 404,
    "missingString": "class=\"render_404\"",
    "protected": true
  },
  {
    "name": "Genius (User)",
    "uri": "https://genius.com/{account}",
    "existsStatus": 200,
    "existsString": "class=\"profile_header\"",
    "missingStatus": 404,
    "missingString": "class=\"render_404\"",
    "protected": true
  },
  {
    "name": "Geocaching",
    "uri": "https://www.geocaching.com/p/?u={account}",
    "existsStatus": 200,
    "existsString": "class=\"hax-profile\"",
    "missingStatus": 404,
    "missingString": "class=\"callout http-error\"",
    "protected": false
  },
  {
    "name": "getmonero",
    "uri": "https://forum.getmonero.org/user/{account}",
    "existsStatus": 200,
    "existsString": "Monero | User",
    "missingStatus": 200,
    "missingString": "Monero | Page not found. Error: 404",
    "protected": false
  },
  {
    "name": "Gettr",
    "uri": "https://gettr.com/api/s/uinf/{account}",
    "existsStatus": 200,
    "existsString": "\"rc\":\"OK\"",
    "missingStatus": 400,
    "missingString": "\"rc\":\"ERR\"",
    "protected": false
  },
  {
    "name": "Gigapan",
    "uri": "https://www.gigapan.com/profiles/{account}",
    "existsStatus": 200,
    "existsString": "width=\"100\"",
    "missingStatus": 404,
    "missingString": "<a href=\"/gigapans\">View Gigapans</a>",
    "protected": false
  },
  {
    "name": "Giphy (Channel)",
    "uri": "https://giphy.com/channel/{account}",
    "existsStatus": 200,
    "existsString": "\\\"user_id\\\"",
    "missingStatus": 404,
    "missingString": "404 Not Found",
    "protected": true
  },
  {
    "name": "Gitea",
    "uri": "https://gitea.com/api/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"user redirect does not exist",
    "protected": false
  },
  {
    "name": "Gitee",
    "uri": "https://gitee.com/{account}",
    "existsStatus": 200,
    "existsString": "class=\"ui container user_page\"",
    "missingStatus": 404,
    "missingString": "class=\"container error midCenter\"",
    "protected": false
  },
  {
    "name": "GitHub (Gists)",
    "uri": "https://api.github.com/users/{account}/gists",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"status\": \"404\"",
    "protected": true
  },
  {
    "name": "GitHub (User)",
    "uri": "https://api.github.com/users/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"status\": \"404\"",
    "protected": true
  },
  {
    "name": "GitLab",
    "uri": "https://gitlab.com/api/v4/users?username={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 200,
    "missingString": "[]",
    "protected": false
  },
  {
    "name": "gloria.tv",
    "uri": "https://gloria.tv/{account}",
    "existsStatus": 200,
    "existsString": "Last online",
    "missingStatus": 404,
    "missingString": "Page unavailable",
    "protected": false
  },
  {
    "name": "GNOME (GitLab)",
    "uri": "https://gitlab.gnome.org/api/v4/users?username={account}",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 200,
    "missingString": "[]",
    "protected": true
  },
  {
    "name": "GNOME (Shell Extensions)",
    "uri": "https://extensions.gnome.org/accounts/profile/{account}",
    "existsStatus": 200,
    "existsString": "class=\"user-details\"",
    "missingStatus": 404,
    "missingString": "<h3>404 - Page not Found</h3>",
    "protected": false
  },
  {
    "name": "GOG",
    "uri": "https://www.gog.com/u/{account}",
    "existsStatus": 200,
    "existsString": "window.profilesData.profileUser",
    "missingStatus": 302,
    "missingString": "href=\"http://www.gog.com/404\"",
    "protected": false
  },
  {
    "name": "Goodgame_Russia",
    "uri": "https://goodgame.ru/channel/{account}/",
    "existsStatus": 200,
    "existsString": "channel_id",
    "missingStatus": 400,
    "missingString": "Такой страницы не существует",
    "protected": false
  },
  {
    "name": "gpodder.net",
    "uri": "https://gpodder.net/user/{account}/",
    "existsStatus": 200,
    "existsString": "mdash; gpodder.net",
    "missingStatus": 404,
    "missingString": "404 - Not found",
    "protected": false
  },
  {
    "name": "grandprof",
    "uri": "https://grandprof.org/communaute/{account}",
    "existsStatus": 200,
    "existsString": "s Profile",
    "missingStatus": 404,
    "missingString": "Mauvaise pioche",
    "protected": false
  },
  {
    "name": "Graphics.social (Mastodon Instance)",
    "uri": "https://graphics.social/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Gravatar",
    "uri": "https://en.gravatar.com/{account}.json",
    "existsStatus": 200,
    "existsString": "entry",
    "missingStatus": 404,
    "missingString": "User not found",
    "protected": false
  },
  {
    "name": "Greasy Fork",
    "uri": "https://greasyfork.org/en/users?q={account}",
    "existsStatus": 200,
    "existsString": "class=\"user-list\"",
    "missingStatus": 200,
    "missingString": "<p>No users!</p>",
    "protected": false
  },
  {
    "name": "GTAinside.com",
    "uri": "https://www.gtainside.com/user/{account}",
    "existsStatus": 200,
    "existsString": "userpage_user",
    "missingStatus": 200,
    "missingString": "<h1>404 Not Found",
    "protected": false
  },
  {
    "name": "gumroad",
    "uri": "https://{account}.gumroad.com/",
    "existsStatus": 200,
    "existsString": "s profile picture",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "Habbo.com",
    "uri": "https://www.habbo.com/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habbo.com.br",
    "uri": "https://www.habbo.com.br/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habbo.com.tr",
    "uri": "https://www.habbo.com.tr/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habbo.de",
    "uri": "https://www.habbo.de/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habbo.es",
    "uri": "https://www.habbo.es/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "not-found",
    "protected": false
  },
  {
    "name": "Habbo.fi",
    "uri": "https://www.habbo.fi/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habbo.fr",
    "uri": "https://www.habbo.fr/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habbo.it",
    "uri": "https://www.habbo.it/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habbo.nl",
    "uri": "https://www.habbo.nl/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId\":",
    "missingStatus": 404,
    "missingString": "error\": \"not-found",
    "protected": false
  },
  {
    "name": "Habr (Q&A)",
    "uri": "https://qna.habr.com/user/{account}",
    "existsStatus": 200,
    "existsString": "class=\"page-header__info\"",
    "missingStatus": 404,
    "missingString": "icon_error_404",
    "protected": false
  },
  {
    "name": "Habr (User)",
    "uri": "https://habr.com/ru/users/{account}/",
    "existsStatus": 200,
    "existsString": "tm-page tm-user",
    "missingStatus": 404,
    "missingString": "tm-error-message",
    "protected": false
  },
  {
    "name": "Habtium",
    "uri": "https://habtium.es/{account}",
    "existsStatus": 200,
    "existsString": "<div class=\"profile-info",
    "missingStatus": 404,
    "missingString": "<h1 class=\"section red\">Oops!",
    "protected": false
  },
  {
    "name": "Hackaday.io",
    "uri": "https://hackaday.io/{account}",
    "existsStatus": 200,
    "existsString": "class=\"following-container \"",
    "missingStatus": 404,
    "missingString": "class=\"error-nav\"",
    "protected": false
  },
  {
    "name": "HackAdvisor",
    "uri": "https://hackadvisor.io/api/v2/profile/{account}/",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "{\"detail\":\"Username not found\"}",
    "protected": false
  },
  {
    "name": "Hacker News",
    "uri": "https://hacker-news.firebaseio.com/v0/user/{account}.json?print=pretty",
    "existsStatus": 200,
    "existsString": "\"id\" :",
    "missingStatus": 200,
    "missingString": "null",
    "protected": false
  },
  {
    "name": "hackerearth",
    "uri": "https://www.hackerearth.com/@{account}",
    "existsStatus": 200,
    "existsString": "| Developer Profile on HackerEarth",
    "missingStatus": 200,
    "missingString": "404 | HackerEarth",
    "protected": false
  },
  {
    "name": "Hackernoon",
    "uri": "https://hackernoon.com/_next/data/foL6JC7ro2FEEMD-gMKgQ/u/{account}.json",
    "existsStatus": 200,
    "existsString": "\"profile\"",
    "missingStatus": 200,
    "missingString": "__N_REDIRECT",
    "protected": false
  },
  {
    "name": "HackerRank",
    "uri": "https://www.hackerrank.com/rest/contests/master/hackers/{account}/profile",
    "existsStatus": 200,
    "existsString": "\"model\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Not Found\"",
    "protected": true
  },
  {
    "name": "Hackster",
    "uri": "https://www.hackster.io/{account}",
    "existsStatus": 200,
    "existsString": "data-hypernova-key=\"UserProfile\"",
    "missingStatus": 404,
    "missingString": "id=\"error\"",
    "protected": false
  },
  {
    "name": "hamaha",
    "uri": "https://hamaha.net/{account}",
    "existsStatus": 200,
    "existsString": "id=\"profile\"",
    "missingStatus": 200,
    "missingString": "content=\"HAMAHA  Биткоин форум. Торговля на бирже - ➨ Обучение Криптовалютам, Биткоин и NYSE \"",
    "protected": false
  },
  {
    "name": "Hanime",
    "uri": "https://hanime.tv/channels/{account}",
    "existsStatus": 200,
    "existsString": "Channel Views",
    "missingStatus": 302,
    "missingString": "DYNAMIC",
    "protected": false
  },
  {
    "name": "Hcommons.social (Mastodon Instance)",
    "uri": "https://hcommons.social/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Heylink",
    "uri": "https://heylink.me/{account}/",
    "existsStatus": 200,
    "existsString": "HeyLink.me |",
    "missingStatus": 404,
    "missingString": "We can't find the page that you're looking for :(",
    "protected": false
  },
  {
    "name": "hiberworld",
    "uri": "https://hiberworld.com/user/{account}",
    "existsStatus": 200,
    "existsString": "Member since ",
    "missingStatus": 200,
    "missingString": "Looks like you got lost ",
    "protected": false
  },
  {
    "name": "HiHello",
    "uri": "https://www.hihello.com/author/{account}",
    "existsStatus": 200,
    "existsString": "\"mainEntity\": {",
    "missingStatus": 404,
    "missingString": "class=\"utility-page-wrap-404\"",
    "protected": false
  },
  {
    "name": "Home Design 3D",
    "uri": "https://www.homedesign3d.net/user/{account}",
    "existsStatus": 200,
    "existsString": "id=\"user_content\"",
    "missingStatus": 302,
    "missingString": "<title>Community</title>",
    "protected": false
  },
  {
    "name": "Hometech.social (Mastodon Instance)",
    "uri": "https://hometech.social/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "hoo.be",
    "uri": "https://hoo.be/{account}",
    "existsStatus": 200,
    "existsString": "--profile-name-color",
    "missingStatus": 404,
    "missingString": "Page Not Found</h3>",
    "protected": false
  },
  {
    "name": "Hostux.social (Mastodon Instance)",
    "uri": "https://hostux.social/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Houzz",
    "uri": "https://www.houzz.com/user/{account}",
    "existsStatus": 200,
    "existsString": "Followers",
    "missingStatus": 404,
    "missingString": "Page Not Found",
    "protected": false
  },
  {
    "name": "HubPages",
    "uri": "https://hubpages.com/@{account}",
    "existsStatus": 200,
    "existsString": "name\">Followers",
    "missingStatus": 404,
    "missingString": "Sorry, that user does not exist",
    "protected": false
  },
  {
    "name": "Hubski",
    "uri": "https://hubski.com/user/{account}",
    "existsStatus": 200,
    "existsString": "'s profile",
    "missingStatus": 200,
    "missingString": "No such user.",
    "protected": false
  },
  {
    "name": "HudsonRock",
    "uri": "https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-username?username={account}",
    "existsStatus": 200,
    "existsString": "This username is associated with a computer that was infected by an info-stealer",
    "missingStatus": 200,
    "missingString": "This username is not associated with a computer infected by an info-stealer",
    "protected": false
  },
  {
    "name": "HuggingFace",
    "uri": "https://huggingface.co/{account}",
    "existsStatus": 200,
    "existsString": "data-target=\"UserProfile\"",
    "missingStatus": 404,
    "missingString": "content=\"404 – Hugging Face\"",
    "protected": false
  },
  {
    "name": "HulkShare",
    "uri": "https://www.hulkshare.com/{account}",
    "existsStatus": 200,
    "existsString": "id=\"profile_image\"",
    "missingStatus": 200,
    "missingString": "Invalid user.",
    "protected": false
  },
  {
    "name": "icq-chat",
    "uri": "https://icq.icqchat.co/members/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"memberHeader-mainContent",
    "missingStatus": 404,
    "missingString": "<title>Oops! We ran into some problems.",
    "protected": false
  },
  {
    "name": "IFTTT",
    "uri": "https://ifttt.com/p/{account}",
    "existsStatus": 200,
    "existsString": "Joined",
    "missingStatus": 404,
    "missingString": "The requested page or file does not exist",
    "protected": false
  },
  {
    "name": "ifunny",
    "uri": "https://ifunny.co/user/{account}",
    "existsStatus": 200,
    "existsString": "subscribers",
    "missingStatus": 404,
    "missingString": "404 - page not found",
    "protected": false
  },
  {
    "name": "igromania",
    "uri": "https://forum.igromania.ru/member.php?username={account}",
    "existsStatus": 200,
    "existsString": "Форум Игромании - Просмотр профиля:",
    "missingStatus": 200,
    "missingString": "Пользователь не зарегистрирован и не имеет профиля для просмотра.",
    "protected": true
  },
  {
    "name": "ILGM Growers Forum",
    "uri": "https://ilgmforum.com/u/{account}/summary.json",
    "existsStatus": 200,
    "existsString": "user_summary\":{",
    "missingStatus": 404,
    "missingString": "errors\":[\"The requested URL",
    "protected": false
  },
  {
    "name": "imagefap",
    "uri": "https://www.imagefap.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "s Profile",
    "missingStatus": 200,
    "missingString": "Invalid uid",
    "protected": false
  },
  {
    "name": "ImageShack",
    "uri": "https://imageshack.com/user/{account}",
    "existsStatus": 200,
    "existsString": "s Images</title>",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "iMGSRC.RU",
    "uri": "https://imgsrc.ru/main/user.php?lang=ru&user={account}",
    "existsStatus": 200,
    "existsString": "Присоединился",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Imgur",
    "uri": "https://api.imgur.com/account/v1/accounts/{account}?client_id=546c25a59c58ad7",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "\"code\":\"404\"",
    "protected": false
  },
  {
    "name": "Immunefi",
    "uri": "https://immunefi.com/profile/{account}/",
    "existsStatus": 200,
    "existsString": "content=\"profile\"",
    "missingStatus": 404,
    "missingString": "id=\"__next_error__\"",
    "protected": false
  },
  {
    "name": "inaturalist",
    "uri": "https://api.inaturalist.org/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"results\":[{",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "Independent academia",
    "uri": "https://independent.academia.edu/{account}",
    "existsStatus": 200,
    "existsString": "- Academia.edu",
    "missingStatus": 404,
    "missingString": "Academia.edu",
    "protected": false
  },
  {
    "name": "InkBunny",
    "uri": "https://inkbunny.net/{account}",
    "existsStatus": 200,
    "existsString": "Profile | Inkbunny, the Furry Art Community</title>",
    "missingStatus": 302,
    "missingString": "<title>Members | Inkbunny, the Furry Art Community</title>",
    "protected": false
  },
  {
    "name": "InsaneJournal",
    "uri": "https://{account}.insanejournal.com/profile",
    "existsStatus": 200,
    "existsString": "User:",
    "missingStatus": 200,
    "missingString": "The requested URL /profile was not found on this server",
    "protected": false
  },
  {
    "name": "Instagram",
    "uri": "https://www.instagram.com/{account}/",
    "existsStatus": 200,
    "existsString": "Posts - See Instagram photos and videos from",
    "missingStatus": 200,
    "missingString": "\"routePath\":null",
    "protected": false
  },
  {
    "name": "Instagram (Imginn)",
    "uri": "https://imginn.com/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"userinfo\"",
    "missingStatus": 410,
    "missingString": "class=\"page-error notfound\"",
    "protected": true
  },
  {
    "name": "Instagram_archives",
    "uri": "https://archive.org/wayback/available?url=https://instagram.com/{account}/",
    "existsStatus": 200,
    "existsString": "\"archived_snapshots\": {\"closest\"",
    "missingStatus": 200,
    "missingString": "\"archived_snapshots\": {}}",
    "protected": false
  },
  {
    "name": "Instructables",
    "uri": "https://www.instructables.com/json-api/showAuthorExists?screenName={account}",
    "existsStatus": 200,
    "existsString": "\"exists\": true",
    "missingStatus": 404,
    "missingString": "\"error\": \"Sorry, we couldn't find that one!\"",
    "protected": false
  },
  {
    "name": "Internet Archive User Contribution Search",
    "uri": "https://archive.org/advancedsearch.php?q=creator:{account}&output=json",
    "existsStatus": 200,
    "existsString": "backup_location",
    "missingStatus": 200,
    "missingString": "numFound\":0",
    "protected": false
  },
  {
    "name": "Internet Archive Username Mentions",
    "uri": "https://archive.org/advancedsearch.php?q={account}&output=json",
    "existsStatus": 200,
    "existsString": "backup_location",
    "missingStatus": 200,
    "missingString": "numFound\":0",
    "protected": false
  },
  {
    "name": "interpals",
    "uri": "https://www.interpals.net/{account}",
    "existsStatus": 200,
    "existsString": "Looking for",
    "missingStatus": 200,
    "missingString": "User not found",
    "protected": false
  },
  {
    "name": "Intigriti",
    "uri": "https://app.intigriti.com/api/user/public/profile/{account}",
    "existsStatus": 200,
    "existsString": "\"userName\":",
    "missingStatus": 404,
    "missingString": "class=\"error-page-container\"",
    "protected": false
  },
  {
    "name": "Issuu",
    "uri": "https://issuu.com/call/signup/v2/check-username/{account}",
    "existsStatus": 200,
    "existsString": "\"status\":\"unavailable\"",
    "missingStatus": 200,
    "missingString": "\"status\":\"available\"",
    "protected": false
  },
  {
    "name": "itch.io",
    "uri": "https://itch.io/profile/{account}",
    "existsStatus": 200,
    "existsString": "class=\"user_data\"",
    "missingStatus": 404,
    "missingString": "class=\"not_found_page page_widget base_widget\"",
    "protected": false
  },
  {
    "name": "iXBT Forum",
    "uri": "https://forum.ixbt.com/users.cgi?id=info:{account}",
    "existsStatus": 200,
    "existsString": "Информация об участнике:",
    "missingStatus": 404,
    "missingString": "Проверьте регистр написания.",
    "protected": false
  },
  {
    "name": "JapanDict",
    "uri": "https://forum.japandict.com/u/{account}",
    "existsStatus": 200,
    "existsString": "class=\"UserPage\"",
    "missingStatus": 404,
    "missingString": "The page you requested could not be found.",
    "protected": false
  },
  {
    "name": "JBZD",
    "uri": "https://jbzd.com.pl/uzytkownik/{account}",
    "existsStatus": 200,
    "existsString": "Dzidy użytkownika",
    "missingStatus": 404,
    "missingString": "Błąd 404",
    "protected": false
  },
  {
    "name": "jeja.pl",
    "uri": "https://www.jeja.pl/user,{account}",
    "existsStatus": 200,
    "existsString": "Profil użytkownika",
    "missingStatus": 200,
    "missingString": "Niepoprawny login",
    "protected": false
  },
  {
    "name": "Jeuxvideo",
    "uri": "https://www.jeuxvideo.com/profil/{account}?mode=infos",
    "existsStatus": 200,
    "existsString": "- jeuxvideo.com",
    "missingStatus": 404,
    "missingString": "rence des gamers",
    "protected": false
  },
  {
    "name": "Joe Monster",
    "uri": "https://joemonster.org/bojownik/{account}",
    "existsStatus": 200,
    "existsString": "jest prywatny",
    "missingStatus": 200,
    "missingString": "Nie wiem jak ci to powiedzieć",
    "protected": false
  },
  {
    "name": "JSFiddle",
    "uri": "https://jsfiddle.net/user/{account}/",
    "existsStatus": 200,
    "existsString": "Settings - JSFiddle - Code Playground",
    "missingStatus": 404,
    "missingString": "That page doesn't exist.",
    "protected": false
  },
  {
    "name": "Justforfans",
    "uri": "https://justfor.fans/{account}",
    "existsStatus": 200,
    "existsString": " @ JustFor.Fans",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Kaggle",
    "uri": "https://www.kaggle.com/{account}",
    "existsStatus": 200,
    "existsString": "property=\"og:username\"",
    "missingStatus": 404,
    "missingString": "<title>Kaggle: Your Home for Data Science</title>",
    "protected": false
  },
  {
    "name": "Keybase",
    "uri": "https://keybase.io/_/api/1.0/user/lookup.json?usernames={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 200,
    "missingString": "\"them\":[null]",
    "protected": false
  },
  {
    "name": "Kick",
    "uri": "https://kick.com/api/v2/channels/{account}",
    "existsStatus": 200,
    "existsString": "\"id\"",
    "missingStatus": 404,
    "missingString": "<title>Not Found</title>",
    "protected": true
  },
  {
    "name": "Kickstarter",
    "uri": "https://www.kickstarter.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "projects",
    "missingStatus": 404,
    "missingString": "Oops, Something went missing",
    "protected": false
  },
  {
    "name": "kik",
    "uri": "https://kik.me/{account}",
    "existsStatus": 200,
    "existsString": "/thumb.jpg\"/>",
    "missingStatus": 200,
    "missingString": "<h1 class=\"display-name\"> </h1>",
    "protected": false
  },
  {
    "name": "kipin",
    "uri": "https://kipin.app/{account}",
    "existsStatus": 200,
    "existsString": "kipin.app/data/photos/resized2/",
    "missingStatus": 302,
    "missingString": "Page not found. Link expired, broken or wrong.",
    "protected": false
  },
  {
    "name": "KnowYourMeme",
    "uri": "https://knowyourmeme.com/users/{account}",
    "existsStatus": 200,
    "existsString": "Contributions",
    "missingStatus": 400,
    "missingString": "404, File Not Found!",
    "protected": false
  },
  {
    "name": "Ko-Fi",
    "uri": "https://ko-fi.com/{account}",
    "existsStatus": 200,
    "existsString": "id=\"profile-header\"",
    "missingStatus": 302,
    "missingString": "<title>Object moved</title>",
    "protected": true
  },
  {
    "name": "komi",
    "uri": "https://api.komi.io/api/talent/usernames/{account}",
    "existsStatus": 200,
    "existsString": "accountStatus\":\"active",
    "missingStatus": 404,
    "missingString": "The talent profile was not found",
    "protected": false
  },
  {
    "name": "Kongregate",
    "uri": "https://www.kongregate.com/accounts/{account}",
    "existsStatus": 200,
    "existsString": "Member Since",
    "missingStatus": 404,
    "missingString": "Sorry, no account with that name was found",
    "protected": false
  },
  {
    "name": "Kwai",
    "uri": "https://www.kwai.com/@{account}",
    "existsStatus": 200,
    "existsString": "name=\"title\"",
    "missingStatus": 200,
    "missingString": "<title>Kwai</title>",
    "protected": false
  },
  {
    "name": "kwejk.pl",
    "uri": "https://kwejk.pl/uzytkownik/{account}#/tablica/",
    "existsStatus": 200,
    "existsString": "Kwejki użytkownika",
    "missingStatus": 404,
    "missingString": "404 - strona nie została znaleziona - KWEJK.pl",
    "protected": false
  },
  {
    "name": "Kwork",
    "uri": "https://kwork.ru/user_kworks/{account}",
    "existsStatus": 200,
    "existsString": "\"success\":true",
    "missingStatus": 200,
    "missingString": "\"success\":false",
    "protected": false
  },
  {
    "name": "Last.fm",
    "uri": "https://www.last.fm/user/{account}",
    "existsStatus": 200,
    "existsString": "class=\"header-info\"",
    "missingStatus": 404,
    "missingString": "<h1>404 - Page Not Found</h1>",
    "protected": false
  },
  {
    "name": "LeakIX",
    "uri": "https://leakix.net/u/{account}",
    "existsStatus": 200,
    "existsString": ">Joined ",
    "missingStatus": 500,
    "missingString": "<title>LeakIX - Server error</title>",
    "protected": true
  },
  {
    "name": "Lemon8",
    "uri": "https://www.lemon8-app.com/{account}?region=us",
    "existsStatus": 200,
    "existsString": "id=\"user-description\"",
    "missingStatus": 404,
    "missingString": "class=\"not_found_text\"",
    "protected": false
  },
  {
    "name": "Letterboxd",
    "uri": "https://letterboxd.com/{account}/",
    "existsStatus": 200,
    "existsString": "’s profile on Letterboxd",
    "missingStatus": 404,
    "missingString": "Sorry, we can’t find the page you’ve requested.",
    "protected": false
  },
  {
    "name": "LevelBlue",
    "uri": "https://otx.alienvault.com/otxapi/auth/validate?username={account}",
    "existsStatus": 400,
    "existsString": "\"username\": [\"This username is already taken\"]",
    "missingStatus": 200,
    "missingString": "{}",
    "protected": false
  },
  {
    "name": "Liberapay",
    "uri": "https://liberapay.com/{account}",
    "existsStatus": 200,
    "existsString": "class=\"profile-header\"",
    "missingStatus": 404,
    "missingString": "Response code: 404",
    "protected": true
  },
  {
    "name": "LibraryThing",
    "uri": "https://www.librarything.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "<dt>Joined</dt>",
    "missingStatus": 200,
    "missingString": "Error: This user doesn't exist",
    "protected": false
  },
  {
    "name": "Libretooth.gr (Mastodon Instance)",
    "uri": "https://libretooth.gr/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "lichess.org",
    "uri": "https://lichess.org/api/player/autocomplete?term={account}&exists=1",
    "existsStatus": 200,
    "existsString": "true",
    "missingStatus": 200,
    "missingString": "false",
    "protected": false
  },
  {
    "name": "LINE",
    "uri": "https://line.me/R/ti/p/@{account}?from=page",
    "existsStatus": 200,
    "existsString": "Add LINE Friends via QR Code",
    "missingStatus": 404,
    "missingString": "404 Not Found",
    "protected": false
  },
  {
    "name": "Linktree",
    "uri": "https://linktr.ee/{account}",
    "existsStatus": 200,
    "existsString": "\"uuid\":",
    "missingStatus": 404,
    "missingString": "\"statusCode\":404",
    "protected": false
  },
  {
    "name": "linux.org.ru",
    "uri": "https://www.linux.org.ru/people/{account}/profile",
    "existsStatus": 200,
    "existsString": "Дата регистрации",
    "missingStatus": 404,
    "missingString": "Пользователя не существует",
    "protected": false
  },
  {
    "name": "LiveJasmin",
    "uri": "https://www.livejasmin.com/en/flash/get-performer-details/{account}",
    "existsStatus": 200,
    "existsString": "\"success\":true",
    "missingStatus": 200,
    "missingString": "\"success\":false",
    "protected": false
  },
  {
    "name": "Livejournal",
    "uri": "https://{account}.livejournal.com",
    "existsStatus": 200,
    "existsString": "<link rel=\"canonical\" href=\"",
    "missingStatus": 404,
    "missingString": "<title>Unknown Journal",
    "protected": false
  },
  {
    "name": "livemaster.ru",
    "uri": "https://www.livemaster.ru/{account}",
    "existsStatus": 200,
    "existsString": "<title>Магазин мастера",
    "missingStatus": 404,
    "missingString": "<title>Вы попали на несуществующую страницу",
    "protected": false
  },
  {
    "name": "lobste.rs",
    "uri": "https://lobste.rs/u/{account}",
    "existsStatus": 200,
    "existsString": "Joined",
    "missingStatus": 404,
    "missingString": "The resource you requested was not found, or the story has been deleted.",
    "protected": false
  },
  {
    "name": "LoLProfile",
    "uri": "https://lolprofile.net/search/world/{account}-world",
    "existsStatus": 200,
    "existsString": "class=\"content sw\">",
    "missingStatus": 200,
    "missingString": "We could not find any results, please try again later or check your input.",
    "protected": false
  },
  {
    "name": "Lor.sh (Mastodon Instance)",
    "uri": "https://lor.sh/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "lowcygier.pl",
    "uri": "https://bazar.lowcygier.pl/user/{account}",
    "existsStatus": 200,
    "existsString": "Zarejestrowany",
    "missingStatus": 404,
    "missingString": "Błąd 404 - Podana strona nie istnieje",
    "protected": false
  },
  {
    "name": "MAGABOOK",
    "uri": "https://magabook.com/{account}",
    "existsStatus": 200,
    "existsString": "Timeline",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Magix",
    "uri": "https://www.magix.info/us/users/profile/{account}/",
    "existsStatus": 200,
    "existsString": "About me",
    "missingStatus": 200,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "Magnific",
    "uri": "https://www.magnific.com/app/api/community/creator-info-by-name?creator_name={account}&lang=en_US",
    "existsStatus": 200,
    "existsString": "\"creator\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"Creator not found\"",
    "protected": false
  },
  {
    "name": "Malpedia Actors",
    "uri": "https://malpedia.caad.fkie.fraunhofer.de/actor/{account}",
    "existsStatus": 200,
    "existsString": "href=\"/actors\"",
    "missingStatus": 404,
    "missingString": "Page not Found.",
    "protected": false
  },
  {
    "name": "MapMyTracks",
    "uri": "https://www.mapmytracks.com/{account}",
    "existsStatus": 200,
    "existsString": "Daily distance this week",
    "missingStatus": 302,
    "missingString": "Outside together",
    "protected": false
  },
  {
    "name": "Mapstodon.space (Mastodon Instance)",
    "uri": "https://mapstodon.space/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Maroc_nl",
    "uri": "https://www.maroc.nl/forums/members/{account}.html",
    "existsStatus": 200,
    "existsString": "Bekijk Profiel:",
    "missingStatus": 200,
    "missingString": "Deze gebruiker is niet geregistreerd",
    "protected": false
  },
  {
    "name": "Marshmallow",
    "uri": "https://marshmallow-qa.com/{account}",
    "existsStatus": 200,
    "existsString": "さんにメッセージをおくる",
    "missingStatus": 404,
    "missingString": "For compensation, here are cats for you.",
    "protected": false
  },
  {
    "name": "Martech",
    "uri": "https://martech.org/author/{account}/",
    "existsStatus": 200,
    "existsString": "twitter:site",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "Massage Anywhere",
    "uri": "https://www.massageanywhere.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "<title>MassageAnywhere.com Profile for ",
    "missingStatus": 200,
    "missingString": "<title>MassageAnywhere.com: Search Results</title>",
    "protected": false
  },
  {
    "name": "masto.ai",
    "uri": "https://masto.ai/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Record not found\"",
    "protected": false
  },
  {
    "name": "Masto.nyc (Mastodon Instance)",
    "uri": "https://masto.nyc/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Mastodon API",
    "uri": "https://mastodon.social/api/v2/search?q={account}&limit=1&type=accounts",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "\"accounts\":[]",
    "protected": false
  },
  {
    "name": "Mastodon-101010.pl",
    "uri": "https://101010.pl/@{account}",
    "existsStatus": 200,
    "existsString": "@101010.pl",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Mastodon-C.IM",
    "uri": "https://c.im/@{account}",
    "existsStatus": 200,
    "existsString": "@c.im) - C.IM</title>",
    "missingStatus": 404,
    "missingString": "<title>The page you are looking for isn&#39;t here",
    "protected": false
  },
  {
    "name": "Mastodon-Chaos.social",
    "uri": "https://chaos.social/@{account}",
    "existsStatus": 200,
    "existsString": "@chaos.social) - chaos.social</title>",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Mastodon-Defcon",
    "uri": "https://defcon.social/@{account}",
    "existsStatus": 200,
    "existsString": "- DEF CON Social</title>",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Mastodon-mastodon",
    "uri": "https://mastodon.social/@{account}",
    "existsStatus": 200,
    "existsString": "profile:username",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn't here.",
    "protected": false
  },
  {
    "name": "Mastodon-meow.social",
    "uri": "https://meow.social/@{account}",
    "existsStatus": 200,
    "existsString": "- the mastodon instance for creatures fluffy, scaly and otherwise</title>",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Mastodon-mstdn.io",
    "uri": "https://mstdn.io/@{account}",
    "existsStatus": 200,
    "existsString": "@mstdn.io) - Mastodon",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Mastodon-rigcz.club",
    "uri": "https://rigcz.club/@{account}",
    "existsStatus": 200,
    "existsString": "@rigcz.club",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn't here.",
    "protected": false
  },
  {
    "name": "Mastodon-social_tchncs",
    "uri": "https://social.tchncs.de/@{account}",
    "existsStatus": 200,
    "existsString": "profile:username",
    "missingStatus": 301,
    "missingString": "The page you are looking for isn&#39;t here",
    "protected": false
  },
  {
    "name": "Mastodon-Toot.Community",
    "uri": "https://toot.community/@{account}",
    "existsStatus": 200,
    "existsString": "@toot.community) - toot.community</title>",
    "missingStatus": 404,
    "missingString": "The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Mastodon.online",
    "uri": "https://mastodon.online/@{account}",
    "existsStatus": 200,
    "existsString": "@mastodon.online) - Mastodon</title>",
    "missingStatus": 404,
    "missingString": "<title>The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Mastodonbooks.net (Mastodon Instance)",
    "uri": "https://mastodonbooks.net/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "MCUUID (Minecraft)",
    "uri": "https://playerdb.co/api/player/minecraft/{account}",
    "existsStatus": 200,
    "existsString": "Successfully found player by given ID.",
    "missingStatus": 200,
    "missingString": "minecraft.api_failure",
    "protected": false
  },
  {
    "name": "Medium",
    "uri": "https://medium.com/@{account}/about",
    "existsStatus": 200,
    "existsString": "Medium member since",
    "missingStatus": 404,
    "missingString": "Out of nothing, something",
    "protected": false
  },
  {
    "name": "meet me",
    "uri": "https://www.meetme.com/{account}",
    "existsStatus": 200,
    "existsString": "<title>Meet people like ",
    "missingStatus": 302,
    "missingString": "<title>MeetMe - Chat and Meet New People</title",
    "protected": false
  },
  {
    "name": "Meta-Wiki (Wikimedia)",
    "uri": "https://meta.wikimedia.org/wiki/Special:CentralAuth?target={account}",
    "existsStatus": 200,
    "existsString": "id='mw-centralauth-info'",
    "missingStatus": 200,
    "missingString": "There is no global account for",
    "protected": true
  },
  {
    "name": "Metacritic",
    "uri": "https://www.metacritic.com/user/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"c-pageProfile-wrapper\"",
    "missingStatus": 404,
    "missingString": "class=\"c-error404\"",
    "protected": false
  },
  {
    "name": "Microsoft Learn",
    "uri": "https://learn.microsoft.com/api/profiles/{account}",
    "existsStatus": 200,
    "existsString": "\"userId\":",
    "missingStatus": 404,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Minds",
    "uri": "https://www.minds.com/api/v3/register/validate?username={account}",
    "existsStatus": 200,
    "existsString": "\"valid\":false",
    "missingStatus": 200,
    "missingString": "\"valid\":true",
    "protected": false
  },
  {
    "name": "Minecraft List",
    "uri": "https://minecraftlist.com/api/legacy/players/{account}",
    "existsStatus": 200,
    "existsString": "\"found\":true",
    "missingStatus": 200,
    "missingString": "\"found\":false",
    "protected": false
  },
  {
    "name": "mintme",
    "uri": "https://www.mintme.com/token/{account}",
    "existsStatus": 200,
    "existsString": "token | mintMe",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "Mistrzowie",
    "uri": "https://mistrzowie.org/user/{account}",
    "existsStatus": 200,
    "existsString": "Profil użytkownika",
    "missingStatus": 200,
    "missingString": "Nie znaleziono użytkownika o podanym loginie.",
    "protected": false
  },
  {
    "name": "Mix",
    "uri": "https://mix.com/{account}/",
    "existsStatus": 200,
    "existsString": "<title>@",
    "missingStatus": 302,
    "missingString": "The best content from the open web, personalized.",
    "protected": false
  },
  {
    "name": "Mixcloud",
    "uri": "https://api.mixcloud.com/{account}/",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "\"error\":",
    "protected": false
  },
  {
    "name": "Mixi",
    "uri": "https://mixi.jp/view_community.pl?id={account}",
    "existsStatus": 200,
    "existsString": "| mixiコミュニティ</title>",
    "missingStatus": 200,
    "missingString": "データがありません",
    "protected": false
  },
  {
    "name": "Mixlr",
    "uri": "https://api.mixlr.com/users/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Resource not found\"",
    "protected": false
  },
  {
    "name": "Mmorpg",
    "uri": "https://forums.mmorpg.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "MMORPG.com Forums",
    "missingStatus": 404,
    "missingString": "404 Not Not_Found",
    "protected": false
  },
  {
    "name": "MobileGTA.net",
    "uri": "https://www.mobilegta.net/en/user/{account}",
    "existsStatus": 200,
    "existsString": "userpage_user",
    "missingStatus": 200,
    "missingString": "<h1>404 Not Found",
    "protected": false
  },
  {
    "name": "Mod DB",
    "uri": "https://www.moddb.com/html/scripts/autocomplete.php?a=username&q={account}",
    "existsStatus": 200,
    "existsString": "\"available\":false",
    "missingStatus": 200,
    "missingString": "\"available\":true",
    "protected": false
  },
  {
    "name": "MODX.im",
    "uri": "https://modx.evo.im/profile/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"profile\"",
    "missingStatus": 404,
    "missingString": "class=\"content-error\"",
    "protected": false
  },
  {
    "name": "Monkeytype",
    "uri": "https://api.monkeytype.com/users/{account}/profile",
    "existsStatus": 200,
    "existsString": "\"message\":\"Profile retrieved\"",
    "missingStatus": 404,
    "missingString": "\"message\":\"User not found\"",
    "protected": false
  },
  {
    "name": "Moto Trip",
    "uri": "https://moto-trip.com/profil/{account}",
    "existsStatus": 200,
    "existsString": "<h1 class=\"h2\">Profil de ",
    "missingStatus": 404,
    "missingString": "<h1>Page introuvable</h1>",
    "protected": false
  },
  {
    "name": "Motokiller",
    "uri": "https://mklr.pl/user/{account}",
    "existsStatus": 200,
    "existsString": "Zamieszcza materiały od:",
    "missingStatus": 200,
    "missingString": "Nie znaleziono użytkownika o podanym loginie.",
    "protected": false
  },
  {
    "name": "Moxfield",
    "uri": "https://api2.moxfield.com/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"userName\":",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "mssg.me",
    "uri": "https://{account}.mssg.me/",
    "existsStatus": 200,
    "existsString": "property=\"og:title\"",
    "missingStatus": 404,
    "missingString": "id=\"page_404\"",
    "protected": false
  },
  {
    "name": "Muck Rack",
    "uri": "https://muckrack.com/{account}",
    "existsStatus": 200,
    "existsString": "on Muck Rack",
    "missingStatus": 404,
    "missingString": "Oh no! Page not found.",
    "protected": false
  },
  {
    "name": "Musician.social (Mastodon Instance)",
    "uri": "https://musician.social/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "musictraveler",
    "uri": "https://www.musictraveler.com/en/users/{account}/",
    "existsStatus": 200,
    "existsString": "on Music Traveler</title>",
    "missingStatus": 404,
    "missingString": "<title>Page Not found</title>",
    "protected": false
  },
  {
    "name": "MUYZORRAS",
    "uri": "https://www.muyzorras.com/usuarios/{account}",
    "existsStatus": 200,
    "existsString": "og:title",
    "missingStatus": 404,
    "missingString": "<title>Error 404",
    "protected": false
  },
  {
    "name": "my_instants",
    "uri": "https://www.myinstants.com/en/profile/{account}/",
    "existsStatus": 200,
    "existsString": " | Myinstants</title>",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "MyAnimeList",
    "uri": "https://myanimelist.net/profile/{account}",
    "existsStatus": 200,
    "existsString": "Profile - MyAnimeList.net",
    "missingStatus": 404,
    "missingString": "<title>404 Not Found",
    "protected": false
  },
  {
    "name": "MyBuilder.com",
    "uri": "https://www.mybuilder.com/profile/view/{account}",
    "existsStatus": 200,
    "existsString": "feedback",
    "missingStatus": 404,
    "missingString": "Whoops! You broke our site!",
    "protected": false
  },
  {
    "name": "MyFitnessPal Author",
    "uri": "https://blog.myfitnesspal.com/author/{account}/",
    "existsStatus": 200,
    "existsString": "About the Author",
    "missingStatus": 404,
    "missingString": "<title>Page not found ",
    "protected": false
  },
  {
    "name": "MyFitnessPal Community",
    "uri": "https://community.myfitnesspal.com/en/profile/{account}",
    "existsStatus": 200,
    "existsString": ">Last Active<",
    "missingStatus": 404,
    "missingString": "User Not Found",
    "protected": false
  },
  {
    "name": "MyLot",
    "uri": "https://www.mylot.com/{account}",
    "existsStatus": 200,
    "existsString": "on myLot</title>",
    "missingStatus": 404,
    "missingString": " / Whoops!",
    "protected": false
  },
  {
    "name": "MYM",
    "uri": "https://mym.fans/{account}",
    "existsStatus": 200,
    "existsString": "class=\"page profile\"",
    "missingStatus": 404,
    "missingString": "class=\"page page-404\"",
    "protected": false
  },
  {
    "name": "MyNickname",
    "uri": "https://mynickname.com/en/search?q={account}",
    "existsStatus": 200,
    "existsString": "nickname found:</h2>",
    "missingStatus": 200,
    "missingString": "<h2>Nickname not found. Try searching for similar nicknames.</h2>",
    "protected": false
  },
  {
    "name": "myportfolio",
    "uri": "https://{account}.myportfolio.com/work",
    "existsStatus": 200,
    "existsString": "class=\"page-title",
    "missingStatus": 302,
    "missingString": "<title>Adobe Portfolio | Build your own personalized website</title>",
    "protected": false
  },
  {
    "name": "MySpace",
    "uri": "https://myspace.com/{account}",
    "existsStatus": 200,
    "existsString": "<!-- Profile -->",
    "missingStatus": 404,
    "missingString": "<!-- 404 -->",
    "protected": false
  },
  {
    "name": "Myspreadshop",
    "uri": "https://myspreadshop.de/{account}/shopData/list",
    "existsStatus": 200,
    "existsString": "siteName",
    "missingStatus": 404,
    "missingString": "not found",
    "protected": false
  },
  {
    "name": "myWishBoard",
    "uri": "https://mywishboard.com/@{account}",
    "existsStatus": 200,
    "existsString": "class=\"MwbUserHeader\"",
    "missingStatus": 404,
    "missingString": "class=\"MwbError\"",
    "protected": false
  },
  {
    "name": "naija_planet",
    "uri": "https://naijaplanet.com/{account}",
    "existsStatus": 200,
    "existsString": "dating Profile, ",
    "missingStatus": 200,
    "missingString": "- NaijaPlanet!",
    "protected": false
  },
  {
    "name": "nairaland",
    "uri": "https://www.nairaland.com/{account}",
    "existsStatus": 200,
    "existsString": "s Profile",
    "missingStatus": 301,
    "missingString": "404: Page Not Found",
    "protected": false
  },
  {
    "name": "NaturalNews",
    "uri": "https://naturalnews.com/author/{account}/",
    "existsStatus": 200,
    "existsString": "All posts by",
    "missingStatus": 200,
    "missingString": "The page you are looking for cannot be found or is no longer available.",
    "protected": false
  },
  {
    "name": "Naver",
    "uri": "https://blog.naver.com/{account}",
    "existsStatus": 200,
    "existsString": " : 네이버 블로그",
    "missingStatus": 500,
    "missingString": "페이지를 찾을 수 없습니다",
    "protected": false
  },
  {
    "name": "Neocities",
    "uri": "https://neocities.org/site/{account}",
    "existsStatus": 200,
    "existsString": "noindex, follow",
    "missingStatus": 404,
    "missingString": "- Not Found</title>",
    "protected": false
  },
  {
    "name": "Newgrounds",
    "uri": "https://{account}.newgrounds.com/",
    "existsStatus": 200,
    "existsString": "user-header-name",
    "missingStatus": 404,
    "missingString": "Whoops, that's a swing and a miss!",
    "protected": false
  },
  {
    "name": "newmeet",
    "uri": "https://www.newmeet.com/en/profile/{account}/",
    "existsStatus": 200,
    "existsString": "<h2>The profile of",
    "missingStatus": 200,
    "missingString": "Chat with , , ,  - ",
    "protected": false
  },
  {
    "name": "Nifty Gateway",
    "uri": "https://api.niftygateway.com/user/profile-and-offchain-nifties-by-url/?profile_url={account}",
    "existsStatus": 200,
    "existsString": "&quot;didSucceed&quot;: true",
    "missingStatus": 400,
    "missingString": "&quot;didSucceed&quot;: false",
    "protected": false
  },
  {
    "name": "Nightbot",
    "uri": "https://api.nightbot.tv/1/channels/t/{account}",
    "existsStatus": 200,
    "existsString": "\"status\":200",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "Nih Buat Jajan",
    "uri": "https://www.nihbuatjajan.com/manifest/{account}.json",
    "existsStatus": 200,
    "existsString": "\"name\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Creator not found\"",
    "protected": false
  },
  {
    "name": "Nitecrew (Mastodon Instance)",
    "uri": "https://nitecrew.rip/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "nnru",
    "uri": "https://{account}.www.nn.ru",
    "existsStatus": 200,
    "existsString": "<title> ",
    "missingStatus": 404,
    "missingString": "<title>Ошибка 404 -",
    "protected": false
  },
  {
    "name": "NotABug",
    "uri": "https://notabug.org/{account}",
    "existsStatus": 200,
    "existsString": "class=\"user profile\"",
    "missingStatus": 404,
    "missingString": "alt=\"404\"",
    "protected": false
  },
  {
    "name": "Note",
    "uri": "https://note.com/api/v2/creators/{account}",
    "existsStatus": 200,
    "existsString": "\"data\":{",
    "missingStatus": 404,
    "missingString": "\"data\":\"リソースが見つかりません\"",
    "protected": false
  },
  {
    "name": "npm",
    "uri": "https://www.npmjs.com/~{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "<h1>not found</h1>",
    "protected": false
  },
  {
    "name": "oglaszamy24h.pl",
    "uri": "https://oglaszamy24h.pl/profil,{account}",
    "existsStatus": 200,
    "existsString": "Profil użytkownika:",
    "missingStatus": 404,
    "missingString": "Nieprawidłowy link, w bazie danych nie istnieje użytkownik o podanym loginie",
    "protected": false
  },
  {
    "name": "ok.ru",
    "uri": "https://ok.ru/{account}",
    "existsStatus": 200,
    "existsString": "| OK",
    "missingStatus": 404,
    "missingString": "class=\"p404_t",
    "protected": false
  },
  {
    "name": "okidoki",
    "uri": "https://m.okidoki.ee/ru/users/{account}/",
    "existsStatus": 200,
    "existsString": "Пользователь",
    "missingStatus": 404,
    "missingString": "Страница не найдена",
    "protected": false
  },
  {
    "name": "omg.lol",
    "uri": "https://api.omg.lol/address/{account}/info",
    "existsStatus": 200,
    "existsString": "\"success\": true",
    "missingStatus": 200,
    "missingString": "\"success\": false",
    "protected": false
  },
  {
    "name": "Opencollective",
    "uri": "https://opencollective.com/{account}",
    "existsStatus": 200,
    "existsString": "- Open Collective",
    "missingStatus": 200,
    "missingString": "Not Found",
    "protected": false
  },
  {
    "name": "OpenSource",
    "uri": "https://opensource.com/users/{account}",
    "existsStatus": 200,
    "existsString": "\"contentID\":",
    "missingStatus": 404,
    "missingString": "\"errorCode\": \"404\"",
    "protected": false
  },
  {
    "name": "OpenStreetMap",
    "uri": "https://www.openstreetmap.org/user/{account}",
    "existsStatus": 200,
    "existsString": "Mapper since:",
    "missingStatus": 404,
    "missingString": "does not exist",
    "protected": false
  },
  {
    "name": "OpenStreetMap Wiki",
    "uri": "https://wiki.openstreetmap.org/w/api.php?action=query&format=json&list=users&ususers={account}",
    "existsStatus": 200,
    "existsString": "\"userid\":",
    "missingStatus": 200,
    "missingString": "\"missing\":\"\"",
    "protected": false
  },
  {
    "name": "Oper.ru",
    "uri": "https://oper.ru/visitors/info.php?t={account}",
    "existsStatus": 200,
    "existsString": "Информация о пользователе",
    "missingStatus": 200,
    "missingString": "Нет такого пользователя",
    "protected": false
  },
  {
    "name": "OPGG",
    "uri": "https://eune.op.gg/summoners/eune/{account}",
    "existsStatus": 200,
    "existsString": "- Summoner Stats - League of Legends",
    "missingStatus": 200,
    "missingString": "Guide - OP.GG",
    "protected": false
  },
  {
    "name": "Orbys",
    "uri": "https://orbys.net/{account}",
    "existsStatus": 200,
    "existsString": "profile_user_image",
    "missingStatus": 404,
    "missingString": "The page you are looking for cannot be found.",
    "protected": false
  },
  {
    "name": "Origins.Habbo.com",
    "uri": "https://origins.habbo.com/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId",
    "missingStatus": 404,
    "missingString": "not-found",
    "protected": false
  },
  {
    "name": "Origins.Habbo.com.br",
    "uri": "https://origins.habbo.com.br/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId",
    "missingStatus": 404,
    "missingString": "not-found",
    "protected": false
  },
  {
    "name": "Origins.Habbo.es",
    "uri": "https://origins.habbo.es/api/public/users?name={account}",
    "existsStatus": 200,
    "existsString": "uniqueId",
    "missingStatus": 404,
    "missingString": "not-found",
    "protected": false
  },
  {
    "name": "osu!",
    "uri": "https://osu.ppy.sh/users/{account}",
    "existsStatus": 302,
    "existsString": "",
    "missingStatus": 404,
    "missingString": "User not found! ;_;",
    "protected": false
  },
  {
    "name": "Our Freedom Book",
    "uri": "https://www.ourfreedombook.com/{account}",
    "existsStatus": 200,
    "existsString": "meta property=\"og:",
    "missingStatus": 302,
    "missingString": "Sorry, page not found",
    "protected": false
  },
  {
    "name": "palnet",
    "uri": "https://www.palnet.io/@{account}/",
    "existsStatus": 200,
    "existsString": "class=\"profile-cover\"",
    "missingStatus": 404,
    "missingString": "Unknown user account!",
    "protected": false
  },
  {
    "name": "Paragraph",
    "uri": "https://paragraph.com/api/blogs/@{account}",
    "existsStatus": 200,
    "existsString": "\"user\":{",
    "missingStatus": 404,
    "missingString": "\"Missing blog\"",
    "protected": false
  },
  {
    "name": "Parler",
    "uri": "https://parler.com/user/{account}",
    "existsStatus": 200,
    "existsString": "People to Follow",
    "missingStatus": 302,
    "missingString": "join Parler today",
    "protected": false
  },
  {
    "name": "Parler archived posts",
    "uri": "http://archive.org/wayback/available?url=https://parler.com/profile/{account}/posts",
    "existsStatus": 200,
    "existsString": "\"archived_snapshots\": {\"closest\"",
    "missingStatus": 200,
    "missingString": "\"archived_snapshots\": {}",
    "protected": false
  },
  {
    "name": "Parler archived profile",
    "uri": "http://archive.org/wayback/available?url=https://parler.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "\"archived_snapshots\": {\"closest\"",
    "missingStatus": 200,
    "missingString": "\"archived_snapshots\": {}",
    "protected": false
  },
  {
    "name": "Pastebin",
    "uri": "https://pastebin.com/u/{account}",
    "existsStatus": 200,
    "existsString": "class=\"user-view\"",
    "missingStatus": 404,
    "missingString": "Not Found (#404)",
    "protected": false
  },
  {
    "name": "patch",
    "uri": "https://patch.com/users/{account}",
    "existsStatus": 200,
    "existsString": "<title>Patch User Profile",
    "missingStatus": 404,
    "missingString": "<title>Page not found</title>",
    "protected": false
  },
  {
    "name": "PatientsLikeMe",
    "uri": "https://www.patientslikeme.com/members/{account}",
    "existsStatus": 200,
    "existsString": "s profile | PatientsLikeMe</title>",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Patreon",
    "uri": "https://www.patreon.com/{account}",
    "existsStatus": 200,
    "existsString": "full_name\":",
    "missingStatus": 404,
    "missingString": "errorCode\": 404,",
    "protected": false
  },
  {
    "name": "Patriots Win",
    "uri": "https://patriots.win/api/v2/user/about.json?user={account}",
    "existsStatus": 200,
    "existsString": "\"users\":[{",
    "missingStatus": 200,
    "missingString": "\"error\":\"invalid user\"",
    "protected": false
  },
  {
    "name": "Patronite",
    "uri": "https://patronite.pl/{account}",
    "existsStatus": 200,
    "existsString": "Zostań Patronem",
    "missingStatus": 404,
    "missingString": "Nie znaleźliśmy strony której szukasz.",
    "protected": false
  },
  {
    "name": "PayPal Business",
    "uri": "https://www.paypal.com/biz/profile-data/{account}",
    "existsStatus": 200,
    "existsString": "\"payerId\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"RESOURCE_NOT_FOUND\"",
    "protected": false
  },
  {
    "name": "PayPal.Me",
    "uri": "https://www.paypal.com/paypalme/{account}",
    "existsStatus": 200,
    "existsString": "\"recipientSlugDetails\":",
    "missingStatus": 200,
    "missingString": "\",\"griffinMetadata\":{\"",
    "protected": false
  },
  {
    "name": "PCPartPicker",
    "uri": "https://pcpartpicker.com/user/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"active\"",
    "missingStatus": 404,
    "missingString": "The page you requested could not be found.",
    "protected": false
  },
  {
    "name": "Peerlist",
    "uri": "https://peerlist.io/api/v1/users/profile/tldr?handle={account}",
    "existsStatus": 200,
    "existsString": "\"tldr\":",
    "missingStatus": 500,
    "missingString": "\"message\":\"User Not found\"",
    "protected": true
  },
  {
    "name": "Peing",
    "uri": "https://peing.net/en/{account}",
    "existsStatus": 200,
    "existsString": "data-route-user-id-main=''",
    "missingStatus": 302,
    "missingString": "user_is_not_found",
    "protected": false
  },
  {
    "name": "Peoople (Creator)",
    "uri": "https://peoople.app/en/creator/{account}/",
    "existsStatus": 200,
    "existsString": "\"@type\":\"BreadcrumbList\"",
    "missingStatus": 404,
    "missingString": "id=\"__next_error__\"",
    "protected": true
  },
  {
    "name": "Peoople (Influencer)",
    "uri": "https://peoople.app/en/influencer/{account}/",
    "existsStatus": 200,
    "existsString": "\"@type\":\"BreadcrumbList\"",
    "missingStatus": 404,
    "missingString": "id=\"__next_error__\"",
    "protected": true
  },
  {
    "name": "Peoople (Star)",
    "uri": "https://peoople.app/en/star/{account}/",
    "existsStatus": 200,
    "existsString": "\"@type\":\"BreadcrumbList\"",
    "missingStatus": 404,
    "missingString": "id=\"__next_error__\"",
    "protected": true
  },
  {
    "name": "Peoople (Unicorn)",
    "uri": "https://peoople.app/en/unicorn/{account}/",
    "existsStatus": 200,
    "existsString": "\"@type\":\"BreadcrumbList\"",
    "missingStatus": 404,
    "missingString": "id=\"__next_error__\"",
    "protected": true
  },
  {
    "name": "Periscope",
    "uri": "https://www.periscope.tv/{account}",
    "existsStatus": 200,
    "existsString": "<label>Followers",
    "missingStatus": 404,
    "missingString": "Sorry, this page doesn’t exist",
    "protected": false
  },
  {
    "name": "Pewex",
    "uri": "https://retro.pewex.pl/user/{account}",
    "existsStatus": 200,
    "existsString": "Zamieszcza eksponaty od:",
    "missingStatus": 200,
    "missingString": "Nie znaleziono użytkownika o podanym loginie.",
    "protected": false
  },
  {
    "name": "Picsart",
    "uri": "https://api.picsart.com/users/show/{account}.json",
    "existsStatus": 200,
    "existsString": "\"status\":\"success\"",
    "missingStatus": 200,
    "missingString": "\"status\":\"error\"",
    "protected": false
  },
  {
    "name": "Piekielni",
    "uri": "https://piekielni.pl/user/{account}",
    "existsStatus": 200,
    "existsString": "Zamieszcza historie od:",
    "missingStatus": 200,
    "missingString": "Nie znaleziono użytkownika o podanym loginie.",
    "protected": false
  },
  {
    "name": "Pillowfort",
    "uri": "https://www.pillowfort.social/{account}/json/?p=1",
    "existsStatus": 200,
    "existsString": "\"posts\":",
    "missingStatus": 404,
    "missingString": "<title>(404)</title>",
    "protected": false
  },
  {
    "name": "PinkBike",
    "uri": "https://www.pinkbike.com/u/{account}/",
    "existsStatus": 200,
    "existsString": "on Pinkbike</title>",
    "missingStatus": 404,
    "missingString": "I couldn't find the page you were looking for",
    "protected": false
  },
  {
    "name": "Pinterest",
    "uri": "https://www.pinterest.com/{account}/",
    "existsStatus": 200,
    "existsString": " - Profile | Pinterest",
    "missingStatus": 301,
    "missingString": "id=\"home-main-title",
    "protected": false
  },
  {
    "name": "pixelfed.social",
    "uri": "https://pixelfed.social/{account}",
    "existsStatus": 200,
    "existsString": "on pixelfed</title>",
    "missingStatus": 404,
    "missingString": "<title>pixelfed</title>",
    "protected": false
  },
  {
    "name": "Planoly",
    "uri": "https://planoly.store/{account}",
    "existsStatus": 200,
    "existsString": "\"creatorLink\":{",
    "missingStatus": 404,
    "missingString": "\"statusCode\":404",
    "protected": false
  },
  {
    "name": "Playstation Network",
    "uri": "https://psnprofiles.com/xhr/search/users?q={account}",
    "existsStatus": 200,
    "existsString": "<div class=\"progress-bar small level\">",
    "missingStatus": 200,
    "missingString": "We couldn't find anything ",
    "protected": false
  },
  {
    "name": "Plink",
    "uri": "https://plink.gg/user/{account}",
    "existsStatus": 200,
    "existsString": "class=\"user-page\"",
    "missingStatus": 404,
    "missingString": "<title>PLINK - 404 Page not found</title>",
    "protected": false
  },
  {
    "name": "Plurk",
    "uri": "https://www.plurk.com/{account}",
    "existsStatus": 200,
    "existsString": "Profile views",
    "missingStatus": 200,
    "missingString": "Register your plurk account",
    "protected": false
  },
  {
    "name": "Poe.com",
    "uri": "https://poe.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "\"__isNode\":\"PoeUser\"",
    "missingStatus": 200,
    "missingString": "\"user\":null",
    "protected": false
  },
  {
    "name": "Pokec",
    "uri": "https://pokec.azet.sk/{account}",
    "existsStatus": 200,
    "existsString": "idReportedUser",
    "missingStatus": 404,
    "missingString": "Neexistujúci používateľ",
    "protected": false
  },
  {
    "name": "pokemonshowdown",
    "uri": "https://pokemonshowdown.com/users/{account}",
    "existsStatus": 200,
    "existsString": "Official ladder",
    "missingStatus": 404,
    "missingString": " (Unregistered)",
    "protected": false
  },
  {
    "name": "Polarsteps",
    "uri": "https://api.polarsteps.com/users/byusername/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "<title>404 Not Found</title>",
    "protected": false
  },
  {
    "name": "Polchat.pl",
    "uri": "https://polczat.pl/forum/profile/{account}/",
    "existsStatus": 200,
    "existsString": "Historia wpisów",
    "missingStatus": 200,
    "missingString": "Wybrany użytkownik nie istnieje.",
    "protected": false
  },
  {
    "name": "policja2009",
    "uri": "http://www.policja2009.fora.pl/search.php?search_author={account}",
    "existsStatus": 200,
    "existsString": "Autor",
    "missingStatus": 200,
    "missingString": "Nie znaleziono tematów ani postów pasujących do Twoich kryteriów",
    "protected": false
  },
  {
    "name": "Poll Everywhere",
    "uri": "https://pollev.com/proxy/api/users/{account}",
    "existsStatus": 200,
    "existsString": "name",
    "missingStatus": 404,
    "missingString": "ResourceNotFound",
    "protected": false
  },
  {
    "name": "polygon",
    "uri": "https://www.polygon.com/users/{account}",
    "existsStatus": 200,
    "existsString": "- Polygon",
    "missingStatus": 404,
    "missingString": "404 Not found",
    "protected": false
  },
  {
    "name": "popl",
    "uri": "https://poplme.co/{account}",
    "existsStatus": 200,
    "existsString": "MuiTypography-root MuiTypography-body1 css-kj7pvm",
    "missingStatus": 200,
    "missingString": "Profile not found",
    "protected": false
  },
  {
    "name": "Pornhub (Model)",
    "uri": "https://www.pornhub.com/model/{account}",
    "existsStatus": 200,
    "existsString": "class=\"topProfileHeader\"",
    "missingStatus": 301,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Pornhub (Pornstar)",
    "uri": "https://www.pornhub.com/pornstar/{account}",
    "existsStatus": 200,
    "existsString": "class=\"topProfileHeader\"",
    "missingStatus": 301,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Pornhub (User)",
    "uri": "https://www.pornhub.com/users/{account}",
    "existsStatus": 200,
    "existsString": "id=\"topProfileHeader\"",
    "missingStatus": 404,
    "missingString": "<title>Page Not Found</title>",
    "protected": false
  },
  {
    "name": "Poshmark",
    "uri": "https://poshmark.com/closet/{account}",
    "existsStatus": 200,
    "existsString": " is using Poshmark to sell items from their closet.",
    "missingStatus": 404,
    "missingString": "Page not found - Poshmark",
    "protected": false
  },
  {
    "name": "postcrossing",
    "uri": "https://www.postcrossing.com/user/{account}",
    "existsStatus": 200,
    "existsString": ", from",
    "missingStatus": 404,
    "missingString": "- Postcrossing",
    "protected": false
  },
  {
    "name": "Poweredbygay.social (Mastodon Instance)",
    "uri": "https://poweredbygay.social/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Pr0gramm",
    "uri": "https://pr0gramm.com/api/profile/info?name={account}",
    "existsStatus": 200,
    "existsString": "\"user\":",
    "missingStatus": 404,
    "missingString": "\"code\":404",
    "protected": true
  },
  {
    "name": "Pravda.me",
    "uri": "https://pravda.me/@{account}",
    "existsStatus": 200,
    "existsString": "Российская социальная сеть (by mastodon)</title>",
    "missingStatus": 404,
    "missingString": "<title>The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "Privacy Guides",
    "uri": "https://discuss.privacyguides.net/u/{account}.json",
    "existsStatus": 200,
    "existsString": "assign_path",
    "missingStatus": 404,
    "missingString": "The requested URL or resource could not be found.",
    "protected": false
  },
  {
    "name": "Producthunt",
    "uri": "https://www.producthunt.com/@{account}",
    "existsStatus": 200,
    "existsString": "s profile on Product Hunt",
    "missingStatus": 404,
    "missingString": "Product Hunt - All newest Products",
    "protected": false
  },
  {
    "name": "Pronouns.Page",
    "uri": "https://pronouns.page/api/profile/get/{account}?version=2",
    "existsStatus": 200,
    "existsString": "username",
    "missingStatus": 304,
    "missingString": "\"profiles\": {}",
    "protected": false
  },
  {
    "name": "Pronouny",
    "uri": "https://pronouny.xyz/api/users/profile/username/{account}",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 400,
    "missingString": "That user doesn't exist",
    "protected": false
  },
  {
    "name": "Prose",
    "uri": "https://prose.astral.camp/{account}/",
    "existsStatus": 200,
    "existsString": "blog-title",
    "missingStatus": 404,
    "missingString": "Are you sure it was ever here?",
    "protected": false
  },
  {
    "name": "prv.pl",
    "uri": "https://www.prv.pl/osoba/{account}",
    "existsStatus": 200,
    "existsString": "LOGIN",
    "missingStatus": 200,
    "missingString": "Użytkownik nie istnieje.",
    "protected": false
  },
  {
    "name": "Public.com",
    "uri": "https://public.com/@{account}",
    "existsStatus": 200,
    "existsString": "\"publicId\":",
    "missingStatus": 404,
    "missingString": "<title>404 - Page Not Found</title>",
    "protected": false
  },
  {
    "name": "pypi",
    "uri": "https://pypi.org/user/{account}/",
    "existsStatus": 200,
    "existsString": "Profile of",
    "missingStatus": 404,
    "missingString": "Page Not Found (404) · PyPI",
    "protected": false
  },
  {
    "name": "QUEER PL",
    "uri": "https://queer.pl/user/{account}",
    "existsStatus": 200,
    "existsString": "Ostatnio on-line",
    "missingStatus": 404,
    "missingString": "Strona nie została znaleziona",
    "protected": false
  },
  {
    "name": "quitter.pl",
    "uri": "https://quitter.pl/api/v1/accounts/{account}",
    "existsStatus": 200,
    "existsString": "avatar_static",
    "missingStatus": 404,
    "missingString": "\"error\":",
    "protected": false
  },
  {
    "name": "Quizlet",
    "uri": "https://quizlet.com/webapi/3.2/users/check-username?username={account}",
    "existsStatus": 200,
    "existsString": "\"identifier\":\"username_is_taken\"",
    "missingStatus": 200,
    "missingString": "\"success\":true",
    "protected": true
  },
  {
    "name": "Quora",
    "uri": "https://www.quora.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "Credentials",
    "missingStatus": 301,
    "missingString": "Page Not Found",
    "protected": true
  },
  {
    "name": "Raddle.me",
    "uri": "https://raddle.me/user/{account}",
    "existsStatus": 200,
    "existsString": "sidebar__title",
    "missingStatus": 404,
    "missingString": "404 Not Found",
    "protected": false
  },
  {
    "name": "Rant.li",
    "uri": "https://rant.li/{account}/",
    "existsStatus": 200,
    "existsString": "blog-title",
    "missingStatus": 404,
    "missingString": "Are you sure it was ever here?",
    "protected": false
  },
  {
    "name": "Rarible",
    "uri": "https://rarible.com/marketplace/api/v4/urls/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"success\":false",
    "protected": false
  },
  {
    "name": "redbubble",
    "uri": "https://www.redbubble.com/people/{account}/shop",
    "existsStatus": 200,
    "existsString": "Shop | Redbubble",
    "missingStatus": 404,
    "missingString": "This is a lost cause.",
    "protected": false
  },
  {
    "name": "Reddit",
    "uri": "https://www.reddit.com/user/{account}/about.json",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":404",
    "protected": false
  },
  {
    "name": "RedGIFs",
    "uri": "https://api.redgifs.com/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"name\":",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "Refsheet",
    "uri": "https://refsheet.net/{account}",
    "existsStatus": 200,
    "existsString": "og:title",
    "missingStatus": 404,
    "missingString": "That's unfortunate. Where did it go?",
    "protected": false
  },
  {
    "name": "Replit",
    "uri": "https://replit.com/@{account}",
    "existsStatus": 200,
    "existsString": "\"__typename\":\"User\"",
    "missingStatus": 404,
    "missingString": "\"statusCode\":404",
    "protected": false
  },
  {
    "name": "Researchgate",
    "uri": "https://www.researchgate.net/profile/{account}",
    "existsStatus": 200,
    "existsString": " | ",
    "missingStatus": 301,
    "missingString": "20+ million researchers on ResearchGate",
    "protected": false
  },
  {
    "name": "resumes_actorsaccess",
    "uri": "https://resumes.actorsaccess.com/{account}",
    "existsStatus": 200,
    "existsString": "- Resume | Actors Access</title>",
    "missingStatus": 200,
    "missingString": "File was not found on this SERVER",
    "protected": false
  },
  {
    "name": "Revolut",
    "uri": "https://revolut.me/api/web-profile/{account}",
    "existsStatus": 200,
    "existsString": "\"firstName\"",
    "missingStatus": 404,
    "missingString": "\"User not found\"",
    "protected": false
  },
  {
    "name": "risk.ru",
    "uri": "https://risk.ru/people/{account}",
    "existsStatus": 200,
    "existsString": "— Люди — Risk.ru",
    "missingStatus": 404,
    "missingString": "404 — Risk.ru",
    "protected": false
  },
  {
    "name": "Roberts Space Industries",
    "uri": "https://robertsspaceindustries.com/community-hub/user/{account}",
    "existsStatus": 200,
    "existsString": "Query\",\"creator",
    "missingStatus": 404,
    "missingString": "\"/404\",\"query",
    "protected": false
  },
  {
    "name": "Roblox",
    "uri": "https://auth.roblox.com/v1/usernames/validate?username={account}&birthday=2019-12-31T23:00:00.000Z",
    "existsStatus": 200,
    "existsString": "Username is already in use",
    "missingStatus": 200,
    "missingString": "Username is valid",
    "protected": false
  },
  {
    "name": "RoutineHub",
    "uri": "https://routinehub.co/user/{account}",
    "existsStatus": 200,
    "existsString": "Downloads: ",
    "missingStatus": 200,
    "missingString": "A community for Apple Shortcuts</title>",
    "protected": false
  },
  {
    "name": "ru_123rf",
    "uri": "https://ru.123rf.com/profile_{account}",
    "existsStatus": 200,
    "existsString": "userID",
    "missingStatus": 302,
    "missingString": "<title>Фотобанк 123RF - Стоковые Фото, Векторы, Видеоролики. Подписка на Фото. Royalty Free контент<",
    "protected": false
  },
  {
    "name": "RubyGems.org",
    "uri": "https://rubygems.org/api/v1/profiles/{account}.json",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Not Found\"",
    "protected": false
  },
  {
    "name": "RumbleChannel",
    "uri": "https://rumble.com/c/{account}",
    "existsStatus": 200,
    "existsString": "href=https://rumble.com/c/",
    "missingStatus": 404,
    "missingString": "404 error, this page does not exist",
    "protected": false
  },
  {
    "name": "RumbleUser",
    "uri": "https://rumble.com/user/{account}",
    "existsStatus": 200,
    "existsString": "href=https://rumble.com/user/",
    "missingStatus": 404,
    "missingString": "404 error, this page does not exist",
    "protected": false
  },
  {
    "name": "RuneScape",
    "uri": "https://apps.runescape.com/runemetrics/profile/profile?user={account}",
    "existsStatus": 200,
    "existsString": "\"name\":",
    "missingStatus": 200,
    "missingString": "\"error\":\"NO_PROFILE\"",
    "protected": false
  },
  {
    "name": "RuTracker.org",
    "uri": "https://rutracker.org/forum/profile.php?mode=viewprofile&u={account}",
    "existsStatus": 200,
    "existsString": "Профиль пользователя",
    "missingStatus": 200,
    "missingString": "Пользователь не найден",
    "protected": false
  },
  {
    "name": "ruVoIP.net",
    "uri": "https://ruvoip.net/members/{account}/",
    "existsStatus": 200,
    "existsString": "id=\"user-xprofile\"",
    "missingStatus": 200,
    "missingString": "Error 404 - Not Found",
    "protected": false
  },
  {
    "name": "Salon24",
    "uri": "https://www.salon24.pl/u/{account}/",
    "existsStatus": 200,
    "existsString": "<span>Obserwujących</span>",
    "missingStatus": 301,
    "missingString": "<title>Salon24 - Blogi, wiadomości, opinie i komentarze",
    "protected": false
  },
  {
    "name": "Scammer.info",
    "uri": "https://scammer.info/u/{account}.json",
    "existsStatus": 200,
    "existsString": "avatar_template",
    "missingStatus": 404,
    "missingString": "The requested URL or resource could not be found",
    "protected": false
  },
  {
    "name": "Scored",
    "uri": "https://scored.co/api/v2/user/about.json?user={account}",
    "existsStatus": 200,
    "existsString": "\"status\":true",
    "missingStatus": 200,
    "missingString": "\"status\":false",
    "protected": false
  },
  {
    "name": "ScoutWiki",
    "uri": "https://en.scoutwiki.org/User:{account}",
    "existsStatus": 200,
    "existsString": "NewPP limit report",
    "missingStatus": 301,
    "missingString": "is not registered",
    "protected": false
  },
  {
    "name": "Scratch",
    "uri": "https://api.scratch.mit.edu/accounts/checkusername/{account}/",
    "existsStatus": 200,
    "existsString": "\"msg\":\"username exists\"",
    "missingStatus": 200,
    "missingString": "\"msg\":\"valid username\"",
    "protected": false
  },
  {
    "name": "Scribd (Document)",
    "uri": "https://www.scribd.com/search/query?query={account}&verbatim=true",
    "existsStatus": 200,
    "existsString": "\"compilationId\":\"",
    "missingStatus": 200,
    "missingString": "\"compilationId\":null",
    "protected": false
  },
  {
    "name": "Searchengines",
    "uri": "https://searchengines.guru/ru/search?keyword=&author={account}&sortByDate=true",
    "existsStatus": 200,
    "existsString": "class=\"search-result__item\"",
    "missingStatus": 200,
    "missingString": "class=\"nothing-found\"",
    "protected": false
  },
  {
    "name": "Seneporno",
    "uri": "https://seneporno.com/user/{account}",
    "existsStatus": 200,
    "existsString": "Dernier Login",
    "missingStatus": 301,
    "missingString": "Unexpected error! Please contact us and tell us more how you got to this page!",
    "protected": false
  },
  {
    "name": "sentimente",
    "uri": "https://www.sentimente.com/amp/{account}.html",
    "existsStatus": 200,
    "existsString": "Chat online with",
    "missingStatus": 404,
    "missingString": "HTTP Error code: 404. Resource not found",
    "protected": false
  },
  {
    "name": "SEOClerks",
    "uri": "https://www.seoclerks.com/user/{account}",
    "existsStatus": 200,
    "existsString": "<div class=\"user-info container\">",
    "missingStatus": 302,
    "missingString": "<title>SEO Marketplace",
    "protected": false
  },
  {
    "name": "Sepia Search (PeerTube)",
    "uri": "https://sepiasearch.org/api/v1/search/video-channels?search=%22{account}%22&start=0&count=10",
    "existsStatus": 200,
    "existsString": "\"data\":[{",
    "missingStatus": 200,
    "missingString": "\"data\":[]",
    "protected": false
  },
  {
    "name": "setlist.fm",
    "uri": "https://www.setlist.fm/user/{account}",
    "existsStatus": 200,
    "existsString": "s setlist.fm | setlist.fm</title>",
    "missingStatus": 404,
    "missingString": "Sorry, the page you requested doesn't exist",
    "protected": false
  },
  {
    "name": "SFD",
    "uri": "https://www.sfd.pl/profile/{account}",
    "existsStatus": 200,
    "existsString": "Tematy użytkownika",
    "missingStatus": 404,
    "missingString": "Brak aktywnego profilu na forum",
    "protected": false
  },
  {
    "name": "Shesfreaky",
    "uri": "https://www.shesfreaky.com/profile/{account}/",
    "existsStatus": 200,
    "existsString": "s Profile - ShesFreaky</title>",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Shikimori",
    "uri": "https://shikimori.io/{account}",
    "existsStatus": 200,
    "existsString": "class=\"profile-head\"",
    "missingStatus": 404,
    "missingString": "class=\"error-404\"",
    "protected": false
  },
  {
    "name": "shopify",
    "uri": "https://{account}.myshopify.com",
    "existsStatus": 200,
    "existsString": "home",
    "missingStatus": 404,
    "missingString": "Sorry, this shop is currently unavailable.",
    "protected": false
  },
  {
    "name": "Showup.tv",
    "uri": "https://showup.tv/profile/{account}",
    "existsStatus": 200,
    "existsString": "O mnie",
    "missingStatus": 404,
    "missingString": "<title>Darmowe",
    "protected": false
  },
  {
    "name": "shutterstock",
    "uri": "https://www.shutterstock.com/g/{account}",
    "existsStatus": 200,
    "existsString": "| Shutterstock",
    "missingStatus": 404,
    "missingString": "Well, this is unexpected...",
    "protected": false
  },
  {
    "name": "SimplePlanes",
    "uri": "https://www.simpleplanes.com/u/{account}",
    "existsStatus": 200,
    "existsString": "<h5>joined",
    "missingStatus": 302,
    "missingString": "<title>SimplePlanes Airplanes</title>",
    "protected": false
  },
  {
    "name": "skeb",
    "uri": "https://skeb.jp/@{account}",
    "existsStatus": 200,
    "existsString": ") | Skeb",
    "missingStatus": 503,
    "missingString": "Skeb - Request Box",
    "protected": false
  },
  {
    "name": "SlackHoles",
    "uri": "https://slackholes.com/actor/{account}/",
    "existsStatus": 200,
    "existsString": "Pussy and Ass Sizes",
    "missingStatus": 404,
    "missingString": "It looks like nothing was found at this location",
    "protected": false
  },
  {
    "name": "Slant",
    "uri": "https://www.slant.co/users/{account}?format=jsonp&callback=jsonLoaded",
    "existsStatus": 200,
    "existsString": "\"uuid\":",
    "missingStatus": 404,
    "missingString": "\"error\":404",
    "protected": false
  },
  {
    "name": "slides",
    "uri": "https://slides.com/{account}",
    "existsStatus": 200,
    "existsString": "Presentations by",
    "missingStatus": 404,
    "missingString": "You may have mistyped the address",
    "protected": false
  },
  {
    "name": "Slideshare",
    "uri": "https://www.slideshare.net/{account}",
    "existsStatus": 200,
    "existsString": "data-testid=\"report-button\"",
    "missingStatus": 200,
    "missingString": "id=\"username-available\"",
    "protected": false
  },
  {
    "name": "SmashRun",
    "uri": "https://smashrun.com/{account}/",
    "existsStatus": 200,
    "existsString": "Miles run overall",
    "missingStatus": 404,
    "missingString": "no Smashrunner with the username",
    "protected": false
  },
  {
    "name": "SmugMug",
    "uri": "https://{account}.smugmug.com",
    "existsStatus": 200,
    "existsString": "schema.org/Person",
    "missingStatus": 404,
    "missingString": "schema.org/Thing",
    "protected": false
  },
  {
    "name": "smule",
    "uri": "https://www.smule.com/api/profile/?handle={account}",
    "existsStatus": 200,
    "existsString": "account_id",
    "missingStatus": 400,
    "missingString": "code\": 65",
    "protected": false
  },
  {
    "name": "Snapchat",
    "uri": "https://www.snapchat.com/@{account}",
    "existsStatus": 200,
    "existsString": "is on Snapchat!",
    "missingStatus": 200,
    "missingString": "NOT_FOUND",
    "protected": false
  },
  {
    "name": "soc.citizen4.eu",
    "uri": "https://soc.citizen4.eu/profile/{account}/profile",
    "existsStatus": 200,
    "existsString": "@soc.citizen4.eu",
    "missingStatus": 404,
    "missingString": "Nie znaleziono",
    "protected": false
  },
  {
    "name": "social.bund.de",
    "uri": "https://social.bund.de/@{account}",
    "existsStatus": 200,
    "existsString": "@social.bund.de) - social.bund.de</title>",
    "missingStatus": 404,
    "missingString": "<title>The page you are looking for isn&#39;t here.",
    "protected": false
  },
  {
    "name": "sofurry",
    "uri": "https://{account}.sofurry.com",
    "existsStatus": 200,
    "existsString": "'s Profile | SoFurry",
    "missingStatus": 404,
    "missingString": "SoFurry - Error | SoFurry",
    "protected": false
  },
  {
    "name": "solo.to",
    "uri": "https://solo.to/{account}",
    "existsStatus": 200,
    "existsString": "create your own page",
    "missingStatus": 404,
    "missingString": "The page you're looking for isn't here.",
    "protected": false
  },
  {
    "name": "SoundCloud",
    "uri": "https://soundcloud.com/{account}",
    "existsStatus": 200,
    "existsString": "\"hydratable\":\"user\"",
    "missingStatus": 404,
    "missingString": "<title>SoundCloud - Hear the world’s sounds</title>",
    "protected": false
  },
  {
    "name": "Soup",
    "uri": "https://www.soup.io/author/{account}",
    "existsStatus": 200,
    "existsString": "Author at Soup.io",
    "missingStatus": 301,
    "missingString": "Soup.io - News, Sports, Entertainment, TV, Tech, Gaming",
    "protected": false
  },
  {
    "name": "Sourceforge",
    "uri": "https://sourceforge.net/rest/u/{account}/profile",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "id=\"message-image-404\"",
    "protected": true
  },
  {
    "name": "Speaker Deck",
    "uri": "https://speakerdeck.com/{account}/",
    "existsStatus": 200,
    "existsString": ") on Speaker Deck</title>",
    "missingStatus": 404,
    "missingString": "User Not Found - Speaker Deck",
    "protected": false
  },
  {
    "name": "speedrun",
    "uri": "https://www.speedrun.com/user/{account}/",
    "existsStatus": 200,
    "existsString": "Runs - ",
    "missingStatus": 404,
    "missingString": "<title>speedrun.com",
    "protected": false
  },
  {
    "name": "SpiceWorks",
    "uri": "https://community.spiceworks.com/people/{account}",
    "existsStatus": 200,
    "existsString": "Portfolio of IT Projects - Spiceworks",
    "missingStatus": 404,
    "missingString": "Page Not Found",
    "protected": false
  },
  {
    "name": "SPOJ",
    "uri": "https://www.spoj.com/users/{account}/",
    "existsStatus": 200,
    "existsString": "<h3>Activity over the last year</h3>",
    "missingStatus": 200,
    "missingString": "<strong>Innopolis Open 2018</strong>",
    "protected": false
  },
  {
    "name": "sporcle",
    "uri": "https://www.sporcle.com/user/{account}/people/",
    "existsStatus": 200,
    "existsString": "'s Sporcle Friends",
    "missingStatus": 301,
    "missingString": "This Sporcle user cannot be found.",
    "protected": false
  },
  {
    "name": "Sports Tracker",
    "uri": "https://api.sports-tracker.com/apiserver/v1/user/name/{account}",
    "existsStatus": 200,
    "existsString": "\"uuid\":",
    "missingStatus": 200,
    "missingString": "\"code\":\"404\"",
    "protected": false
  },
  {
    "name": "Spotify",
    "uri": "https://open.spotify.com/user/{account}",
    "existsStatus": 200,
    "existsString": "content=\"profile\"",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": true
  },
  {
    "name": "StackOverflow",
    "uri": "https://api.stackexchange.com/2.3/users?order=desc&sort=name&inname={account}&site=stackoverflow",
    "existsStatus": 200,
    "existsString": "\"items\":[{",
    "missingStatus": 200,
    "missingString": "\"items\":[]",
    "protected": true
  },
  {
    "name": "StackShare",
    "uri": "https://stackshare.io/{account}",
    "existsStatus": 200,
    "existsString": "\\\"userProfile\\\":",
    "missingStatus": 200,
    "missingString": "\\\"content\\\":\\\"The requested page could not be found.\\\"",
    "protected": true
  },
  {
    "name": "stats.fm",
    "uri": "https://api.stats.fm/api/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"item\":{",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "Statuspage",
    "uri": "https://{account}.statuspage.io/api/v2/status.json",
    "existsStatus": 200,
    "existsString": "updated_at",
    "missingStatus": 302,
    "missingString": "<html><body>You are being <a href=\"https://www.statuspage.io\">redirected</a>.</body></html>",
    "protected": false
  },
  {
    "name": "Steam",
    "uri": "https://steamcommunity.com/id/{account}",
    "existsStatus": 200,
    "existsString": "g_rgProfileData =",
    "missingStatus": 200,
    "missingString": "Steam Community :: Error",
    "protected": false
  },
  {
    "name": "SteamGifts",
    "uri": "https://www.steamgifts.com/user/{account}",
    "existsStatus": 200,
    "existsString": "\"identifier\":",
    "missingStatus": 301,
    "missingString": "",
    "protected": false
  },
  {
    "name": "steller",
    "uri": "https://steller.co/{account}",
    "existsStatus": 200,
    "existsString": " on Steller</title>",
    "missingStatus": 404,
    "missingString": "<title></title>",
    "protected": false
  },
  {
    "name": "StoryCorps",
    "uri": "https://archive.storycorps.org/user/{account}/",
    "existsStatus": 200,
    "existsString": "archive author",
    "missingStatus": 404,
    "missingString": "We're sorry, but the page",
    "protected": false
  },
  {
    "name": "Strava",
    "uri": "https://www.strava.com/athletes/{account}",
    "existsStatus": 301,
    "existsString": "/athletes/",
    "missingStatus": 404,
    "missingString": "\"page\":\"/404\"",
    "protected": false
  },
  {
    "name": "StreamElements",
    "uri": "https://api.streamelements.com/kappa/v2/channels/{account}",
    "existsStatus": 200,
    "existsString": "\"providerId\"",
    "missingStatus": 404,
    "missingString": "error",
    "protected": false
  },
  {
    "name": "StreamLabs",
    "uri": "https://streamlabs.com/api/v6/user/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 401,
    "missingString": "<title>Unauthorized</title>",
    "protected": false
  },
  {
    "name": "Stripchat",
    "uri": "https://stripchat.com/api/front/users/checkUsername?username={account}",
    "existsStatus": 400,
    "existsString": "\"error\":\"This username already exists\"",
    "missingStatus": 200,
    "missingString": "[]",
    "protected": false
  },
  {
    "name": "Subscribestar",
    "uri": "https://subscribestar.adult/{account}",
    "existsStatus": 200,
    "existsString": "CREATOR STATS",
    "missingStatus": 404,
    "missingString": "WE ARE SORRY, THE PAGE YOU REQUESTED CANNOT BE FOUND",
    "protected": false
  },
  {
    "name": "Substack",
    "uri": "https://substack.com/api/v1/user/{account}/public_profile",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"profile not found\"",
    "protected": false
  },
  {
    "name": "sukebei.nyaa.si",
    "uri": "https://sukebei.nyaa.si/user/{account}",
    "existsStatus": 200,
    "existsString": "'s torrents",
    "missingStatus": 404,
    "missingString": "404 Not Found",
    "protected": false
  },
  {
    "name": "Suzuri",
    "uri": "https://suzuri.jp/{account}",
    "existsStatus": 200,
    "existsString": "Items",
    "missingStatus": 404,
    "missingString": "Push Space-key",
    "protected": false
  },
  {
    "name": "szmer.info",
    "uri": "https://szmer.info/u/{account}",
    "existsStatus": 200,
    "existsString": "Joined",
    "missingStatus": 200,
    "missingString": "Code: Couldn't find that username or email.",
    "protected": false
  },
  {
    "name": "tabletoptournament",
    "uri": "https://www.tabletoptournaments.net/eu/player/{account}",
    "existsStatus": 200,
    "existsString": "- Player Profile | T³ - TableTop Tournaments",
    "missingStatus": 200,
    "missingString": "No player with the nickname",
    "protected": false
  },
  {
    "name": "TamTam",
    "uri": "https://tamtam.chat/{account}",
    "existsStatus": 200,
    "existsString": "deeplink=tamtam://chat/",
    "missingStatus": 302,
    "missingString": "ТамТам</title>",
    "protected": false
  },
  {
    "name": "Tanuki.pl",
    "uri": "https://tanuki.pl/profil/{account}",
    "existsStatus": 200,
    "existsString": "Dołączył",
    "missingStatus": 404,
    "missingString": "Nie ma takiego użytkownika",
    "protected": false
  },
  {
    "name": "TAPiTAG",
    "uri": "https://account.tapitag.co/tapitag/api/v1/{account}",
    "existsStatus": 200,
    "existsString": "User details are Showing",
    "missingStatus": 200,
    "missingString": "The rf number is not valid",
    "protected": false
  },
  {
    "name": "Tappy",
    "uri": "https://api.tappy.tech/api/profile/username/{account}",
    "existsStatus": 200,
    "existsString": "user_id",
    "missingStatus": 200,
    "missingString": "Profile of username Not Found",
    "protected": false
  },
  {
    "name": "Taringa",
    "uri": "https://www.taringa.net/{account}",
    "existsStatus": 200,
    "existsString": " en Taringa!</title>",
    "missingStatus": 301,
    "missingString": "Colectiva en Taringa!</title>",
    "protected": false
  },
  {
    "name": "Taringa Archived Profile",
    "uri": "https://archive.org/wayback/available?url=https://www.taringa.net/{account}",
    "existsStatus": 200,
    "existsString": "\"archived_snapshots\": {\"closest\"",
    "missingStatus": 200,
    "missingString": "\"archived_snapshots\": {}",
    "protected": false
  },
  {
    "name": "taskrabbit",
    "uri": "https://www.taskrabbit.com/profile/{account}/about",
    "existsStatus": 200,
    "existsString": "’s Profile",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Teamtreehouse",
    "uri": "https://teamtreehouse.com/{account}",
    "existsStatus": 200,
    "existsString": "Member Since",
    "missingStatus": 404,
    "missingString": "Oops, Something went missing",
    "protected": false
  },
  {
    "name": "Teespring",
    "uri": "https://commerce.teespring.com/v1/stores?slug={account}",
    "existsStatus": 200,
    "existsString": "sellerToken",
    "missingStatus": 404,
    "missingString": "{\"errors\":{\"store\":[\"not found\"]}}",
    "protected": false
  },
  {
    "name": "Teknik",
    "uri": "https://user.teknik.io/{account}",
    "existsStatus": 200,
    "existsString": "Public Key",
    "missingStatus": 200,
    "missingString": "The user does not exist",
    "protected": false
  },
  {
    "name": "Telegram",
    "uri": "https://t.me/{account}",
    "existsStatus": 200,
    "existsString": "tgme_page_title",
    "missingStatus": 200,
    "missingString": "noindex, nofollow",
    "protected": false
  },
  {
    "name": "Teletype",
    "uri": "https://teletype.in/@{account}",
    "existsStatus": 200,
    "existsString": "class=\"layout__content m_main blog\"",
    "missingStatus": 404,
    "missingString": "class=\"error\"",
    "protected": false
  },
  {
    "name": "Tellonym",
    "uri": "https://api.tellonym.me/profiles/name/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"code\":\"NOT_FOUND\"",
    "protected": true
  },
  {
    "name": "Tenor",
    "uri": "https://tenor.com/users/{account}",
    "existsStatus": 200,
    "existsString": "class=\"ProfilePage page\"",
    "missingStatus": 404,
    "missingString": "class=\"error-page container page\"",
    "protected": false
  },
  {
    "name": "TETR.IO",
    "uri": "https://ch.tetr.io/api/users/{account}",
    "existsStatus": 200,
    "existsString": "\"success\":true",
    "missingStatus": 404,
    "missingString": "\"success\":false",
    "protected": false
  },
  {
    "name": "TF2 Backpack Examiner",
    "uri": "https://www.tf2items.com/id/{account}",
    "existsStatus": 200,
    "existsString": "var profileId",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "thegatewaypundit",
    "uri": "https://www.thegatewaypundit.com/author/{account}/",
    "existsStatus": 200,
    "existsString": "summary",
    "missingStatus": 404,
    "missingString": "Not found, error 404",
    "protected": false
  },
  {
    "name": "theguardian",
    "uri": "https://www.theguardian.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "<h2 class=\"dcr-1ln6kec\">",
    "missingStatus": 404,
    "missingString": "<title>Page Not Found | The Guardian</title>",
    "protected": false
  },
  {
    "name": "themeforest",
    "uri": "https://themeforest.net/user/{account}",
    "existsStatus": 200,
    "existsString": "s profile on ThemeForest",
    "missingStatus": 301,
    "missingString": "Page Not Found | ThemeForest",
    "protected": false
  },
  {
    "name": "Thetattooforum",
    "uri": "https://www.thetattooforum.com/members/{account}/",
    "existsStatus": 200,
    "existsString": "Insert This Gallery",
    "missingStatus": 500,
    "missingString": "We’re sorry",
    "protected": false
  },
  {
    "name": "thoughts",
    "uri": "https://thoughts.com/members/{account}/",
    "existsStatus": 200,
    "existsString": "<span class=\"activity",
    "missingStatus": 404,
    "missingString": "<title>Page not found",
    "protected": false
  },
  {
    "name": "Threads",
    "uri": "https://www.threads.com/@{account}",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "TikTok",
    "uri": "https://www.tiktok.com/oembed?url=https://www.tiktok.com/@{account}",
    "existsStatus": 200,
    "existsString": "\"author_url\":",
    "missingStatus": 400,
    "missingString": "\"code\":400",
    "protected": false
  },
  {
    "name": "Tilde.zone (Mastodon Instance)",
    "uri": "https://tilde.zone/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Tinder",
    "uri": "https://tinder.com/@{account}",
    "existsStatus": 200,
    "existsString": ") | Tinder</title>",
    "missingStatus": 200,
    "missingString": "Tinder | Dating, Make Friends &amp; Meet New People",
    "protected": false
  },
  {
    "name": "TipeeeStream",
    "uri": "https://www.tipeeestream.com/v3.0/pages/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"Not found\"",
    "protected": false
  },
  {
    "name": "Tooting.ch (Mastodon Instance)",
    "uri": "https://tooting.ch/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Topcoder",
    "uri": "https://api.topcoder.com/v5/members/{account}",
    "existsStatus": 200,
    "existsString": "\"userId\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"Member with handle:",
    "protected": false
  },
  {
    "name": "toyhou.se",
    "uri": "https://toyhou.se/{account}",
    "existsStatus": 200,
    "existsString": "display-user",
    "missingStatus": 404,
    "missingString": "We can't find that page!",
    "protected": false
  },
  {
    "name": "TradingView",
    "uri": "https://www.tradingview.com/u/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"js-user-profile\"",
    "missingStatus": 404,
    "missingString": "class=\"tv-http-error-page__image tv-http-error-page__image--404\"",
    "protected": false
  },
  {
    "name": "trakt",
    "uri": "https://trakt.tv/users/{account}",
    "existsStatus": 200,
    "existsString": "s profile - Trakt",
    "missingStatus": 404,
    "missingString": "The page you were looking for doesn't exist (404) - Trakt.tv",
    "protected": false
  },
  {
    "name": "TRAKTRAIN",
    "uri": "https://traktrain.com/{account}",
    "existsStatus": 200,
    "existsString": "id=\"userId\"",
    "missingStatus": 404,
    "missingString": "class=\"title-404\"",
    "protected": false
  },
  {
    "name": "Trello",
    "uri": "https://trello.com/1/Members/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "<h1>Oh no! 404!</h1>",
    "protected": true
  },
  {
    "name": "tripadvisor",
    "uri": "https://www.tripadvisor.com/Profile/{account}",
    "existsStatus": 200,
    "existsString": "Contributions",
    "missingStatus": 404,
    "missingString": "<div class=\"error404",
    "protected": false
  },
  {
    "name": "TruckersMP",
    "uri": "https://truckersmp.com/user/search?search={account}",
    "existsStatus": 200,
    "existsString": "class=\"team-v2\"",
    "missingStatus": 200,
    "missingString": "<h4>Could not find any member using these credentials</h4>",
    "protected": false
  },
  {
    "name": "TruckersMP.Ru",
    "uri": "https://truckersmp.ru/{account}",
    "existsStatus": 200,
    "existsString": "class=\"b-user-page\"",
    "missingStatus": 404,
    "missingString": "class=\"b-handler-error-404\"",
    "protected": false
  },
  {
    "name": "Truth Social",
    "uri": "https://truthsocial.com/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"Record not found\"",
    "protected": false
  },
  {
    "name": "TryHackMe",
    "uri": "https://tryhackme.com/api/user/exist/{account}",
    "existsStatus": 200,
    "existsString": "\"success\":true",
    "missingStatus": 200,
    "missingString": "\"success\":false",
    "protected": false
  },
  {
    "name": "Tryst",
    "uri": "https://tryst.link/escort/{account}",
    "existsStatus": 200,
    "existsString": "Caters to</div>",
    "missingStatus": 404,
    "missingString": "<title>Page not found",
    "protected": false
  },
  {
    "name": "tumblr",
    "uri": "https://www.tumblr.com/{account}",
    "existsStatus": 200,
    "existsString": "\"queryKey\":[\"user-info",
    "missingStatus": 404,
    "missingString": "\"status\":404",
    "protected": false
  },
  {
    "name": "tunefind",
    "uri": "https://www.tunefind.com/api-request/account/profile?userName={account}",
    "existsStatus": 200,
    "existsString": "\"user-stats-engagement\":",
    "missingStatus": 404,
    "missingString": "\"code\":\"not_found\"",
    "protected": false
  },
  {
    "name": "Tweetapus",
    "uri": "https://tweetapus.tiag.workers.dev/@{account}.json",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "\"error\": \"User not found\"",
    "protected": false
  },
  {
    "name": "Twitcast",
    "uri": "https://frontendapi.twitcasting.tv/users/{account}",
    "existsStatus": 200,
    "existsString": "\"user\":{",
    "missingStatus": 404,
    "missingString": "\"message\":\"User Not Found\"",
    "protected": false
  },
  {
    "name": "Twitch",
    "uri": "https://twitchtracker.com/{account}",
    "existsStatus": 200,
    "existsString": "Overview</a>",
    "missingStatus": 404,
    "missingString": "<title>404 Page Not Found",
    "protected": false
  },
  {
    "name": "Twitter archived profile",
    "uri": "http://archive.org/wayback/available?url=https://twitter.com/{account}",
    "existsStatus": 200,
    "existsString": "\"archived_snapshots\": {\"closest\"",
    "missingStatus": 200,
    "missingString": "\"archived_snapshots\": {}",
    "protected": false
  },
  {
    "name": "Twitter archived tweets",
    "uri": "http://archive.org/wayback/available?url=https://twitter.com/{account}/status/*",
    "existsStatus": 200,
    "existsString": "\"archived_snapshots\": {\"closest\"",
    "missingStatus": 200,
    "missingString": "\"archived_snapshots\": {}",
    "protected": false
  },
  {
    "name": "twpro",
    "uri": "https://twpro.jp/{account}/q-data.json",
    "existsStatus": 200,
    "existsString": ",200,\"/",
    "missingStatus": 404,
    "missingString": ",404,\"/",
    "protected": false
  },
  {
    "name": "Udemy",
    "uri": "https://www.udemy.com/user/{account}/",
    "existsStatus": 200,
    "existsString": "| Udemy</title>",
    "missingStatus": 301,
    "missingString": "<title>Online Courses - Learn Anything, On Your Schedule | Udemy</title>",
    "protected": false
  },
  {
    "name": "UEF CONNECT",
    "uri": "https://uefconnect.uef.fi/en/{account}/",
    "existsStatus": 200,
    "existsString": "profile-page-header__info",
    "missingStatus": 404,
    "missingString": "<title>Page not found - UEFConnect</title>",
    "protected": false
  },
  {
    "name": "Ultimate Guitar",
    "uri": "https://www.ultimate-guitar.com/u/{account}",
    "existsStatus": 200,
    "existsString": " | Ultimate-Guitar.Com</title>",
    "missingStatus": 410,
    "missingString": "Oops! We couldn't find that page.",
    "protected": false
  },
  {
    "name": "Ultras Diary",
    "uri": "http://ultrasdiary.pl/u/{account}/",
    "existsStatus": 200,
    "existsString": "Mecze wyjazdowe:",
    "missingStatus": 404,
    "missingString": "Ile masz wyjazdów?",
    "protected": false
  },
  {
    "name": "Unlisted Videos",
    "uri": "https://unlistedvideos.com/search.php?user={account}",
    "existsStatus": 200,
    "existsString": "Date submitted",
    "missingStatus": 200,
    "missingString": "content=\"\"/>",
    "protected": false
  },
  {
    "name": "unsplash",
    "uri": "https://unsplash.com/@{account}",
    "existsStatus": 200,
    "existsString": "| Unsplash Photo Community",
    "missingStatus": 404,
    "missingString": "Hm, the page you were looking for doesn't seem to exist anymore.",
    "protected": false
  },
  {
    "name": "Untappd",
    "uri": "https://untappd.com/user/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"cont user_profile\"",
    "missingStatus": 404,
    "missingString": "class=\"search_404\"",
    "protected": false
  },
  {
    "name": "USA Life",
    "uri": "https://usa.life/{account}",
    "existsStatus": 200,
    "existsString": "Please log in to like, share and comment",
    "missingStatus": 302,
    "missingString": "Sorry, page not found",
    "protected": false
  },
  {
    "name": "utip.io",
    "uri": "https://utip.io/creator/profile/{account}",
    "existsStatus": 200,
    "existsString": "\"userName\"",
    "missingStatus": 404,
    "missingString": "Not a valid web service key",
    "protected": false
  },
  {
    "name": "uwu.ai",
    "uri": "https://{account}.uwu.ai/",
    "existsStatus": 200,
    "existsString": "property=\"twitter:card\"",
    "missingStatus": 404,
    "missingString": "Sorry, the requested page could not be found.",
    "protected": false
  },
  {
    "name": "Uwumarket",
    "uri": "https://uwumarket.us/collections/{account}",
    "existsStatus": 200,
    "existsString": "collection-hero__text-wrapper",
    "missingStatus": 404,
    "missingString": "Page not found",
    "protected": false
  },
  {
    "name": "vapenews",
    "uri": "https://vapenews.ru/profile/{account}",
    "existsStatus": 200,
    "existsString": "<title inertia>Профиль</title></head>",
    "missingStatus": 404,
    "missingString": "<title>404</title>",
    "protected": false
  },
  {
    "name": "Venmo",
    "uri": "https://account.venmo.com/u/{account}",
    "existsStatus": 200,
    "existsString": "profileInfo_username__",
    "missingStatus": 404,
    "missingString": "Sorry, the page you requested does not exist!",
    "protected": false
  },
  {
    "name": "Vero",
    "uri": "https://vero.co/{account}",
    "existsStatus": 200,
    "existsString": "name=\"username",
    "missingStatus": 200,
    "missingString": "<h3>Not Found</h3>",
    "protected": false
  },
  {
    "name": "vibilagare",
    "uri": "https://www.vibilagare.se/users/{account}",
    "existsStatus": 200,
    "existsString": "Profil på vibilagare.se",
    "missingStatus": 404,
    "missingString": "Sidan hittades inte |",
    "protected": false
  },
  {
    "name": "VIEWBUG",
    "uri": "https://www.viewbug.com/member/{account}",
    "existsStatus": 200,
    "existsString": "class=\"top-profile-since\"",
    "missingStatus": 404,
    "missingString": "id=\"missing-this\"",
    "protected": false
  },
  {
    "name": "Vimeo",
    "uri": "https://vimeo.com/{account}",
    "existsStatus": 200,
    "existsString": "og:type",
    "missingStatus": 404,
    "missingString": "VimeUhOh",
    "protected": false
  },
  {
    "name": "Vine",
    "uri": "https://vine.co/api/users/profiles/vanity/{account}",
    "existsStatus": 200,
    "existsString": "userId",
    "missingStatus": 404,
    "missingString": "That record does not exist",
    "protected": false
  },
  {
    "name": "VIP-blog",
    "uri": "https://{account}.vip-blog.com/",
    "existsStatus": 200,
    "existsString": "blog : ",
    "missingStatus": 200,
    "missingString": "Blog inexistant",
    "protected": false
  },
  {
    "name": "VirusTotal",
    "uri": "https://www.virustotal.com/ui/users/{account}",
    "existsStatus": 200,
    "existsString": "\"data\"",
    "missingStatus": 404,
    "missingString": "\"code\": \"NotFoundError\"",
    "protected": false
  },
  {
    "name": "visnesscard",
    "uri": "https://my.visnesscard.com/Home/GetCard/{account}",
    "existsStatus": 200,
    "existsString": "end_point",
    "missingStatus": 200,
    "missingString": "card_id\": 0",
    "protected": false
  },
  {
    "name": "Vivino",
    "uri": "https://api.vivino.com/users/{account}",
    "existsStatus": 200,
    "existsString": "\"id\":",
    "missingStatus": 404,
    "missingString": "\"error\":{\"message\":\"Record not found\"}",
    "protected": false
  },
  {
    "name": "VK",
    "uri": "https://vk.com/{account}",
    "existsStatus": 200,
    "existsString": "content=\"profile\"",
    "missingStatus": 404,
    "missingString": "404 Not Found",
    "protected": false
  },
  {
    "name": "Vkl.world (Mastodon Instance)",
    "uri": "https://vkl.world/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Vmst.io (Mastodon Instance)",
    "uri": "https://vmst.io/api/v1/accounts/lookup?acct={account}",
    "existsStatus": 200,
    "existsString": "display_name",
    "missingStatus": 404,
    "missingString": "Record not found",
    "protected": false
  },
  {
    "name": "Voice123",
    "uri": "https://voice123.com/api/providers/search/{account}",
    "existsStatus": 200,
    "existsString": "user_id",
    "missingStatus": 200,
    "missingString": "[]",
    "protected": false
  },
  {
    "name": "Voices.com",
    "uri": "https://www.voices.com/profile/{account}/",
    "existsStatus": 200,
    "existsString": "Last Online</h3>",
    "missingStatus": 301,
    "missingString": "Try going back to the previous page or see below for more options",
    "protected": false
  },
  {
    "name": "vsco",
    "uri": "https://vsco.co/{account}/gallery",
    "existsStatus": 200,
    "existsString": "permaSubdomain",
    "missingStatus": 404,
    "missingString": "\"error\":\"site_not_found\"}",
    "protected": false
  },
  {
    "name": "VseTop",
    "uri": "https://vsetop.org/user/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"userinfo\"",
    "missingStatus": 404,
    "missingString": "<p>Пользователь с таким именем не найден.</p>",
    "protected": false
  },
  {
    "name": "W3Schools",
    "uri": "https://pathfinder-api.kai.w3spaces.com/public-profile-api/{account}",
    "existsStatus": 200,
    "existsString": "\"userId\":",
    "missingStatus": 404,
    "missingString": "\"message\":\"Profile does not exists or not visible\"",
    "protected": false
  },
  {
    "name": "Wakatime",
    "uri": "https://wakatime.com/api/v1/users/{account}",
    "existsStatus": 200,
    "existsString": "\"data\":",
    "missingStatus": 404,
    "missingString": "\"error\": \"Not found.\"",
    "protected": false
  },
  {
    "name": "Warmerise",
    "uri": "https://warmerise.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "<div id='profile_photo",
    "missingStatus": 404,
    "missingString": "<h2>Page Not Found",
    "protected": false
  },
  {
    "name": "warriorforum",
    "uri": "https://www.warriorforum.com/members/{account}.html",
    "existsStatus": 200,
    "existsString": "Last Activity:",
    "missingStatus": 400,
    "missingString": "Oops | Warrior Forum -",
    "protected": false
  },
  {
    "name": "watchmemore.com",
    "uri": "https://api.watchmemore.com/api4/profile/{account}/",
    "existsStatus": 200,
    "existsString": "displayName",
    "missingStatus": 400,
    "missingString": "notExists",
    "protected": false
  },
  {
    "name": "Watchmyfeed",
    "uri": "https://watchmyfeed.com/{account}",
    "existsStatus": 200,
    "existsString": "SEND ME A TIP",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Wattpad",
    "uri": "https://www.wattpad.com/api/v3/users/{account}",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 400,
    "missingString": "\"error_code\":",
    "protected": true
  },
  {
    "name": "waytohey",
    "uri": "https://waytohey.com/{account}",
    "existsStatus": 200,
    "existsString": "Send message</span>",
    "missingStatus": 404,
    "missingString": "Unfortunately, this page doesn&#039;t exist.",
    "protected": false
  },
  {
    "name": "Weasyl",
    "uri": "https://www.weasyl.com/~{account}",
    "existsStatus": 200,
    "existsString": "profile — Weasyl</title>",
    "missingStatus": 404,
    "missingString": "This user doesn't seem to be in our database.",
    "protected": false
  },
  {
    "name": "Weblancer",
    "uri": "https://www.weblancer.net/users/{account}/",
    "existsStatus": 200,
    "existsString": "\"user\":",
    "missingStatus": 404,
    "missingString": "\"page\":\"/404\"",
    "protected": false
  },
  {
    "name": "Weblate",
    "uri": "https://hosted.weblate.org/user/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"user-page text-center\"",
    "missingStatus": 404,
    "missingString": "<h2>Page Not Found</h2>",
    "protected": false
  },
  {
    "name": "weebly",
    "uri": "https://{account}.weebly.com/",
    "existsStatus": 200,
    "existsString": "<div id=\"navigation\">",
    "missingStatus": 404,
    "missingString": "<title>404 - Page Not Found",
    "protected": false
  },
  {
    "name": "wego",
    "uri": "https://wego.social/{account}",
    "existsStatus": 200,
    "existsString": "Following</span>",
    "missingStatus": 302,
    "missingString": "Sorry, page not found!",
    "protected": false
  },
  {
    "name": "weheartit",
    "uri": "https://weheartit.com/{account}",
    "existsStatus": 200,
    "existsString": " on We Heart It</title>",
    "missingStatus": 404,
    "missingString": " (404)</title>",
    "protected": false
  },
  {
    "name": "Weibo",
    "uri": "https://weibo.com/ajax/profile/info?custom={account}",
    "existsStatus": 200,
    "existsString": "\"user\":",
    "missingStatus": 400,
    "missingString": "<h2>400 Bad Request</h2>",
    "protected": false
  },
  {
    "name": "WeTransfer",
    "uri": "https://wepresent.wetransfer.com/artists/{account}",
    "existsStatus": 200,
    "existsString": "name\":\"WePresent | ",
    "missingStatus": 404,
    "missingString": "text-display-4\">404 error",
    "protected": false
  },
  {
    "name": "Wikidot",
    "uri": "https://www.wikidot.com/user:info/{account}",
    "existsStatus": 200,
    "existsString": "<h1 class=\"profile-title\">",
    "missingStatus": 200,
    "missingString": "<div class=\"error-block\">User does not exist.</div>",
    "protected": false
  },
  {
    "name": "Wikimapia",
    "uri": "https://wikimapia.org/user/register/?check=username&value={account}",
    "existsStatus": 200,
    "existsString": "\"ok\":false",
    "missingStatus": 200,
    "missingString": "\"ok\":true",
    "protected": false
  },
  {
    "name": "Wimkin-PublicProfile",
    "uri": "https://wimkin.com/{account}",
    "existsStatus": 200,
    "existsString": "is on WIMKIN",
    "missingStatus": 404,
    "missingString": " The page you are looking for cannot be found.",
    "protected": false
  },
  {
    "name": "Wireclub",
    "uri": "https://www.wireclub.com/users/{account}",
    "existsStatus": 200,
    "existsString": "Chat With",
    "missingStatus": 301,
    "missingString": "People - Wireclub",
    "protected": true
  },
  {
    "name": "Wishlistr",
    "uri": "https://www.wishlistr.com/sign-up/?rs=checkUserName&rsargs[]={account}",
    "existsStatus": 200,
    "existsString": "+:var res = \"",
    "missingStatus": 200,
    "missingString": "+:var res = parseInt(0);",
    "protected": false
  },
  {
    "name": "wordnik",
    "uri": "https://www.wordnik.com/users/{account}",
    "existsStatus": 200,
    "existsString": "Welcome,",
    "missingStatus": 404,
    "missingString": "Wordnik: Page Not Found",
    "protected": false
  },
  {
    "name": "WordPress.com (Deleted)",
    "uri": "https://public-api.wordpress.com/rest/v1.1/sites/{account}.wordpress.com",
    "existsStatus": 403,
    "existsString": "\"message\":\"API calls to this endpoint have been disabled.\"",
    "missingStatus": 404,
    "missingString": "\"error\":\"unknown_blog\"",
    "protected": false
  },
  {
    "name": "WordPress.com (Private)",
    "uri": "https://public-api.wordpress.com/rest/v1.1/sites/{account}.wordpress.com",
    "existsStatus": 403,
    "existsString": "\"message\":\"User cannot access this private blog.\"",
    "missingStatus": 404,
    "missingString": "\"error\":\"unknown_blog\"",
    "protected": false
  },
  {
    "name": "WordPress.com (Public)",
    "uri": "https://public-api.wordpress.com/rest/v1.1/sites/{account}.wordpress.com",
    "existsStatus": 200,
    "existsString": "\"ID\":",
    "missingStatus": 404,
    "missingString": "\"error\":\"unknown_blog\"",
    "protected": false
  },
  {
    "name": "WordPress.org (Forums)",
    "uri": "https://login.wordpress.org/wp-json/wporg/v1/username-available/{account}",
    "existsStatus": 200,
    "existsString": "\"error\":\"That username is already in use.",
    "missingStatus": 200,
    "missingString": "\"available\":true",
    "protected": false
  },
  {
    "name": "WordPress.org (Profiles)",
    "uri": "https://login.wordpress.org/wp-json/wporg/v1/username-available/{account}",
    "existsStatus": 200,
    "existsString": "\"error\":\"That username is already in use.",
    "missingStatus": 200,
    "missingString": "\"available\":true",
    "protected": false
  },
  {
    "name": "Wowhead",
    "uri": "https://www.wowhead.com/user={account}",
    "existsStatus": 200,
    "existsString": " Profile - Wowhead",
    "missingStatus": 404,
    "missingString": "Error - Wowhead",
    "protected": false
  },
  {
    "name": "Wykop",
    "uri": "https://wykop.pl/ludzie/{account}",
    "existsStatus": 200,
    "existsString": "<title>Profil:",
    "missingStatus": 404,
    "missingString": "Wystąpił błąd 404.",
    "protected": false
  },
  {
    "name": "X",
    "uri": "https://api.x.com/i/users/username_available.json?username={account}",
    "existsStatus": 200,
    "existsString": "\"reason\":\"taken\"",
    "missingStatus": 200,
    "missingString": "\"reason\":\"available\"",
    "protected": false
  },
  {
    "name": "Xakep.ru",
    "uri": "https://xakep.ru/author/{account}/",
    "existsStatus": 200,
    "existsString": "authorBlock-avatar",
    "missingStatus": 404,
    "missingString": "Страница не найдена",
    "protected": false
  },
  {
    "name": "Xanga",
    "uri": "https://{account}.xanga.com/",
    "existsStatus": 200,
    "existsString": "class=\"module module-weblog\"",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Xbox Gamertag",
    "uri": "https://www.xboxgamertag.com/search/{account}",
    "existsStatus": 200,
    "existsString": "Games Played",
    "missingStatus": 404,
    "missingString": "Gamertag doesn't exist",
    "protected": false
  },
  {
    "name": "xHamster",
    "uri": "https://xhamster.com/users/{account}",
    "existsStatus": 200,
    "existsString": "s profile | xHamster</title>",
    "missingStatus": 404,
    "missingString": "User not found</title>",
    "protected": false
  },
  {
    "name": "Xing",
    "uri": "https://www.xing.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "<meta data-rh=",
    "missingStatus": 404,
    "missingString": "404 Not Found | XING",
    "protected": false
  },
  {
    "name": "XNXX",
    "uri": "https://www.xnxx.com/mobile/profile/{account}",
    "existsStatus": 200,
    "existsString": "<table id=\"profile\">",
    "missingStatus": 400,
    "missingString": "<title>Bad request",
    "protected": false
  },
  {
    "name": "XVideos",
    "uri": "https://www.xvideos.com/profiles/{account}/feed/",
    "existsStatus": 200,
    "existsString": "\"result\":true",
    "missingStatus": 404,
    "missingString": "\"message\":\"Unknown user\"",
    "protected": false
  },
  {
    "name": "Yahoo! JAPAN Auction",
    "uri": "https://auctions.yahoo.co.jp/follow/list/{account}",
    "existsStatus": 200,
    "existsString": "出品者",
    "missingStatus": 500,
    "missingString": "Yahoo! JAPAN IDが無効です。",
    "protected": false
  },
  {
    "name": "yapishu",
    "uri": "https://yapishu.net/user/{account}",
    "existsStatus": 200,
    "existsString": "for_profile",
    "missingStatus": 404,
    "missingString": "Not Found (#404)",
    "protected": false
  },
  {
    "name": "Yazawaj",
    "uri": "https://www.yazawaj.com/profile/{account}",
    "existsStatus": 200,
    "existsString": "profile-description",
    "missingStatus": 302,
    "missingString": "<title>nodata",
    "protected": false
  },
  {
    "name": "YesWeHack",
    "uri": "https://api.yeswehack.com/hunters/{account}",
    "existsStatus": 200,
    "existsString": "\"username\":",
    "missingStatus": 404,
    "missingString": "\"code\":404",
    "protected": false
  },
  {
    "name": "YouNow",
    "uri": "https://api.younow.com/php/api/broadcast/info/user={account}",
    "existsStatus": 200,
    "existsString": "\"userId\":",
    "missingStatus": 200,
    "missingString": "\"errorMsg\":\"No users found\"",
    "protected": true
  },
  {
    "name": "youpic",
    "uri": "https://youpic.com/photographer/{account}",
    "existsStatus": 200,
    "existsString": "<meta name=\"og:title\"",
    "missingStatus": 404,
    "missingString": "<title>YouPic — Not Found</title>",
    "protected": false
  },
  {
    "name": "YouTube Channel",
    "uri": "https://www.youtube.com/c/{account}/about",
    "existsStatus": 200,
    "existsString": "joinedDateText",
    "missingStatus": 404,
    "missingString": "<title>404 Not Found",
    "protected": false
  },
  {
    "name": "YouTube User",
    "uri": "https://www.youtube.com/user/{account}/about",
    "existsStatus": 200,
    "existsString": "joinedDateText",
    "missingStatus": 404,
    "missingString": "<title>404 Not Found",
    "protected": false
  },
  {
    "name": "YouTube User2",
    "uri": "https://www.youtube.com/@{account}",
    "existsStatus": 200,
    "existsString": "canonicalBaseUrl",
    "missingStatus": 404,
    "missingString": "<title>404 Not Found</title>",
    "protected": false
  },
  {
    "name": "Zbiornik",
    "uri": "https://mini.zbiornik.com/{account}",
    "existsStatus": 200,
    "existsString": "INFO",
    "missingStatus": 301,
    "missingString": "",
    "protected": false
  },
  {
    "name": "Zenn",
    "uri": "https://zenn.dev/{account}",
    "existsStatus": 200,
    "existsString": "<div class=\"UserHeader_profileMain__6Itxi\">",
    "missingStatus": 404,
    "missingString": "<div class=\"ErrorContent_status__2Ykoq\">404</div>",
    "protected": false
  },
  {
    "name": "Zepeto",
    "uri": "https://gw-napi.zepeto.io/profiles/{account}",
    "existsStatus": 200,
    "existsString": "zepetoId\":",
    "missingStatus": 200,
    "missingString": "errorCode\":",
    "protected": false
  },
  {
    "name": "zhihu",
    "uri": "https://api.zhihu.com/books/people/{account}/publications?offset=0&limit=5",
    "existsStatus": 200,
    "existsString": "\"is_start\": true",
    "missingStatus": 404,
    "missingString": "\"name\": \"NotFoundException\"",
    "protected": false
  },
  {
    "name": "Zillow",
    "uri": "https://www.zillow.com/profile/{account}/",
    "existsStatus": 200,
    "existsString": "- Real Estate Agent",
    "missingStatus": 302,
    "missingString": "",
    "protected": false
  },
  {
    "name": "zmarsa.com",
    "uri": "https://zmarsa.com/uzytkownik/{account}",
    "existsStatus": 200,
    "existsString": "Statystyki",
    "missingStatus": 404,
    "missingString": "<title>Error 404 - zMarsa.com<",
    "protected": false
  },
  {
    "name": "Znanija",
    "uri": "https://znanija.com/graphql/ru?operationName=NickAvailability&query=query%20NickAvailability%28%24nick%3AString%21%29%7BnickAvailability%28nick%3A%24nick%29%7BisAvailable%7D%7D&variables=%7B%22nick%22%3A%22{account}%22%7D",
    "existsStatus": 200,
    "existsString": "\"isAvailable\":false",
    "missingStatus": 200,
    "missingString": "\"isAvailable\":true",
    "protected": true
  },
  {
    "name": "Zomato",
    "uri": "https://www.zomato.com/{account}/reviews",
    "existsStatus": 200,
    "existsString": "Activity</h4>",
    "missingStatus": 404,
    "missingString": "This is a 404 page and we think it's fairly clear",
    "protected": false
  },
  {
    "name": "zoomitir",
    "uri": "https://www.zoomit.ir/user/{account}/",
    "existsStatus": 301,
    "existsString": "",
    "missingStatus": 404,
    "missingString": "<title>خطای ۴۰۴ - صفحه یافت نشد</title>",
    "protected": false
  },
  {
    "name": "Военное обозрение",
    "uri": "https://topwar.ru/user/{account}/",
    "existsStatus": 200,
    "existsString": "class=\"puser-info\"",
    "missingStatus": 404,
    "missingString": "class=\"error-container\"",
    "protected": false
  },
  {
    "name": "Чатовка.net",
    "uri": "https://chatovka.net/search?user_nick=+{account}&user_sex_m=on&user_sex_f=on",
    "existsStatus": 200,
    "existsString": "href=\"/user/",
    "missingStatus": 200,
    "missingString": "По Вашему запросу люди не найдены.",
    "protected": false
  }
];
