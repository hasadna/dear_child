<div dir="rtl">

# קטלוג מאוחד של מקורות מידע, APIs, ריפוזיטוריז וקישורים — "ילדי היקר"

> **עודכן לאחרונה:** 08.11.2026 (`תשפ"ז`)  
> מסמך זה מרכז במקום אחד את **כל הקישורים, מאגרי המידע, נקודות הקצה (APIs), הריפוזיטוריז, תנאי השימוש והנכסים** שאותרו ונבדקו במחקר (ראו דוח ביקורת תנאי השימוש המלא ב-[`research/06_data_sources_terms_of_use_audit.md`](./06_data_sources_terms_of_use_audit.md)).

---

## 1. נכסי הפרויקט והאקתון `Talpiot 4 Good`

| שם הנכס | כתובת (URL) / מיקום מקומי | סטטוס גישה | הערות |
|---|---|---|---|
| **הריפו הרשמי בסדנא (`dear_child`)** | https://github.com/hasadna/dear_child | `200 OK` (פומבי) | **הריפו הרשמי החדש** שנפתח ע"י איש ה-DevOps של הסדנא (02.11.2026, רישיון MIT). ישמש כבית הקוד המרכזי של הפרויקט. |
| **אתר תוצרי ההאקתון הפומבי** | https://talpiot4good.hasadna.org.il/ | `200 OK` | זהה לקובץ המקומי `references/original-materials/Talpiot 4 Good - Hackathon Results.html` (שמור מקומית). |
| **אפליקציית ההאקתון (`gan-ster`)** | https://gan-ster.vercel.app/ | `200 OK` (פרונט בלבד) | גיבוי מלא של ה-JS/CSS נשמר מקומית ב-`references/gan-ster-bundle/`. |
| **שרת ה-API מההאקתון (Supabase)** | `https://jyxmivnftqxycafwtirl.supabase.co/functions/v1/survey-api` | `NXDOMAIN` (מושבת) | פרויקט ישן שהוקפא. **אושר (D-11):** הכיל דאטה של בדיקות בלבד, אין צורך בחילוץ או הפשרה ונקים מסד חדש ונקי תחת הסדנא. |
| **ריפו קוד ההאקתון המקורי (GitHub)** | ריפו פרטי ב-GitHub (קישור שמור מקומית) | `404` (Private) | ריפו המקור של מוביל צוות הפיתוח בהאקתון (ממנו פוצל הפורק הפנימי בסדנא; אומת ע"י GitHub API כזהה ב-100% לפורק). |
| **פורק ריפו ההאקתון בסדנא** | פורק פרטי ב-GitHub (קישור שמור מקומית) | `200 OK` (Private — שוכפל מקומית) | **שוכפל במלואו ל-`references/repos/gan-ster/`!** זהה ב-100% לריפו המקורי (`HEAD: be7aa4d`, `248 KB`). כולל את כל ה-Frontend, ה-Edge Function (`survey-api`) ו-15 מיגרציות ה-SQL של Supabase. |
| **דשבורד Supabase / Vercel מההאקתון** | דשבורד פרטי של צוות ההאקתון (קישורים שמורים מקומית) | נעול להרשאות צוות | קוד ה-Supabase וה-Vercel חולץ במלואו מהריפו (`references/repos/gan-ster/`); אין צורך בחילוץ דאטה (`D-11`). |
| **מסמך איפיון מההאקתון (טיוטה)** | https://docs.google.com/document/d/1UvvEdVPCTXdbZ6-YyuydQbWBoYLPQ-egge6Ee_g5Cn8/edit | `נקרא ונשמר` | גיבוי מקומי: `references/original-materials/איפיון_מההאקתון.docx`. |
| **מצגת ההאקתון** | https://docs.google.com/presentation/d/1XFFxBBAaRSaJ4yLfLicntkA8yZ83u3lD98Aj5lYIkXg/edit | `נקראה ונשמרה` | גיבוי מקומי: `references/original-materials/מצגת_האקתון.pdf` (9 שקפים). |
| **מסמך ריכוז ומפת דרכים מהמנטור** | `references/original-materials/ילדי היקר.docx` | מקומי | מפרט אבני דרך, חיבור לוועד ההורים הארצי וממשק למפת הטף. |

---

## 2. מערכת "מפת הטף" (`Tafmap`) והאקוסיסטם של הסדנא לידע ציבורי

| שם הנכס | כתובת (URL) | תפקיד וסטטוס |
|---|---|---|
| **מפת הטף — עמוד נחיתה** | https://www.tafmap.org.il/ | שער הכניסה למוצר הגיל הרך המוניציפלי של הסדנא ו-DataCity. |
| **מפת הטף — אפליקציית חיפוש להורים** | `https://app.tafmap.org.il/<workspace>` (למשל `/rkhobot`) | אפליקציית Angular 19 פעילה ב-108 רשויות (ללא נתוני מחיר). |
| **מפת הטף — API חי (Cloud Run / Firebase)** | `https://api-m5crpfzdeq-ez.a.run.app/<workspace>/items` | API הפרודקשן של מפת הטף (מחזיר את מודל 4 השכבות: `official`, `info`, `admin`, `user`). |
| **מפת הטף — ייצוא CSV לילי ישיר** | `https://storage.googleapis.com/mapathataf.firebasestorage.app/exports/facilities.csv` | קובץ ה-CSV המתעדכן מדי לילה (`9,478` רשומות × `242` עמודות). |
| **מפת הטף — מאגר CKAN פתוח** | https://opendata.hasadna.org.il/dataset/mapathataf | מאגר הדאטה הפתוח הרשמי בקטלוג הסדנא (**רישיון `ODbL 1.0`** — מחייב קרדיט ו-`Share-Alike`). |
| **מאגר Upstream ארצי מלא (`obudget`)** | `https://next.obudget.org/datapackages/facilities/all/datapackage.json` | **חשוב:** כולל את כלל 256 הרשויות בארץ (**רישיון `CC BY-SA 4.0`** לתוכן/נתונים). |
| **ריפו Issues וניהול מוצר (`hasadna`)** | https://github.com/hasadna/mapathataf | שוכפל ל-`references/repos/mapathataf`; קוד קפא ב-11/2025, מכיל 100 Issues חשובים. |
| **ריפו Frontend פרודקשן חי** | https://github.com/whiletrue-industries/mapathataf | המונוריפו העדכני של המוביל הטכנולוגי של "מפת הטף" (`landing`, `app`, `admin`, `manage`, אוק' 2026). |
| **ריפו Backend & ETL פרודקשן חי** | https://github.com/whiletrue-industries/mapathataf-server | קוד ה-Flask API, ה-ETL הלילי מ-`obudget` ורשימות היישובים (`city_names.csv`). |
| **תשתית Kubernetes הסדנא (GitOps)** | https://github.com/hasadna/hasadna-k8s | קלאסטר ה-K8s של הסדנא (בניהול איש ה-DevOps של הסדנא). **אושר ואומת (`D-26`):** הקונטיינרים ומסד ה-DB ירוצו כאן; כולל את מדריך הפריסה `docs/argocd.md`, תבניות `apps/` (כגון `openbus` ו-`mapathataf`), ניהול סודות ב-**Vault** (`apps/vault`, בתחביר `vault:path:key`) ו-`apps/cloudnative-pg`. |
| **תבנית CI/CD לפרויקט בסדנא (`open-bus-map-search`)** | https://github.com/hasadna/open-bus-map-search | ריפו פעיל המשמש כתבנית מומלצת ל-Dockerfile ול-GitHub Actions (`.github/workflows/cd.yml`): בנייה אוטומטית ל-`ghcr.io` ועדכון `hasadna-k8s` (`apps/openbus`) דרך `HASADNA_K8S_DEPLOY_KEY`. |

---

## 3. מאגרי מידע ו-APIs ממשלתיים (ארצי)

| שם המאגר / API | גוף אחראי | כתובת (URL) | מה כולל? |
|---|---|---|---|
| **API מעונות יום מפוקחים בתשפ"ז (`GetMeonot`)** | משרד החינוך | `https://parents.education.gov.il/api/data/meonot/GetMeonot?pageNumber=1&pageSize=6000&shnatLimudim=2027&codeYishuv=0&achuzTkina=0&statusRishuy=0&misgeret=0&baalut=0&semelMaon=&distance=0&latitude=0&longitude=0` | **Open JSON API!** `4,824` מעונות (`2,040` מעונות סמל + **`2,784` מעונות פרטיים ברישיון/תהליך**). **פרטיות ותקנון:** לסנן ת"ז של עוסקים יחידים ב-`semeL_BAALUT` ולהעדיף משיכה שבועית בודדת של `GetMeonotExcel` (ללא `Scraping` אגרסיבי). |
| **ייצוא אקסל רשמי של כלל המעונות (`GetMeonotExcel`)** | משרד החינוך | `https://parents.education.gov.il/api/data/meonot/GetMeonotExcel?year=2027&yishuv=0&tkina=0&status=0&misgeret=0&baalut=0&semel=&distance=0&lat=0&lng=0` | הורדת `XLSX` רשמית ומנוקה מת"ז של כל `4,824` המעונות המפוקחים לתשפ"ז (מכוח חובת הפרסום ב`סעיף 19` לחוק הפיקוח — למשיכה שבועית בודדת). |
| **API + אקסל עיצומים כספיים למעונות (`mirsham.xlsx`)** | משרד החינוך | `https://parents.education.gov.il/api/data/itzumimCaspiim/GetMeonotWithItzumim` <br> `https://meyda.education.gov.il/files/Prh/parents/mirsham.xlsx` | **Open JSON API + XLSX!** `34` עיצומים כספיים ארצית (מכוח `סעיף 53` לחוק הפיקוח — למשיכה שבועית בודדת של קובץ הייצוא הרשמי). |
| **פורטל הורים — איתור מעונות יום** | משרד החינוך | https://parents.education.gov.il/gov-education/daycare-home/search-daycare | ממשק ה-UI הרשמי שמעל `GetMeonot`. |
| **מאגר מוסדות חינוך גיאוגרפי חדש (`mosdot_edu`)** | משרד החינוך (`data.gov.il`) | https://data.gov.il/dataset/55ef9f65-c6af-47c8-8f0f-7ce6990420ad | פורסם `05.10.2026`! `34,898` מוסדות עם נ.צ. `X, Y` (ITM): `5,750` מעונות יום + `21,872` גני ילדים 3–6 (**רישיון פתוח `data.gov.il/terms`** — חובת ייחוס ואי-חסות). |
| **מאגר מעונות יום, משפחתונים וצהרונים (`daycare-centers`)** | משרד העבודה (`data.gov.il`) | https://data.gov.il/dataset/f680a42f-b30e-408d-bea0-bc57b3aa9ca3 | `12,295` מסגרות סמל (`2,420` מעונות, `3,859` משפחתוני סמל, `6,016` צהרונים — **רישיון פתוח `data.gov.il/terms`**). |
| **מאגר מסגרות הרווחה (`welfare-frames`)** | משרד הרווחה (`data.gov.il`) | https://data.gov.il/dataset/56639c97-30ba-4307-a768-9f4b1655c68a | `2,075` רשומות מעון (פעוטות בסיכון + מעונות יום שיקומיים) עם ח.פ., טלפון ו-`GisX/Y` (**רישיון פתוח `data.gov.il/terms`**). |
| **טבלאות שכר לימוד מפוקח במעונות סמל** | משרד העבודה | https://www.gov.il/he/departments/guides/daycare_tuition_fees | עוגן המחירים הרשמי (מוזן ידנית כטבלת קבועים שנתית מצו הפיקוח ללא צורך ב-`Scraping`). |
| **נושא רישוי ופיקוח מעונות יום (gov.il)** | משרד החינוך | https://www.gov.il/he/departments/topics/daycare-licensing-supervision-nurseries | שער המידע הרשמי לרישוי, תקנות, מצלמות וצווי הפסקה/עיצומים. |
| **פורטל בעלויות — רישוי ופיקוח מעונות יום** | משרד החינוך (POB) | https://pob.education.gov.il/institutions/main-daycare/licensing-supervision-daycare/ | נהלי רישוי לבעלי מעונות פרטיים וציבוריים. |
| **מסמך תחולת חובת הרישוי לשנת תשפ"ז** | משרד החינוך | https://meyda.education.gov.il/files/PortalBaaluyot/POB/daycare/rishui/tashpaz/applicability-license.pdf | הגדרת תחולת חובת הרישוי והפטורים המעודכנת לתשפ"ז. |
| **תושבים לפי יישובים וקבוצות גיל (`גיל_0_5`)** | רשות האוכלוסין (`data.gov.il`) | https://data.gov.il/dataset/00172ee8-4433-4d5d-8fd4-11f0f08ce5c4 | מתעדכן שבועית (`1,086,820` ילדים בגילאי 0–5 ב-`1,299` יישובים) — בסיס למדד מחסור עירוני. |
| **מילוני רחובות, שמות נרדפים ויישובים** | רשות האוכלוסין / הלמ"ס | `https://data.gov.il/dataset/321` <br> `https://data.gov.il/dataset/israel-streets-synom` <br> `https://data.gov.il/dataset/citiesandsettelments` | תשתית קריטית להשלמת כתובות אוטומטית ומניעת כפילויות (`Entity Resolution`). |

---

## 4. מקורות מידע עירוניים (GIS & Open Data)

| רשות | מקור / שכבה | כתובת (URL) | תוכן עיקרי |
|---|---|---|---|
| **תל אביב-יפו** | **שכבה 925 — עסקים (סיווגי ארנונה)** | `https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/925` | **תגלית מפתח:** `288` גני ילדים פרטיים + `62` מוסדות לא בפיקוח (`350` סה"כ). **⚠️ הערת תנאי שימוש:** בשל סתירה בתקנון ת"א בין הצהרת ה-Open Data לאיסור גנרי על `scraping`, מומלץ אשרור משפטי / אישור מייל קצר מצוות ה-Open Data העירוני או בקשת חופש מידע. |
| **תל אביב-יפו** | **שכבה 624 — מעונות מוכרים לגיל הרך** | `https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/624` | `96` מעונות סמל, יוניטף ומעונות בנכסי עירייה *(ראו הערת תנאי שימוש לעיל)*. |
| **תל אביב-יפו** | **שכבה 768 — גני ילדים תשפ"ז** | `https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/768` | `551` גני עירייה (גילאי 3–6) לשנת תשפ"ז *(ראו הערת תנאי שימוש לעיל)*. |
| **תל אביב-יפו** | פורטל Open Data עירוני | https://opendata.tel-aviv.gov.il | מעל 130 מאגרים עירוניים פתוחים (בעמוד המפתחים מותרת הפצה חופשית עם קרדיט, אך דף התקנון באתר מכיל סעיף גנרי סותר — ראו `research/06`). |
| **באר שבע** | מעונות יום + מאגר עסקים אחוד (`data.gov.il`) | https://data.gov.il/dataset/6a4c7e72-02b9-4975-a54b-721387b8612c <br> https://data.gov.il/organization/beer-sheva | `124` מעונות ב-`daycares-br7` (כולל `49` פרטיים!) + `3,054` עסקים ב-`unified_businesses-br7` (**רישיון פתוח `data.gov.il/terms`**). |
| **ירושלים** | DataCity Jerusalem + JerGIS | https://jerusalem.datacity.org.il <br> https://jergisng.jerusalem.muni.il | קטלוג CKAN עירוני (**רישיון פתוח `ODbL 1.0`**); מערכת `JerGIS` ההנדסית מיועדת לעיון בלבד (ללא `Scraping` אוטומטי). |
| **חיפה** | מאגר גני ילדים חיפה ב-`data.gov.il` | https://data.gov.il/dataset/946 | הדומיין הישן `data.haifa.muni.il` אינו פעיל ב-DNS; מאגר גני הילדים של עיריית חיפה מתפרסם רשמית ב-`data.gov.il` (**רישיון פתוח `data.gov.il/terms`**). |
| **רחובות / דימונה / שורק דרומי** | Workspaces מועשרים במפת הטף | `https://app.tafmap.org.il/rkhobot` (ודומיו) | ערים עם העשרה ידנית עמוקה של מחלקות הגיל הרך (נכלל ברישיון `ODbL 1.0` של מפת הטף). |

---

## 5. מאגרים קהילתיים, מיפוי/Geocoding, פלטפורמות השוואה ובעלי עניין

| קטגוריה | שם | כתובת (URL) | הערות וסטטוס תנאי שימוש |
|---|---|---|---|
| **מיפוי ו-Geocoding פתוח וחינמי** | `OpenStreetMap` + `Nominatim` | https://www.openstreetmap.org/copyright <br> https://operations.osmfoundation.org/policies/nominatim/ | **✅ ננעל סופית כספק המיפוי החינמי (`0 ₪`, `ODbL 1.0` — `D-25`, `D-26`):** מחייב קרדיט `© OpenStreetMap contributors`, קצב `< 1 req/sec`, `User-Agent` מזהה ואפס Autocomplete חי מהדפדפן. *(ספקי `Google Maps Geocoding` ו-`GovMap` **נפסלו** — `D-25`)*. |
| **אימות משתמשים (`MVP1` ושלב ב')** | `Google OAuth 2.0 / OIDC` + `Strictly Necessary Cookie` (`MVP1`) / ספק `SMS+Voice OTP` ישראלי (`שלב ב'`) | https://developers.google.com/identity/protocols/oauth2/openid-connect | **✅ ב-`MVP1` (`D-29`):** אימות הורים ב-`0 ₪` באמצעות `Sign in with Google` (שמירת `HMAC-SHA256(google_sub, pepper)` בלבד — `Zero-PII`) + עוגיית אבטחה הכרחית (`HttpOnly; Secure; SameSite=Lax`, פטורה מבאנר קוקיז). **בשלב ב' (`D-27`):** ספק `SMS + Voice OTP` ישראלי יחיד ב-Prepaid לבעלי גנים ולאוכלוסיות ללא Google. *(`WhatsApp Cloud API` נפסל)*. |
| **גיליון קהילתי (פיילוט ת"א ב-`MVP1`)** | גנים לקטנטנים ת"א לספטמבר 2026 | https://docs.google.com/spreadsheets/d/1peBTffHK_k_umCdkchBG3dZzezFatMbJtmbfMPtSW4c | `112–116` מסגרות עם מחירי 2024–2026. **ב-`MVP1` (`D-28` אפשרות ב'): ייבוא הגנים המצטלבים עם מאגר רשמי בלבד + עובדות נקיות בלבד (`D-23`, ללא טקסט חופשי וטלפונים)**, בכפוף לקרדיט ליוזמי הגיליון ואשרור המשפטן. |
| **שותף אסטרטגי** | הנהגת ההורים הארצית (ועד ההורים הארצי) | https://www.horim.org.il/ *(ארגון יציג ארצי)* | **מתעניין מאוד בפרויקט** — שותף מפתח להפצה ארצית ואיסוף נתונים. |
| **קואליציה אזרחית** | הקואליציה לחינוך מלידה ("אנו") | https://www.anu.org.il/ | שותפה מרכזית לקידום פיקוח וסבסוד בגילאי 0–3. |
| **איגוד גנים פרטיים** | התאחדות מעונות היום הפרטיים בישראל | https://hmeonot.org.il/ | גוף מייצג של בעלי מעונות פרטיים (חשוב לדיאלוג ולמנגנון `Claim Profile`). |
| **מתחרה מסחרי (ישראל)** | בדרך לגן (`baderechlagan`) / אינפוגן (`infogan`) | https://www.baderechlagan.co.il/ <br> https://www.infogan.co.il/ | **❌ לסקירת שוק בלבד — איסור מוחלט על משיכת/העתקת מידע** (תקנון קנייני האוסר `Scraping` וזכויות יוצרים בלקט). |
| **בנצ'מרק בינלאומי** | StartingBlocks (אוסטרליה — ACECQA) | https://www.startingblocks.gov.au/ | תקן הזהב העולמי: מרשם ממשלתי המשלב סטטוס איכות + **מחיר יומי שקוף** + מחשבון סבסוד. |
| **בנצ'מרק בינלאומי** | Winnie (ארה"ב) | https://winnie.com/ | שילוב נתוני רישוי והפרות מדינתיים עם מידע קהילתי להורים. |
| **בנצ'מרק בינלאומי** | Daynurseries (בריטניה — בשילוב Ofsted) | https://www.daynurseries.co.uk/ | אינדקס המשלב דוחות פיקוח `Ofsted` עם אימות קפדני של דיווחי הורים. |

---

## 6. נוהל חובה לפני הוספת כל מקור מידע עתידי (`Pre-Ingestion Terms of Use Check` — `D-25`)

**אין לחבר אף אתר, מערכת GIS עירונית, API או קובץ חדש בעתיד לפני ביצוע ותיעוד של 6 שלבי הבדיקה המחייבים ב-[`research/06_data_sources_terms_of_use_audit.md`](./06_data_sources_terms_of_use_audit.md):**
1. קריאה מלאה של **תנאי השימוש (`Terms of Use`)** ורישיון המאגר (`Data License`).
2. וידוא היתר ל**משיכה אוטומטית (`API / Bulk Export`)** והימנעות מ-`Scraping` של אתרים האוסרים זאת (במקרה של רשות מקומית ללא Open Data — פנייה ישירה או בקשת `חופש מידע`).
3. וידוא זכות **שמירה קבועה ב-DB (`Caching`) והפצה מחדש (`Redistribution`)** ב-`Public REST API`, `MCP Server` וייצוא `Excel/CSV`.
4. בדיקת תאימות רישיון נגזר (**`ODbL 1.0` / `Share-Alike`**) וחובות קרדיט ואי-חסות (`Attribution` & `Non-Endorsement`).
5. דגימת שדות המקור לסינון **מידע אישי שדלף (`PII` כגון ת"ז)** או עמודות טקסט חופשי פוגעניות.
6. תיעוד המקור ותנאי הרישיון שלו בטבלאות מסמך זה וב-`research/06_data_sources_terms_of_use_audit.md` **לפני** כתיבת קוד ה-ETL.

</div>
