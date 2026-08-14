# دليل استخدام Proctor في GitHub Actions

يوفر هذا الدليل ملف تكوين (YAML) نموذجيًا متكاملًا لدمج حزمة Proctor في مسار عمل (Workflow) GitHub Actions، مع شرح تفصيلي لكل خيار وصلاحية لضمان عمل الأداة بأمان وكفاءة داخل بيئة التكامل المستمر (CI).

## ملف التكوين النموذجي (YAML)

يمكنك إنشاء هذا الملف في مستودعك ضمن المسار `.github/workflows/proctor-gate.yml`:

```yaml
name: Proctor Integrity Gate

# 1. تحديد متى يعمل الـ Workflow
on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - main

# 2. تحديد الصلاحيات (الأمان)
permissions:
  contents: read          # مطلوب لقراءة الكود (Checkout)
  pull-requests: write    # مطلوب لكتابة التعليقات على الـ Pull Request

jobs:
  proctor-audit:
    name: Audit Agent Execution
    runs-on: ubuntu-latest
    
    steps:
      # 3. جلب الكود المصدري
      - name: Checkout repository
        uses: actions/checkout@v4

      # 4. إعداد بيئة Node.js (مطلوب لتشغيل Proctor)
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      # 5. تثبيت الاعتماديات
      - name: Install dependencies
        run: npm ci

      # 6. تشغيل الوكيل (Agent) تحت مراقبة Proctor
      - name: Run agent under Proctor
        run: |
          # هنا يتم استبدال `your-agent-command` بالأمر الفعلي للوكيل
          npx --yes @genramzi/proctor run \
            --claims-file ./agent-report.md \
            -- your-agent-command

      # 7. التحقق من الإيصال (Work Receipt) واستخدام Action الخاص بـ Proctor
      - name: Verify Work Receipt
        uses: GenRamzi/Proctor@main
        with:
          receipt: .proctor/latest.receipt.json
          strict: "false"
          comment: "true"
```

---

## شرح تفصيلي للخيارات

### 1. أحداث التشغيل (`on`)
```yaml
on:
  pull_request:
    branches: [ main ]
```
يحدد هذا القسم متى يتم تشغيل الـ Workflow. في هذا المثال، يعمل عند إنشاء أو تحديث Pull Request موجه إلى فرع `main`. هذا هو المكان الأفضل لـ Proctor، حيث يقوم بفحص الكود المُولد بواسطة الوكيل *قبل* دمجه.

### 2. الصلاحيات (`permissions`)
```yaml
permissions:
  contents: read
  pull-requests: write
```
لأسباب أمنية، يجب منح أقل الصلاحيات الممكنة:
- `contents: read`: ضروري لخطوة `actions/checkout` لتتمكن من تحميل الكود.
- `pull-requests: write`: ضروري إذا كنت تريد من Proctor أن يكتب تقرير الفحص (النتيجة، الملاحظات، والشارة) كتعليق داخل الـ Pull Request. إذا لم تكن بحاجة للتعليقات، يمكنك حذفه.

### 3. إعداد البيئة (`actions/checkout` و `actions/setup-node`)
- **Checkout**: يجلب الكود الحالي.
- **Setup Node.js**: حزمة Proctor تتطلب Node.js بإصدار 20 أو أحدث لتعمل بشكل صحيح.

### 4. تشغيل الوكيل تحت Proctor (`run`)
```yaml
run: |
  npx --yes @genramzi/proctor run \
    --claims-file ./agent-report.md \
    -- your-agent-command
```
هذه هي الخطوة الأساسية:
- `npx --yes @genramzi/proctor run`: يقوم بتنزيل الحزمة (إذا لم تكن مثبتة محليًا) وتشغيل أمر `run`.
- `--claims-file ./agent-report.md`: خيار اختياري يخبر Proctor بقراءة ادعاءات الوكيل (مثل "تم إصلاح الخطأ") من ملف نصي. إذا كان الوكيل يطبع تقريره في الطرفية مباشرة، يمكنك الاستغناء عن هذا الخيار.
- `--`: الفاصل الإلزامي. كل ما يأتي بعده هو الأمر الفعلي الذي يشغل الوكيل الخاص بك.
- **النتيجة**: سيقوم Proctor بمراقبة التنفيذ، تسجيل السجل (Ledger)، وإنشاء إيصال العمل (Work Receipt) في مجلد `.proctor/`.

### 5. خطوة التحقق (`uses: GenRamzi/Proctor@main`)
```yaml
uses: GenRamzi/Proctor@main
with:
  receipt: .proctor/latest.receipt.json
  strict: "false"
  comment: "true"
```
تستدعي هذه الخطوة GitHub Action المُدمج في مستودع Proctor نفسه، والذي يقوم بالمهام التالية:
- **`receipt`**: مسار الإيصال الذي تم إنشاؤه في الخطوة السابقة. إذا تركته فارغًا، سيبحث Action تلقائيًا عن أحدث إيصال في مجلد `.proctor/`.
- **`strict`**: 
  - `"false"` (الافتراضي): يفشل الـ Workflow (يُرجع Exit Code غير صفري) فقط إذا كان هناك ادعاء **متناقض (CONTRADICTED)** أو تلاعب في الإيصال.
  - `"true"`: يجعل الفحص أكثر صرامة، حيث سيفشل الـ Workflow أيضًا إذا كان هناك ادعاء **غير مُثبت (UNPROVEN)**.
- **`comment`**: 
  - `"true"`: يقوم بنشر تعليق على الـ Pull Request يحتوي على ملخص الفحص وشارة النزاهة (Integrity Badge). يتطلب صلاحية `pull-requests: write`.
  - `"false"`: لن يتم نشر تعليق، ولكن سيتم رفع الإيصال والشارة كـ Artifacts مرفقة بملخص الـ Workflow.

---

## ماذا يحدث عند تشغيل هذا الـ Workflow؟

1. **النجاح**: إذا كانت جميع ادعاءات الوكيل مدعومة بالأدلة (مثل اجتياز جميع الاختبارات دون استخدام فلاتر)، سينتهي الـ Workflow بنجاح (علامة خضراء).
2. **الفشل (Gate)**: إذا اكتشف Proctor ممارسة "غسيل أخضر" (Green-washing) مثل تجاوز الاختبارات أو إضعافها، سيفشل الـ Workflow (علامة حمراء)، مما يمنع دمج الكود تلقائيًا.
3. **الأدلة (Artifacts)**: في كلتا الحالتين، سيتم حفظ ملف الإيصال (`.receipt.json`) وشارة النزاهة (`integrity.svg`) كملفات مرفقة يمكن تحميلها من صفحة GitHub Actions للمراجعة اليدوية.
