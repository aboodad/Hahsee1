# هاشم للطيب والعطور — واجهات النظام (React + Vite + Capacitor)

مبنية وفق التحليل المعتمد: Feature-based، Supabase، RTL عربي، جاهزة للتغليف كتطبيق Android/iOS عبر Capacitor.

## التشغيل في 4 خطوات

**1) أنشئ مشروعاً في Supabase** (supabase.com ← New project).

**2) أنشئ قاعدة البيانات** — اختر طريقة واحدة:
- *الأسهل:* افتح **SQL Editor** والصق محتوى `supabase/full_setup.sql` ثم Run (مرة واحدة على مشروع فارغ).
- *عبر CLI:* `supabase link --project-ref <REF>` ثم `npm run db:push` (يطبّق ملفات `supabase/migrations/` بالترتيب).

**3) انشر دالة إدارة المستخدمين** (مطلوبة للإعداد الأول وإنشاء الحسابات):
`npm run fn:deploy` — أو من Dashboard ← Edge Functions ← New function باسم `manage-user` والصق `supabase/functions/manage-user/index.ts`.

**4) ضع مفاتيح الربط في `.env`** (الخطوة الوحيدة المتبقية في الكود):
```
cd apps/web && cp .env.example .env     # ثم عدّل القيمتين
npm install && npm run dev
```
افتح http://localhost:5173 ← ستظهر لك صفحة **«أنشئ حساب مدير النظام»** مرة واحدة، ثم سجّل الدخول وأنشئ باقي المستخدمين من صفحة المستخدمين.

> الواجهة لا تحتاج أي مفتاح سري. استخدم `anon` فقط في `.env`. مفتاح `service_role` يبقى داخل Supabase (الـ Edge Function تأخذه تلقائياً).
> تأكد في Supabase ← Authentication ← Providers أن **Email** مفعّل.

## تطبيقات الجوال
```
npm run build
npx cap add android   # و/أو ios
npm run cap:sync
npm run cap:android   # يفتح Android Studio
```
مسح الباركود بالكاميرا يعمل داخل التطبيق فقط (`@capacitor-mlkit/barcode-scanning`)؛ على الويب يعمل قارئ USB (يكتب ثم Enter).

## ما تم تنفيذه (كل صفحات التحليل)
| القسم | الصفحات |
|---|---|
| الدخول | تسجيل الدخول **حسب الدور**، استعادة كلمة المرور |
| لوحة التحكم | بطاقات، رسوم، الأكثر مبيعاً، المخزون المنخفض، أداء الموظفين، فلاتر |
| المخزون | المنتجات (+نموذج/باركود/حركة)، التصنيفات، المخزن الرئيسي، مخزون الفروع، الطلبات، التحويلات، **الجرد**، **التالف** |
| المشتريات | الموردون (+**ملف المورد**)، فواتير الشراء، **مرتجعات الشراء** |
| المبيعات | نقطة البيع، الفواتير (+مرتجع)، العملاء (+**ملف العميل**)، **المرتجعات**، **الاستبدال**، **الورديات** |
| المالية | المصروفات، **الإيرادات الأخرى**، **الصندوق وطرق الدفع**، حسابات الفروع والتسويات، الضرائب، الأرباح والخسائر |
| الموظفون | الموظفون (+**ملف الموظف**)، **الرواتب** (+كشف راتب للطباعة)، **العمولات** |
| التقارير | **مركز التقارير: 20 تقريراً** مع فترة/فرع، طباعة/PDF، تصدير Excel (CSV) |
| الإدارة | الفروع (+**تفاصيل الفرع**)، **المستخدمون**، **الأدوار والصلاحيات** (مصفوفة)، **سجل العمليات**، الإشعارات، **الإعدادات** (9 تبويبات) |

## التسعيرة والدفعات (patch_04)
عند توريد نفس الصنف بسعر شراء مختلف تُنشأ دفعة مستقلة (نفس السعر = نفس الدفعة). الصفحة: `/inventory/pricing` (صلاحية `pricing`).
البيع يستهلك الأقدم أولاً (FIFO) ويسجّل تكلفة الدفعة، ويمكن تمرير `lot_id` لكل بند في `fn_create_sale` لبيع دفعة محددة.
طبّق `supabase_patch_04.sql` على قاعدة قائمة (أو `full_setup.sql` على مشروع جديد).

## مكونات الواجهة (مستوحاة من Dqnamo Kitchen)
بدون أي حزم إضافية (lucide + CSS). الألوان من هوية المشروع.
- `ui/HoldToConfirmButton` + `ui/HoldConfirm` (`holdConfirm()` بديل `confirm()` بالضغط المستمر، و`deferWithUndo()` لتنفيذ متأخر مع «تراجع») — الحذف والإلغاء والاعتماد.
- `ui/UndoNotice` — إشعار التراجع بعدّاد.
- `ui/MagneticDropZone` — رفع المرفقات (المصروفات، الإيرادات، التسويات).
- `shared/ReceiptPrinter` + `pos/components/SaleProgress` — شاشة إتمام البيع في نقطة البيع.

## ملفات قاعدة البيانات (بالترتيب)
موجودة جاهزة في `supabase/migrations/` وفي ملف واحد `supabase/full_setup.sql`:
1. المخطط  2. patch_01  3. patch_02 (الاستبدال، مرتجع الشراء، العمولات، الرواتب)  4. patch_03 (الإعداد الأول)

## إدارة المستخدمين (Edge Function)
إنشاء المستخدمين وإعادة تعيين كلمات المرور تحتاج مفتاح service_role، لذا تمر عبر دالة:
```
supabase functions deploy manage-user
```
(الملف: `supabase/functions/manage-user/index.ts`). بدون نشرها تعمل بقية صفحة المستخدمين (تعديل الدور والفرع).

## البنية
```
src/app        الراوتر، المزودات، حماية المسارات
src/layouts    Main / Pos / Auth + القائمة الجانبية (nav.config.ts)
src/components ui/ data/ shared/ (CrudPage لصفحات الإعداد السريعة)
src/features   صفحات كل قسم
src/store      auth, cart (POS), toast
src/lib        supabase, formatters, errors (رسائل عربية لأخطاء الدوال), status
```

## الخط
النظام يستخدم **IBM Plex Sans Arabic** (واضح ومناسب للجداول والأرقام)، ومضمّن محلياً عبر `@fontsource` فيعمل داخل تطبيقات الجوال بدون إنترنت. لتغييره: عدّل `tailwind.config.ts` و`src/styles/index.css` واستيرادات `src/main.tsx`.

## التصميم
الهوية: بني + ذهبي + كريمي (معرّفة في `tailwind.config.ts`). المكونات المشتركة: `StatCard` (عادية / Hero مع اتجاه ورسم مصغّر)، `Panel`، `Sparkline`، `Skeleton`، وأصناف CSS: `.card` `.card-hover` `.seg` `.tile-*` `.fade-up`.
