<div dir="rtl">

# מעקב פערים, דחיות וצ'קליסט טרום-השקה (`MVP1` → `Production` → `Phase 2`)

מסמך זה מרכז במקום אחד את **כל ההקלות הזמניות, הטיוטות, האינטגרציות החסרות והפיצ'רים שנדחו בכוונה** במהלך פיתוח `MVP1`, כדי שלא נשכח אף פרט לפני העלייה לאוויר (`Production`) ובמעבר לשלב ב' (`Phase 2`).

---

## 1. חוסמים קריטיים לפני עלייה ל-`Production` (`Go-Live Blockers`)

| # | נושא | מצב נוכחי בפיתוח (`Dev / Local`) | מה נדרש לביצוע לפני השקה | קבצים רלוונטיים |
|---|---|---|---|---|
| **G-01** | **אימות Google OIDC אמיתי** | ללא `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` — רץ עם טוקן פיתוח מקומי (`dev_sub_<digits>`) ללא פתיחת חלון ההתחברות של Google. | הקמת OAuth 2.0 Web Client ב-Google Cloud Console (`Authorized JavaScript origins` לדומיין הפרודקשן + `localhost:3000`), הזנת `GOOGLE_CLIENT_ID` ב-Vault/K8s ו-`VITE_GOOGLE_CLIENT_ID` בבניית ה-Frontend, ובדיקת חלון ההתחברות האמיתי (`Scope: openid` בלבד). | `frontend/src/utils/google-auth.ts`, `backend/src/security/external-verifiers.ts`, `.env.example` |
| **G-02** | **Cloudflare Turnstile אמיתי** | בסביבת Dev ללא `TURNSTILE_SECRET_KEY` נשלח טוקן דמה (`turnstile_managed_background_token`) והשרת מאשר כל טוקן באורך ≥4. | יצירת Widget במצב **`Managed` / `Invisible`** ב-Cloudflare, הטמעת סקריפט ה-Client ב-Frontend עם `VITE_TURNSTILE_SITE_KEY`, והזנת `TURNSTILE_SECRET_KEY` ב-Vault/K8s. | `frontend/src/components/crowdsourcing/ParentReportWizardModal.tsx`, `backend/src/security/external-verifiers.ts` |
| **G-03** | **אישור משפטי סופי לתנאי השימוש, מדיניות הפרטיות והנגישות** | המודאל `TermsAndPrivacyModal.tsx` מציג כרגע **נוסח טיוטה** (עם תגית טיוטה) לפני אישור היועץ המשפטי של הסדנא. | קבלת נוסח מאושר מהיועץ המשפטי של הסדנא (כולל כתב ויתור, הודעת פרטיות לפי תיקון 13, מדיניות עוגיות, ופרטי רכז/ת נגישות לפי ת"י 5568), עדכון הטקסט והסרת תווית ה"טיוטה". | `frontend/src/components/shell/TermsAndPrivacyModal.tsx`, `docs/03_legal_and_privacy_consultation_brief.md` |
| **G-04** | **מפתחות הצפנה (`Peppers`) ו-Vault ב-`hasadna-k8s`** | בפיתוח המקומי מוגדרים ערכי `dev-only-*` ברירת מחדל ב-`env.ts` / `docker-compose.yml`. | הפקת שני מפתחות רנדומליים בני 256 ביט (`SECRET_PEPPER`, `QUOTA_PEPPER_SEPARATE`) ושמירתם ב-HashiCorp Vault של הסדנא, הפרדת גישה ל-`app_private` לפחות מ-10 מורשי גישה, ווידוא פעולת `CronJob` לאיפוס השנתי ב-31 באוגוסט. | `backend/src/config/env.ts`, `docs/k8s/`, `docs/07_deployment_guide_hasadna_k8s.md` |
| **G-05** | **הרצת צינור ETL חי מלא מול מאגרי הממשלה והרשויות** | ב-Docker המקומי רצים נתוני Seed מצומצמים (מספר מסגרות הדגמה). | הרצה ראשונית ומאומתת של `npm run etl` מול כלל המקורות הרשמיים (`data.gov.il`, משרד החינוך, משרד העבודה, GIS עירוניים, ופיילוט גיליון ת"א למסגרות מצטלבות בלבד), ואימות תזמון ה-`Weekly ETL CronJob` ב-K8s. | `backend/src/etl/`, `docs/k8s/jobs-migrate-and-etl.yaml` |
| **G-06** | **עדכון שנתי של תעריפי מעון סמל מפוקח (Benchmarks)** | טבלת `regulated_tuition_benchmarks` מכילה כרגע תעריפי בסיס לשנים תשפ"ה–תשפ"ז (`2025–2027`). | הוספת תעריפי צו הפיקוח המעודכנים של משרד העבודה עם פרסומם בכל שנה (למשל תשפ"ח `2028`), ובהמשך שאיבה אוטומטית אם יפורסמו ב-`data.gov.il`. | `backend/src/db/seed-dictionaries.ts` |
| **G-07** | **ביקורת נגישות בפועל (`ת"י 5568 / WCAG AA`)** | קיים מבנה סמנטי וטבלה נגישה לצד המפה, אך טרם בוצעה בדיקת קורא מסך (`NVDA`/`VoiceOver`) וניווט מקלדת מלא. | ביצוע בדיקת נגישות מלאה (ניווט מקלדת ב-Dropdowns, באשף הדיווח ובמודאלים, ניגודיות צבעים, `aria-live`) ועדכון הצהרת הנגישות. | `frontend/src/components/` |

---

## 2. מגבלות `MVP1` שנדחו בכוונה לשלב ב' (`Phase 2 Roadmap`)

| # | נושא | מצב נוכחי ב-`MVP1` | יעד לשלב ב' (`Phase 2`) | מיקום בקוד / תיעוד |
|---|---|---|---|---|
| **P2-01** | **דיווח על מסגרות שאינן במאגרי הממשלה והרשויות** | בשלב 1 של אשף הדיווח מוצגת ההודעה: *"ℹ️ לא מצאתם את הגן? כרגע ניתן לדווח על מסגרות המופיעות במאגרי הממשלה והרשויות המקומיות בלבד. מסלול דיווח על מסגרות שאינן במרשם ייפתח בהמשך."* | פתיחת מסלול הוספת גנים פרטיים שאינם במרשם הרשמי, תוך הסתרת מספר בית ב-`public` (רחוב ומיקום מקורב בלבד עד אימות בעלים), הצלבת כפילויות ו-`PostGIS` + `Nominatim`. | `frontend/src/components/crowdsourcing/ParentReportWizardModal.tsx`, `docs/02_decisions_log_and_roadmap.md` (`D-28`) |
| **P2-02** | **מסלול הזדהות בעלי גנים (`Owner Claim` + `SMS/Voice OTP`)** | לא קיים ב-`MVP1`. | התקשרות עם ספק `SMS + Voice OTP` ישראלי יחיד במודל Prepaid (כגון `019` / `InforU` עם נספח `תקנה 15` ואחסון בישראל בלבד — פסילת `WhatsApp Cloud API`), אימות בעלות עיוור, `Opt-In` מתועד לחשיפת כתובת/טלפון, ללא דריסת דיווחי הורים. | `docs/02_decisions_log_and_roadmap.md` (`D-27`, `D-28`) |
| **P2-03** | **ממשק בקרה (`Moderation UI`) לפניות `"מצאתם טעות?"`** | כרגע קיים כלי CLI (`manage-corrections.ts`) לטיפול בפניות. | שדרוג לממשק אדמין מאובטח (או אינטגרציית GitHub/Slack/Email פנימית לצוות הסדנא) לטיפול מהיר בפניות תיקון. | `backend/src/cli/manage-corrections.ts` |
| **P2-04** | **פיצ'רי המשך (`Backlog` עתידי)** | לא ב-`MVP1` (`D-33`). | בחינה עתידית של התראות שינוי מחיר, השוואת גנים זה לצד זה, ייצוא `XLSX` עשיר בנוסף ל-`CSV`, והתרחבות מדורגת למאפיינים נוספים בכפוף לייעוץ משפטי. | `docs/02_decisions_log_and_roadmap.md` (`D-33`) |

---

## 3. נוהל עבודה מחייב עם מסמך זה
- **כל פשרה זמנית, Mock, טיוטה או מגבלת `MVP1` חדשה** שמוכנסת לקוד חייבת להירשם בטבלה המתאימה במסמך זה.
- **כל פער שנסגר** מסומן כ-`✅ הושלם` עם תאריך וקישור לקומיט/PR.

</div>
