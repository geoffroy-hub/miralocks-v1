# Liste des Bugs et Erreurs - Miralocks
*Mis à jour le 2026-04-12 — Audit complet*

## Résumé des corrections

| # | Statut | Fichier | Problème |
|---|--------|---------|----------|
| 1 | ✅ Corrigé | `supabase.js` | Bug timezone — suppression du "Z" UTC dans fmtLocal() |
| 2 | ✅ Corrigé | `admin-rdv.js` | Conflit fonction openModal — sauvegarde de l'original |
| 3 | ✅ Corrigé | `main.js` | Vérification sb.visites améliorée |
| 4 | ✅ Corrigé | `admin-rdv.js` | Date parsing avec helper parseLocalDate() |
| 5 | ✅ Corrigé | Tous `.html` | Syntaxe img corrigée (balises mal fermées) |
| 6 | ✅ Corrigé | `admin.js` | Check Supabase2 déplacé AVANT l'upload |
| 7 | ✅ Corrigé | `main.js` | Null check amélioré pour lightbox |
| 8 | ✅ Corrigé | `main.js` | Debounce ajouté pour l'événement resize |
| 9 | ✅ Corrigé | `rendezvous.html` | URL canonique hardcodée supprimée (conflit avec seo-meta.js) |
| 10 | ✅ Corrigé | `admin-rdv.js` | XSS — ajout escAttr() pour les attributs HTML |
| 11 | ✅ Corrigé | `admin-settings.js` | Commentaire CINETPAY dupliqué supprimé |
| 12 | ✅ Corrigé | `admin-settings.js` | window.open() sans garde null → crash si popup bloqué |
| 13 | ✅ Corrigé | `admin-settings.js` | showToast() directs non sécurisés → (window.toast\|\|window.showToast)() |
| 14 | ✅ Corrigé | `admin-settings.js` | btn.disabled=false hors finally → bouton bloqué sur erreur (4 modules paiement) |
| 15 | ✅ Corrigé | `admin-settings.js` | Apostrophes non échappées dans strings JS → syntax error |
| 16 | ✅ Corrigé | `admin-communication.js` | XSS — a.email / a.nom injectés bruts dans innerHTML (Newsletter) |
| 17 | ✅ Corrigé | `admin.js` | toast/showToast non exposés sur window → ReferenceError dans les modules |
| 18 | ✅ Corrigé | `admin-security.js` | OTP généré avec Math.random() → remplacé par crypto.getRandomValues() |
| 19 | ✅ Corrigé | `chatbot-public.js` | XSS — log.message/log.detail injectés bruts dans innerHTML (historique) |
| 20 | ✅ Corrigé | `admin.html` | Versions cache-busting (?v=…) mises à jour pour les 5 fichiers modifiés |
| 21 | ✅ Corrigé | `chatbot-public.js` | Refonte logique, fallback de configuration et support Google Gemini |

---

## Notes sur les domaines hardcodés

Les balises `og:image`, `og:url` et `twitter:image` dans les fichiers HTML référencent
`mira-lecks.vercel.app`. Ce domaine est écrasé dynamiquement par `seo-meta.js` à l'exécution,
mais reste présent comme fallback statique pour les crawlers qui n'exécutent pas le JavaScript.
**À mettre à jour manuellement** lors du passage en production avec le vrai domaine.

---

*Audit complet réalisé le 2026-04-12*
