# Incagen — Ürün ve Sistem Akışı

## Plan ayrımı

| Özellik | Free | Premium |
|---|---|---|
| Aylık analiz | 5 | 30 |
| Analiz başına dosya | 5 | 20 |
| Dosya başına boyut | 25 MB | 50 MB |
| Analiz derinliği | Gemini 3.8 Flash `medium` | Gemini 3.8 Flash `high` |
| Çıktı | Güvenilir web ve PDF raporu | Daha derin karşılaştırma ve önerilerle web ve PDF raporu |
| Harici veri kaynakları | Bulunmaz | Önce Google Analytics, ardından Microsoft Clarity |

MVP ödeme olmadan davetli Free beta olarak açılır. iyzico aboneliği ve Premium yetkileri MVP sonrasındaki milestone'da etkinleştirilir.

## Müşteri profilleri

- KOBİ yöneticisi: ilk işlevsel profil
- E-ticaret işletmesi: onboarding içinde görünür, “Yakında” durumunda pasif
- Ajans/danışman: onboarding içinde görünür, “Yakında” durumunda pasif

## Ana ürün akışı

```mermaid
flowchart TD
    START([Incagen]) --> PLAN{Plan kontrolü}

    PLAN -->|Free| FREE[Standart dosya ve analiz kapsamı]
    PLAN -->|Premium| PREMIUM[Geniş dosya kapsamı<br/>Derin analiz<br/>Google Analytics + Microsoft Clarity]

    FREE --> SOURCE[Veri kaynaklarını hazırla]
    PREMIUM --> SOURCE

    SOURCE --> GATE[Düşük maliyetli AI ile<br/>spam ve uygunluk kontrolü]
    GATE -->|Uygun değil| REJECT[Anlaşılır uyarı ve yeniden deneme]
    GATE -->|Uygun| NORMALIZE[Dosyaları ve bağlı kaynakları<br/>ortak analiz formatına dönüştür]

    NORMALIZE --> ANALYZE[Gemini 3.8 Flash ile ana analiz]
    ANALYZE --> JSON[Yapılandırılmış JSON sonuç]
    JSON --> VALIDATE{Backend doğrulaması}

    VALIDATE -->|Eksik veya bozuk| RETRY[Kontrollü yeniden üretim]
    RETRY --> VALIDATE
    VALIDATE -->|Geçerli| OUTPUT[Profesyonel animasyonlu<br/>grafikler, tablolar ve içgörüler]

    OUTPUT --> HISTORY[Analizi Firestore geçmişine kaydet]
    HISTORY --> END([Sonuç ve Geçmiş Analizlerim])

    classDef primary fill:#4C2A85,color:#FFFFFF,stroke:#BCEDF6,stroke-width:2px;
    classDef process fill:#F5F0FA,color:#320E3B,stroke:#7B5AA6,stroke-width:1px;
    classDef success fill:#DDFBD2,color:#1D3A18,stroke:#79A86A,stroke-width:1px;
    classDef warning fill:#FFF3CD,color:#5C4300,stroke:#D5A524,stroke-width:1px;

    class START,ANALYZE,END primary;
    class FREE,PREMIUM,SOURCE,GATE,NORMALIZE,JSON,RETRY,HISTORY process;
    class OUTPUT success;
    class REJECT warning;
```

## Firebase ve AI veri hattı

```mermaid
flowchart LR
    subgraph CLIENT[React Uygulaması]
        UI[Dosya seçimi<br/>Plan ve sonuç arayüzü]
        PROGRESS[İşlem durumu<br/>ve animasyonlar]
    end

    subgraph FIREBASE[Firebase Backend]
        AUTH[Firebase Authentication]
        FUNCTIONS[Firebase Functions<br/>İş akışı yönetimi]
        TASKS[Cloud Tasks<br/>Güvenli iş kuyruğu]
        STORAGE[(Firebase Storage<br/>Kaynak dosyalar)]
        FIRESTORE[(Cloud Firestore<br/>Durum, JSON sonuç ve geçmiş)]
    end

    subgraph SOURCES[Premium Veri Kaynakları]
        GA[Google Analytics]
        CLARITY[Microsoft Clarity]
    end

    subgraph PROCESSING[Python Cloud Run]
        CHECK[Dosya ve güvenlik<br/>kontrolleri]
        TRANSFORM[Dosya ayrıştırma ve<br/>ortak veri formatı]
        FILTER[Gemini Flash-Lite<br/>Semantik uygunluk]
        GEMINI[Gemini 3.8 Flash<br/>Ana analiz]
        SCHEMA[JSON Schema doğrulama<br/>ve yeniden deneme]
    end

    UI --> AUTH
    AUTH --> FUNCTIONS
    UI --> STORAGE
    STORAGE --> FUNCTIONS
    GA --> FUNCTIONS
    CLARITY --> FUNCTIONS

    FUNCTIONS --> TASKS
    TASKS --> CHECK
    CHECK --> TRANSFORM
    TRANSFORM --> FILTER
    FILTER --> GEMINI
    GEMINI --> SCHEMA
    SCHEMA --> FIRESTORE

    FIRESTORE --> PROGRESS
    FIRESTORE --> UI

    classDef firebase fill:#FFF1CC,color:#4A3100,stroke:#F2A900,stroke-width:1px;
    classDef ai fill:#4C2A85,color:#FFFFFF,stroke:#BCEDF6,stroke-width:2px;
    classDef source fill:#EAF6FF,color:#12324A,stroke:#5798C5,stroke-width:1px;

    class AUTH,FUNCTIONS,STORAGE,FIRESTORE firebase;
    class CHECK,FILTER,TRANSFORM,GEMINI,SCHEMA ai;
    class GA,CLARITY source;
```

## Kullanıcıya gösterilecek işlem aşamaları

Teknik servis isimleri ve spam kontrolü kullanıcıya gösterilmez. Arayüz yalnızca kısa ve güven veren durumlar gösterir:

```text
Dosyalarınız hazırlanıyor
Verileriniz güvenli şekilde işleniyor
İşletme verileriniz analiz ediliyor
İçgörüler ve öneriler oluşturuluyor
Sonuçlarınız görselleştiriliyor
```

## Sonuç yapısı

Geçerli JSON sonucu frontend aşağıdaki profesyonel bölümlere dönüştürür:

- Genel özet ve temel KPI kartları
- Animasyonlu grafikler ve karşılaştırmalı tablolar
- Önemli bulgular ve nedenler
- Yapılması gerekenler
- Kaçınılması gerekenler
- Önceliklendirilmiş öneriler
- Veri kalitesi veya eksik bilgi uyarıları

## Temel teknik kararlar

- İlk kullanıcı profili KOBİ yöneticisidir; e-ticaret ve ajans/danışman profilleri işlev kazanana kadar pasif gösterilir.
- MVP, Avrupa bölgelerinde ayrı Firebase dev ve prod projeleriyle davetli beta olarak yayınlanır.
- Firebase Authentication Google ve e-posta/parola girişini destekler.
- MVP tek kullanıcıyla çalışır; veri modeli gelecekteki ekip üyeliği için `workspaceId` içerir.
- Desteklenen formatlar CSV, TSV, XLS/XLSX, ODS, PDF, DOC/DOCX, TXT, RTF, Markdown, PPT/PPTX, JSON, XML ve görsellerdir.
- Analizler arka plan işi olarak yürür; kullanıcı sekmeden ayrılsa bile Firestore üzerinden durum ve geçmiş korunur.
- Ana analiz modeli `gemini-3.8-flash` olacaktır.
- Gemini 3.8 Flash, kampanyalı fiyatların geçerli olduğu 31 Aralık 2026 tarihine kadar kullanılacak; sonrasında güncel model ve fiyat seçenekleri yeniden değerlendirilecektir.
- Free analizlerde `medium`, Premium analizlerde `high` düşünme seviyesi kullanılacaktır.
- MIME, uzantı, boyut, checksum ve zararlı içerik kontrolleri deterministik yapılır; semantik uygunluk yapılandırılabilir Gemini Flash-Lite modeliyle değerlendirilir.
- Model yanıtı tanımlı JSON şemasına uymak zorundadır; geçersiz yanıt kontrollü şekilde yeniden üretilir.
- Kesin oranlar ve sayısal metrikler backend tarafından doğrulanmadan kullanıcıya gösterilmez.
- Firebase Functions yetkilendirme ve orkestrasyonu, Cloud Tasks iş kuyruğunu, Python Cloud Run ise dosya ve AI işlerini yürütür; anahtarlar frontend'e verilmez.
- Kaynak dosyalar Firebase Storage'da tutulur.
- Analiz durumu, doğrulanmış JSON sonuçları ve geçmiş analiz kayıtları Cloud Firestore'da tutulur.
- Kaynak dosyalar ve sonuçlar kullanıcı silene kadar saklanır; silme işlemi tüm ilişkili verileri kalıcı olarak temizler.
- Geçmiş Analizlerim ve markalı PDF çıktısı MVP kapsamındadır.
- Premium ödeme altyapısı iyzico ile kurulur; Google Analytics ilk, Microsoft Clarity ikinci harici entegrasyondur.
