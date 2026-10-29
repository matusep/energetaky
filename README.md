# Akčná plechovka ⚡

Stránka, ktorá automaticky sleduje letáky Kauflandu a Billy a pošle e-mail odberateľom, keď sú **Monster, Red Bull alebo Hell** v akcii.

## Ako to funguje

1. Každých 12 hodín si program prečíta verejné letáky:
   - **Kaufland:** [prehľad akciových výrobkov](https://predajne.kaufland.sk/aktualna-ponuka/prehlad.html) za aktuálny aj budúci týždeň. Stránka má v sebe dáta o každej ponuke (názov, cena, platnosť).
   - **BILLA:** zo stránky [aktuálny leták](https://www.billa.sk/letaky-a-akcie/aktualny-letak) stiahne PDF cez odkaz „Stiahnuť PDF“, prečíta z neho text a zloží ceny podľa polohy na stránke. Rovnaký leták sa druhýkrát nesťahuje.
2. Nová akcia sa hneď zobrazí na stránke a odberatelia, ktorých zaujíma daný obchod a značka, dostanú jeden e-mail.
3. V `/admin` vidíš stav poslednej kontroly a môžeš ju spustiť ručne. Zle prečítanú akciu skryješ a akciu vieš pridať aj ručne.

### Poistky proti chybám

- Ak kontrola naraz nájde viac ako 10 nových akcií, e-maily sa automaticky nepošlú. Pravdepodobne ide o chybu, takže ich najprv skontroluj v admine.
- Billa cena sa overuje voči bežnej cene a percentu zľavy (±10 %). Ak nesedí, akcia sa nepridá.
- Regulárne výrazy pre značky sú prísne, aby sa napr. kečup „Hellmann´s“ nepovažoval za Hell. Značky sa nastavujú v [src/brands.js](src/brands.js).
- Ak obchod zmení stránku a parser prestane fungovať, admin zobrazí chybu.

### Slušné sťahovanie dát

- Číta sa len verejne dostupný obsah, ktorý robots.txt nezakazuje. robots.txt sa kontroluje pri každej požiadavke.
- Program sa predstavuje poctivo (`AkcnaPlechovkaBot/1.0` + adresa stránky a kontaktný e-mail).
- Kontrola beží najviac raz za 6 hodín (predvolene 12), s pauzou medzi požiadavkami.
- **Nič sa neobchádza.** Ak obchod vráti CAPTCHA, 403 alebo 429, kontrola sa pre daný obchod zastaví a admin ukáže chybu.
- Neukladajú sa obrázky ani texty letákov, len fakty (produkt, cena, platnosť) s odkazom na originál.

## Spustenie na počítači

```bash
npm install
cp .env.example .env      # potom v .env vyplň hodnoty
npm start                 # http://localhost:3000
```

Bez nastaveného SMTP sa e-maily len vypíšu do konzoly, takže sa dá všetko otestovať bez odosielania.

## Nasadenie na vlastnú doménu

Treba hosting s **Node.js 22.13+** (alebo Dockerom), **trvalým diskom** pre databázu a aspoň **512 MB RAM**, lebo spracovanie Billa PDF (~80 MB) zaberie asi 300 MB.

Možnosti: lacný VPS (Hetzner, Websupport VPS) s Dockerom alebo Railway či Fly.io s volume. Docker:

```bash
docker build -t akcna-plechovka .
docker run -d --name akcna-plechovka --restart unless-stopped -p 3000:3000 \
  --env-file .env -v akcna-data:/app/data akcna-plechovka
```

Pred aplikáciu daj HTTPS (Caddy alebo Nginx + Let's Encrypt, prípadne to rieši hosting).

Nastavenia v produkcii:
- `NODE_ENV=production`
- `BASE_URL=https://tvoja-domena.sk`
- `TRUST_PROXY=1`, ak beží za proxy
- silné `ADMIN_PASSWORD`

**E-maily:** použi poskytovateľa z EÚ, napr. [Brevo](https://www.brevo.com) (zadarmo 300 e-mailov/deň). Odosielaj z vlastnej domény a nastav **SPF, DKIM a DMARC**, inak budú e-maily padať do spamu.

## Čo je ošetrené

**Ochrana osobných údajov (GDPR)**
- Ukladá sa len e-mail, výber obchodov a značiek a čas a verzia súhlasu. IP adresy sa neukladajú.
- Súhlas je dvojstupňový (double opt-in) a vyžaduje sa vek **18+**. Letáky pri energetických nápojoch uvádzajú „Nie je vhodné pre deti a mládež do 18 rokov“.
- Nepotvrdené registrácie sa mažú po 48 hodinách. Odhlásenie údaje okamžite vymaže.
- V každom e-maile je odkaz na odhlásenie a hlavička `List-Unsubscribe` s odhlásením jedným klikom (vyžadujú ju Gmail a Yahoo).
- Stránka má Zásady ochrany súkromia (`/sukromie`) a Podmienky (`/podmienky`).
- Bez cookies, analytiky a Google Fonts, takže netreba cookie lištu.
- Formulár vždy vráti rovnakú odpoveď, takže sa nedá zistiť, kto je prihlásený.

**Ochranné známky a autorské práva**
- Názvy značiek a obchodov sa používajú len na pomenovanie produktov, bez log, grafiky a obrázkov z letákov.
- Upozornenie „nie sme prepojení“ je na každej stránke aj v e-mailoch.
- Ceny sú označené ako orientačné a automaticky zisťované.
- V podmienkach je kontakt pre vlastníkov práv: ak niekto nesúhlasí, zastavíš to.
- Názov stránky ani domény nemá obsahovať názov značky.

**Bezpečnosť**
- Prísna Content-Security-Policy, stránka nemá žiadny JavaScript a všetky výstupy sú escapované.
- Bezpečnostné hlavičky cez Helmet a obmedzenie počtu pokusov.
- Honeypot proti botom a náhodné 256-bitové tokeny. Potvrdenie aj odhlásenie ide cez POST tlačidlo.
- Admin za heslom s ochranou proti CSRF a parametrizované SQL dotazy.
- PDF sa spracúva bez spúšťania kódu (`isEvalSupported: false`) a s limitom veľkosti.

## Pred spustením nezabudni

- [ ] V `.env` vyplniť `OPERATOR_NAME` a `CONTACT_EMAIL` (v produkcii sú povinné).
- [ ] Ak budeš na stránke zarábať (reklamy, affiliate), budeš potrebovať živnosť a doplniť údaje podľa zákona o elektronickom obchode.
- [ ] Ak zmeníš text súhlasu, zvýš `CONSENT_VERSION` v [src/config.js](src/config.js).
- [ ] Toto nie je právne poradenstvo. Automatické čítanie letákov je síce slušné a bez obchádzania ochrany, ale obchody ho môžu zakázať vo svojich podmienkach. Ak by sa ozvali, kontrolu daného obchodu vypni.
