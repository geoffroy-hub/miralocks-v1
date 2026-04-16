# Miralocks — Build & Déploiement

## Versionnement automatique CSS/JS

Avant chaque déploiement, lancez :

```bash
node build.js
```

Ce script :
- Calcule un hash MD5 court (8 chars) du contenu de chaque fichier CSS/JS
- Remplace tous les `?v=XX` dans les fichiers HTML par le nouveau hash
- Met à jour automatiquement le numéro de cache dans `sw.js`

### Mode dry-run (prévisualisation sans écriture)
```bash
node build.js --dry
```

## Modules admin

L'admin est découpé en modules indépendants :

| Fichier | Contenu | Lignes |
|---|---|---|
| `js/admin.js` | Core : auth, nav, thème, **vidéos** | ~515 |
| `js/admin-rdv.js` | Rendez-vous & Dashboard | ~520 |
| `js/admin-galerie.js` | Galerie photos | ~87 |
| `js/admin-avis.js` | Avis clients | ~109 |
| `js/admin-settings.js` | Paiements, planning, licence | ~765 |
| `js/admin-services.js` | Prestations | ~292 |
| `js/admin-charts.js` | Graphiques | existant |

⚠️ **Ne jamais déplacer la section vidéos** — elle utilise `sb2` (seconde instance Supabase).

## Image manquante

est masquée avec `display:none` jusqu'au remplacement du fichier.

Une fois le fichier remplacé, retirer l'attribut `style="display:none"` 
dans le `<div class="ba-item">` correspondant (chercher "Paire 10").
