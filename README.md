# Akčná plechovka ⚡

Statická stránka, ktorá 2× denne automaticky prečíta letáky Kauflandu a Billy a pošle e-mail odberateľom, keď sú **Monster, Red Bull alebo Hell** v akcii. Celé to beží zadarmo, bez servera:

| Čo | Kde |
|---|---|
| Kontrola letákov 2× denne | **GitHub Actions** ([.github/workflows/site.yml](.github/workflows/site.yml)) |
| Stránka na energetaky.matusep.me | **GitHub Pages** |
| Odberatelia, potvrdenie odberu, odhlásenie, odosielanie e-mailov | **Brevo** (zoznam pre každú značku) |
| Nájdené akcie | [data/deals.json](data/deals.json) v repozitári (verejné ceny, žiadne osobné údaje) |

## Ako to funguje

1. GitHub Actions spustí `npm run check`:
   - **Kaufland:** prečíta [prehľad akciových výrobkov](https://predajne.kaufland.sk/aktualna-ponuka/prehlad.html) za aktuálny aj budúci týždeň.
   - **BILLA:** zo stránky [aktuálny leták](https://www.billa.sk/letaky-a-akcie/aktualny-letak) stiahne PDF (len do pamäte, na disk sa neukladá) a prečíta z neho ceny. Rovnaký leták sa druhýkrát nesťahuje.
   - Akcie, ktorým skončila platnosť, sa hneď zmažú.
2. Pre nové akcie pošle cez Brevo kampaň na zoznam danej značky.
3. Uloží `data/` do repozitára a nasadí stránku z `dist/` na GitHub Pages.

Po pushnutí kódu alebo zmene `data/hidden.json` sa stránka len znova zostaví, bez kontroly a bez e-mailov. Kontrolu hneď spustíš v záložke **Actions → Kontrola letákov a stránka → Run workflow**.

### Zle prečítaná akcia

Skopíruj jej `"id"` z [data/deals.json](data/deals.json) do [data/hidden.json](data/hidden.json), napr. `["billa:d07afa74f7:1:redbull:100"]`. Stačí to upraviť priamo na GitHube cez ikonu ceruzky. Stránka sa do minúty aktualizuje a o akcii nikto nedostane e-mail.

### Poistky

- Ak kontrola naraz nájde viac ako 10 nových akcií, e-maily sa nepošlú. Pravdepodobne ide o chybu, skontroluj `data/deals.json`.
- Billa cena sa overuje voči bežnej cene a percentu zľavy (±10 %). Ak nesedí, akcia sa nepridá.
- Značky majú prísne vzory, aby napr. „Hellmann´s“ nebol Hell ([src/brands.js](src/brands.js)).
- Bez `BREVO_API_KEY` beží kontrola naostro, ale e-maily nepošle a len vypíše, čo by poslala.

### Slušné sťahovanie dát

- Číta sa len verejný obsah, ktorý robots.txt nezakazuje. Program sa predstavuje ako `AkcnaPlechovkaBot/1.0` s kontaktom.
- Kontrola beží 2× denne. **Nič sa neobchádza:** pri CAPTCHA, 403 alebo 429 sa kontrola obchodu zastaví a v logu Actions je chyba.
- Ukladajú sa len fakty (produkt, cena, platnosť) s odkazom na originál, nie obrázky ani texty letákov.

## Nastavenie (raz)

1. **Brevo:**
   - Vytvor 3 zoznamy (Monster, Red Bull, Hell).
   - Vytvor prihlasovací formulár s double opt-in a presmerovaniami na `https://energetaky.matusep.me/skontroluj-email/` a `/odber-aktivny/`.
   - Vygeneruj API kľúč a v Security vypni blokovanie neznámych IP, lebo GitHub Actions majú zakaždým inú IP.
2. **[site.config.json](site.config.json):** doplň `operatorName`, `brevo.formUrl` (adresa `action` z Brevo formulára) a ID zoznamov v `brevo.lists`.
3. **GitHub → Settings:**
   - **Secrets and variables → Actions:** pridaj secret `BREVO_API_KEY`.
   - **Pages:** Source = *GitHub Actions*, Custom domain = `energetaky.matusep.me`, zapni *Enforce HTTPS*.
4. **Namecheap DNS:** CNAME `energetaky` → `matusep.github.io` (`matusep.me` zostáva portfóliu).

## Lokálne

```bash
npm install
npm run check     # skutočná kontrola letákov (bez BREVO_API_KEY nič neodošle) + zostavenie
npm run build     # len zostavenie stránky z data/
npm run preview   # náhľad na http://localhost:3000
```

Lokálnu kontrolu púšťaj len na skúšanie. Zmeny v `data/` necommituj, inak sa pobijú s automatickými commitmi z Actions. Vrátiš ich cez `git checkout data`.

## Právne a bezpečnostné veci

- **GDPR:**
  - Zoznam odberateľov je **len v Brevo** (EÚ), nie na stránke ani v repozitári.
  - Súhlas je dvojstupňový (double opt-in) a vyžaduje sa vek 18+, keďže letáky pri energeťákoch uvádzajú „Nie je vhodné pre deti a mládež do 18 rokov“.
  - Odhlásenie jedným klikom je v každom e-maile. Brevo pridáva aj hlavičku `List-Unsubscribe`.
  - Zásady ochrany súkromia uvádzajú Brevo aj GitHub Pages ako sprostredkovateľov.
- **Stránka:** bez cookies, analytiky a JavaScriptu. Má prísnu Content-Security-Policy a formulár smie odosielať len na Brevo.
- **Ochranné známky:** názvy sa používajú len na pomenovanie produktov, bez log a grafiky. Na každej stránke aj v e-mailoch je upozornenie „nie sme prepojení“.
- **Tajomstvá:** jediné je `BREVO_API_KEY` v GitHub Secrets, v kóde nie je nič.
- Toto nie je právne poradenstvo. Obchody môžu automatické čítanie zakázať vo svojich podmienkach. Ak by sa ozvali, kontrolu daného obchodu vypni.
