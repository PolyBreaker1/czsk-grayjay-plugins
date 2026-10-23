# CZ/SK pluginy pre Grayjay

Tri zdroje pre Grayjay. Všetko beží priamo v Grayjay — bez lokálneho servera,
bez Pythonu a bez akýchkoľvek ďalších programov.

| Plugin | Zdroj |
|---|---|
| SkTOnline | online.sktorrent.eu |
| Bombuj.si | bombuj.si / serialy.bombuj.si |
| Prehraj.to | prehraj.to |

## Inštalácia (Windows alebo iný Grayjay desktop)

1. Nainštalujte **Grayjay** z oficiálnej stránky: <https://grayjay.app>
   (Desktop → inštalátor pre Windows.)
2. Otvorte Grayjay → **Zdroje** (pluginy) → **Pridať zdroj / Inštalovať z URL**.
3. Vložte vždy jednu adresu a potvrďte upozornenie na nepodpísaný plugin:

```
https://polybreaker1.github.io/czsk-grayjay-plugins/sktorrent/config.json
https://polybreaker1.github.io/czsk-grayjay-plugins/bombuj/config.json
https://polybreaker1.github.io/czsk-grayjay-plugins/prehrajto/config.json
```

4. Hľadajte priamo v Grayjay — výsledky zo všetkých troch zdrojov sa zobrazia spolu.

## Poznámky

- Ani jeden plugin nevyžaduje účet, prihlásenie ani nastavenie.
- **Bombuj** prehráva prehrávače **streamtape** a **mixdrop** ako priame MP4
  (väčšina titulov má aspoň jeden z nich). Prehrávače voe a filemoon zatiaľ
  nie sú podporované.
- **SkTOnline** prehráva h264 MP4 z online.sktorrent.eu.
- **Prehraj.to** prehráva priame MP4 z premiumcdn. Pozor: k 23. 10. 2026 stránka
  vracia prázdne výsledky hľadania pre neprihlásených používateľov, takže plugin
  momentálne nič nenájde. Plugin je v poriadku — obnoví sa, keď stránka opäť
  sprístupní verejné hľadanie.

## Aktualizácia

Po zvýšení čísla `version` v `config.json` znova vložte rovnakú adresu (krok 2–3);
Grayjay nainštalovanú kópiu nahradí.
