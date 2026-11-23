<div dir="rtl">

# ילדי היקר (`Yaldi HaYakar`) — מאגר מחקר, איפיון ותכנון

> **ארגון גג:** [הסדנא לידע ציבורי (ע"ר)](https://www.hasadna.org.il/)  
> **מקור הפרויקט:** האקתון [Talpiot 4 Good](https://talpiot4good.hasadna.org.il/) (פורום בוגרי תלפיות × הסדנא לידע ציבורי, 2026)  
> **שותף ולקוח אסטרטגי:** **ועד ההורים הארצי (הנהגת ההורים הארצית)**  
> **שלב נוכחי:** מחקר, הבנת הקיים, מיפוי דאטה וחקיקה, ותכנון ארכיטקטוני (טרום פיתוח).

---

## מטרות הפרויקט

1. **חשיפת יוקר החינוך בגיל הרך בישראל** והנגשת השוואת מחירים שקופה ומנורמלת להורים, לוועדי הורים, לחוקרים ולמקבלי החלטות.
2. **מיפוי מסגרות חינוך לא מפוקחות / פרטיות** באמצעות שילוב תלת-שכבתי: **מאגרים ממשלתיים** + **דאטה עירוני (GIS/ארנונה)** + **חכמת המונים מהורים**, תוך הצלבה אקטיבית ומודל אמינות שקוף.
3. **הנגשה פתוחה ורב-ערוצית:** פאנל Web להורים (חיפוש + דיווח + ייצוא לאקסל/CSV), **Public REST API**, ושרת **MCP** לסוכני AI, בסינרגיית `יצרן <> צרכן` עם **[מפת הטף](https://www.tafmap.org.il/)**.

---

## מבנה התיקייה וניווט מהיר

### 1. הנחיות עבודה לסוכני AI
- [`AGENTS.md`](./AGENTS.md) — כללי אצבע מחייבים, סגנון תקשורת, קווים אדומים משפטיים ומפת הפרויקט לכל סשן AI.

### 2. איפיון, ביקורת, מפרטי מיקרו והחלטות (`docs/`)
- [`docs/01_product_vision_critique_and_architecture.md`](./docs/01_product_vision_critique_and_architecture.md) — חזון המוצר (2 ענפי UI, API, MCP, Export), ביקורת בונה וזיהוי מוקשים, מודל 4 שכבות אמינות וארכיטקטורה מוצעת.
- [`docs/02_decisions_log_and_roadmap.md`](./docs/02_decisions_log_and_roadmap.md) — יומן החלטות שהתקבלו (`D-01` עד `D-38`, כולל נעילת סשן `/grill-me`), שאלות פתוחות ומפת דרכים מדורגת.
- `docs/03_legal_and_privacy_consultation_brief.md` — מסמך התייעצות משפטי מקיף (שמור מקומית לפי `D-35`).
- [`docs/04_data_schema_v1.md`](./docs/04_data_schema_v1.md) — **איפיון מיקרו חלק א' (`Data Schema v1`):** סכמת `PostgreSQL 17 + PostGIS + pg_trgm` מלאה (הפרדת `public` מ-`app_private`, `Unlinkable Nullifiers`, `Blind Upsert`, אגרגציית מחירים, היסטוריית שנים, השוואה מרחבית וצינור ה-ETL).
- [`docs/05_api_and_mcp_specification.md`](./docs/05_api_and_mcp_specification.md) — **איפיון מיקרו חלק ב' (`API & MCP Spec v1`):** מפרט נקודות הקצה של ה-REST API (`OpenAPI 3.1.0`), אימות `Google OIDC` (`Scope: openid` בלבד), `Sanity Check`, ייצוא `CSV/XLSX` ו-5 הכלים של שרת ה-MCP (`yaldi-hayakar-mcp`).
- [`docs/06_ui_ux_and_cartography_spec.md`](./docs/06_ui_ux_and_cartography_spec.md) — **איפיון מיקרו חלק ג' (`UI/UX & Cartography Spec v1`):** אימוץ רכיבי המעטפת מ"מפת הטף", תצוגת מפה + טבלה נגישה (`ת"י 5568 AA`), קרטוגרפיה (`Supercluster` ו-`Price Pills`), כרטיס הגן ואשף דיווח ההורים ב-60 שניות.

### 3. דוחות מחקר ודגימות דאטה (`research/`)
- [`research/00_sources_and_links_catalog.md`](./research/00_sources_and_links_catalog.md) — קטלוג מאוחד של כלל הקישורים, מאגרי המידע, ה-APIs, הרישיונות והריפוזיטוריז.
- [`research/01_existing_project_audit.md`](./research/01_existing_project_audit.md) — ניתוח אתר ההאקתון, מסמך ה-DOCX, הנדסה לאחור מלאה של `gan-ster.vercel.app`, וניתוח הגיליון הקהילתי של ת"א.
- [`research/02_government_sources.md`](./research/02_government_sources.md) — מאגרי ממשלה (`data.gov.il`, משרד החינוך, העבודה, הלמ"ס, ממ"מ ומבקר המדינה).
- [`research/03_municipal_community_competitors_legal.md`](./research/03_municipal_community_competitors_legal.md) — דאטה עירוני (כולל תגלית שכבה 925 ב-GIS ת"א והצלבה אמפירית ב-4 מקורות!), מתחרים בארץ ובעולם, בעלי עניין וסיכוני לשון הרע ופרטיות.
- [`research/04_tafmap_mapathataf.md`](./research/04_tafmap_mapathataf.md) — ניתוח טכני ומודל נתונים של "מפת הטף" (`hasadna/mapathataf`) וארכיטקטורת `יצרן <> צרכן`.
- [`research/05_licensing_laws_and_privacy_deep_dive.md`](./research/05_licensing_laws_and_privacy_deep_dive.md) — מחקר משפטי מקיף: חוקי רישוי (`0–3` ו-`3–6`), הגנת הפרטיות (תיקון 13), תקנות אבטחת מידע, הגנת הצרכן, נגישות (`ת"י 5568`) וחקיקה משלימה.
- [`research/06_data_sources_terms_of_use_audit.md`](./research/06_data_sources_terms_of_use_audit.md) — ביקורת תנאי שימוש ורישיונות של כלל אתרי ומאגרי המקור + נוהל בדיקה מחייב לכל מקור מידע עתידי (`D-25`).
- `research/samples/` — דגימות דאטה אמיתיות (`gov/`, `municipal/`, `community/`, `tafmap/`, `licensing/` — שמורות מקומית ומוחרגות מ-Git מטעמי פרטיות).

### 4. חומרי מקור וגיבויים לוקאליים (`references/` — מוחרגים מ-Git)
- `references/original-materials/` — הקבצים המקוריים שהתקבלו עם הפרויקט (`ילדי היקר.docx` ו-`Talpiot 4 Good - Hackathon Results.html`).
- `references/gan-ster-bundle/` — גיבוי מקומי מלא של קוד ה-Frontend מהאפליקציה החיה של ההאקתון (`gan-ster.vercel.app`).
- `references/repos/gan-ster/` — שכפול מקומי מלא של ריפו קוד ההאקתון (`gan-ster`), כולל ה-Backend ו-15 מיגרציות ה-SQL.
- `references/repos/mapathataf/` — שכפול מקומי מלא של ריפו הקוד הפתוח `hasadna/mapathataf`.

</div>
