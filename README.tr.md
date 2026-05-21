# Sunucu Dokümantasyonu

## Genel Bakış

Bu sunucu, kullanıcılar, firmalar, borçlular, alacaklılar, abonelikler, siparişler, raporlar ve daha fazlası için kapsamlı bir API sağlayan [Fastify](https://www.fastify.io/) ve [tRPC](https://trpc.io/) ile oluşturulmuş bir Node.js arka ucudur. Veri depolama için PostgreSQL ([Drizzle ORM](https://orm.drizzle.team/)), oturum yönetimi için Redis (ioredis) kullanır ve harici web servisleri, e-posta bildirimleri ile SMS servisleriyle entegrasyonu destekler.

---

## Mimarisi

- **Giriş Noktası:** `src/index.ts`
- **Çatılar:** Fastify 5.x, tRPC 11.x
- **Veritabanı:** PostgreSQL (Drizzle ORM)
- **Önbellek/Oturum:** Redis (ioredis)
- **Arka Plan İşleri:** Node-cron (abonelik süre dolumu hatırlatıcıları, her gün saat 05:00)
- **Hata Takibi:** Sentry
- **API Yapısı:** Tüm uç noktalar `/trpc` altında tRPC router'ları ile sunulur.

---

## Temel Özellikler

### 1. Kullanıcı Yönetimi

- Kullanıcılar için **CRUD işlemleri** (oluşturma, okuma, güncelleme, silme, toplu silme)
- **Bcrypt** ile parola şifreleme
- **Sayfa rolleri** (izin modülleri) aracılığıyla **rol tabanlı erişim kontrolü**
- Kullanıcı listeleri için **sayfalama, sıralama ve arama**

### 2. Firma Yönetimi

- Firmalar için **CRUD işlemleri**
- **Firma seçme ve seçili firmayı getirme** (oturum tabanlı)
- Firma başına **web servisi kimlik bilgileri** (URL, kullanıcı adı, API anahtarı/şifresi)
- Firma listeleri için **sayfalama, sıralama ve arama**

### 3. Borçlu & Alacaklı Yönetimi

- Seçili firma ve dönem için **borçlu ve alacaklı listelerini çekme**
- **Harici SIS web servisiyle entegrasyon** (HTTP POST, oturum tabanlı kimlik doğrulama)
- Web servisi yanıtları için **hata yönetimi**

### 4. Abonelik Yönetimi

- Abonelikler için **CRUD işlemleri** (domain, SSL, hosting, mail)
- **Abonelik müşteri yönetimi** iletişim tercihleri ile
- **Otomatik süre dolumu bildirimleri** e-posta ve SMS ile (30, 15, 7 gün öncesinde)

### 5. Siparişler, Sözleşmeler, Stok, İrsaliye & Biletler

- Siparişler, sözleşmeler, stok, irsaliye ve destek biletleri için tam router'lar

### 6. Raporlama & Denetim Kaydı

- **Dönem filtreleme** ile iş raporlaması
- Tüm kullanıcı işlemlerini takip etmek için **sayfalandırılmış denetim kaydı** (`event-log`)

---

## API Uç Noktaları (tRPC Router'ları)

Tüm uç noktalar `/trpc` altında sunulmaktadır.

- `/trpc/auth` - Giriş, çıkış, şifre sıfırlama, 2FA, cihaz anahtarı yönetimi
- `/trpc/user` - Kullanıcı yönetimi
- `/trpc/company` - Firma yönetimi
- `/trpc/debtor` - Borçlu verisi (harici SIS entegrasyonu)
- `/trpc/creditor` - Alacaklı verisi (harici SIS entegrasyonu)
- `/trpc/subscription` - Abonelik yönetimi
- `/trpc/subscriptionCustomer` - Abonelik müşteri yönetimi
- `/trpc/report` - İş raporlaması
- `/trpc/definition` - Tanım yönetimi
- `/trpc/contract` - Sözleşme yönetimi
- `/trpc/stock` - Stok yönetimi
- `/trpc/order` - Sipariş yönetimi
- `/trpc/waybill` - İrsaliye yönetimi
- `/trpc/ticket` - Destek bileti yönetimi
- `/trpc/pageRole` - İzin modülü yönetimi
- `/trpc/eventLog` - Denetim kaydı sorgulama

Her router, CRUD ve iş mantığı işlemleri için birden fazla prosedür (sorgu ve mutasyon) sunar.

---

## Veritabanı Şeması

### Kullanıcılar Tablosu

| Alan          | Tip       | Açıklama           |
| ------------- | --------- | ------------------ |
| id            | serial    | Birincil anahtar   |
| name          | varchar   | Kullanıcı adı      |
| email         | varchar   | Kullanıcı e-posta  |
| phone         | varchar   | Kullanıcı telefon  |
| password      | varchar   | Şifrelenmiş parola |
| role          | varchar   | Kullanıcı rolü     |
| creationDate  | timestamp | Oluşturulma zamanı |
| updatedOn     | timestamp | Son güncelleme     |
| last_login_at | timestamp | Son giriş zamanı   |

### Firmalar Tablosu

| Alan               | Tip       | Açıklama                  |
| ------------------ | --------- | ------------------------- |
| id                 | serial    | Birincil anahtar          |
| code               | varchar   | Firma kodu                |
| name               | varchar   | Firma adı                 |
| manager            | varchar   | Yönetici adı              |
| phone              | varchar   | Telefon numarası          |
| licenseDate        | timestamp | Lisans tarihi             |
| status             | boolean   | Aktif/pasif               |
| webServiceSource   | varchar   | Web servisi URL'si        |
| webServiceUsername | varchar   | Web servisi kullanıcı adı |
| serverName         | varchar   | Sunucu adı                |
| period             | integer   | Muhasebe dönemi           |
| apiKey             | varchar   | Web servisi API anahtarı  |
| apiSecret          | varchar   | Web servisi API şifresi   |
| creationDate       | timestamp | Oluşturulma zamanı        |
| updatedOn          | timestamp | Son güncelleme            |

### KullanıcılarFirmalara Tablosu

| Alan       | Tip                     | Açıklama                |
| ---------- | ----------------------- | ----------------------- |
| user_id    | integer                 | Yabancı anahtar → kullanıcı |
| company_id | integer                 | Yabancı anahtar → firma |
| created_at | timestamp with timezone | Oluşturulma zamanı      |

### Abonelikler Tablosu

| Alan             | Tip       | Açıklama                        |
| ---------------- | --------- | ------------------------------- |
| id               | serial    | Birincil anahtar                |
| startDate        | date      | Abonelik başlangıç tarihi       |
| endDate          | date      | Abonelik bitiş tarihi           |
| subscriptionType | enum      | Tip: domain, ssl, hosting, mail |
| customerId       | integer   | Abonelik müşterisine referans   |
| creationDate     | timestamp | Oluşturulma zamanı              |
| updatedOn        | timestamp | Son güncelleme                  |

### Abonelik Müşterileri Tablosu

| Alan                  | Tip       | Açıklama                   |
| --------------------- | --------- | -------------------------- |
| id                    | serial    | Birincil anahtar           |
| name                  | varchar   | Müşteri adı                |
| email                 | varchar   | Müşteri e-posta            |
| phone                 | varchar   | Müşteri telefon            |
| remindExpiryWithEmail | boolean   | E-posta hatırlatma tercihi |
| remindExpiryWithSms   | boolean   | SMS hatırlatma tercihi     |
| creationDate          | timestamp | Oluşturulma zamanı         |
| updatedOn             | timestamp | Son güncelleme             |

### Olay Kayıtları Tablosu

| Alan         | Tip                     | Açıklama                                 |
| ------------ | ----------------------- | ---------------------------------------- |
| id           | serial                  | Birincil anahtar                         |
| resourceType | text                    | Kaynak türü (Türkçe)                     |
| resourceId   | text                    | Etkilenen kaynağın ID'si                 |
| action       | text                    | Gerçekleştirilen işlem (Türkçe)          |
| actorId      | integer                 | Yabancı anahtar → kullanıcı (null olabilir) |
| status       | text                    | Sonuç (`başarılı` / `başarısız`)         |
| ipAddress    | text                    | İstemci IP adresi                        |
| userAgent    | text                    | İstemci kullanıcı ajanı                  |
| createdAt    | timestamp with timezone | Oluşturulma zamanı                       |

---

## Kimlik Doğrulama & Oturum Yönetimi

- **Oturumlar**, Redis'te 24 saatlik TTL ile `@mgcrea/fastify-session` kullanılarak yönetilir.
- **Oturum verisi** `userId`, `selectedCompanyId` ve `externalSessionId` (web servisi kimlik doğrulaması için) içerir.
- **Parola şifreleme**, 10 salt round ile bcrypt kullanır.
- **Giriş/çıkış** ve tam 2FA akışı `/trpc/auth` router'ı üzerinden sunulmaktadır.

---

## Arka Plan İşleri

- **Node-cron**, abonelik hatırlatıcı işini her gün saat 05:00'de zamanlar.
- **Abonelik hatırlatıcısı** (`src/services/jobs/subscription-reminder.ts`), müşteri tercihlerine göre 7, 15 ve 30 gün içinde süresi dolacak abonelikler için e-posta ve SMS bildirimleri gönderir.
- Ayrı bir işçi süreci gerekmez — işler ana sunucu süreci içinde çalışır.

---

## Harici Entegrasyonlar

- **Borçlu ve alacaklı verileri**, firma kimlik bilgileriyle harici bir SIS web servisinden çekilir.
- **Her harici istekten önce oturum tabanlı kimlik doğrulama** yapılır; oturum kimliği kullanıcının sunucu oturumunda saklanır.
- **E-posta servisi** abonelik bildirimleri için Nodemailer (SMTP) kullanır.
- **SMS servisi** abonelik hatırlatıcıları için NetGSM REST API kullanır.

---

## Sıkıştırma

- **Gzip sıkıştırma** tüm yanıtlarda global olarak etkindir.

---

## Ortam Değişkenleri

| Değişken             | Açıklama                                               |
| -------------------- | ------------------------------------------------------ |
| `NODE_ENV`           | `development`, `production` veya `test`                |
| `PORT`               | Sunucu portu (varsayılan: `3000`)                      |
| `CORS_ORIGIN`        | İzin verilen CORS kaynak URL'si                        |
| `REDIS_URI`          | Redis bağlantı URI'si (kimlik doğrulama dahil)         |
| `SESSION_KEY`        | Base64 kodlanmış 32+ byte oturum anahtarı              |
| `DB_HOST`            | PostgreSQL host                                        |
| `DB_USER`            | PostgreSQL kullanıcısı                                 |
| `DB_PASS`            | PostgreSQL şifresi                                     |
| `DB_NAME`            | PostgreSQL veritabanı adı                              |
| `SMTP_USER`          | SMTP e-posta adresi                                    |
| `SMTP_PASS`          | SMTP şifresi                                           |
| `NETGSM_HEADER`      | NetGSM SMS gönderici başlığı                           |
| `NETGSM_USERNAME`    | NetGSM kullanıcı adı                                   |
| `NETGSM_PASSWORD`    | NetGSM şifresi                                         |
| `SENTRY_DSN`         | Sentry DSN (isteğe bağlı, yalnızca üretim)            |
| `FAKE_2FA`           | Geliştirmede gerçek 2FA'yı atlamak için `true` yapın  |

Tüm değişkenler, başlangıçta `src/config/env.ts` üzerinden Zod ile doğrulanır.

---

## Proje Yapısı

```
src/
├── index.ts                      # Ana sunucu giriş noktası
├── config/env.ts                 # Ortam değişkeni doğrulama (Zod)
├── constants/                    # Uygulama sabitleri (auth, sayfalama, sayfa rolleri)
├── db/
│   └── schema/                   # Drizzle ORM tablo tanımları & ilişkiler
├── router/
│   └── file.ts                   # Fastify dosya yükleme rotası (/upload)
├── services/
│   ├── jobs/                     # Arka plan cron işleri
│   │   └── subscription-reminder.ts
│   ├── zod-validations/          # Zod giriş şemaları
│   ├── web-service/              # Harici SIS API entegrasyonu
│   ├── redis.ts                  # Redis istemcisi
│   ├── logger.ts                 # Pino logger tekili
│   └── netgsm.ts                 # NetGSM SMS sarmalayıcı
├── trpc/
│   ├── context.ts                # tRPC istek bağlamı
│   └── router/                   # tRPC router'ları (auth, user, company, …)
├── types/                        # TypeScript tip tanımları
└── utils/                        # Yardımcılar (auth, e-posta, dosya, crypto, event-log)
```

---

## Nasıl Çalıştırılır

### Kurulum

1. Bağımlılıkları yükleyin: `npm install`
2. Ortam değişkenlerini `.env` dosyasında ayarlayın (yukarıdaki Ortam Değişkenleri tablosuna bakın).
3. Veritabanı migrasyonlarını çalıştırın: `npm run drizzle:migrate`
4. Geliştirme sunucusunu başlatın: `npm run dev`
5. API'ye şu adresten erişin: `http://localhost:3000/trpc`

### Mevcut Scriptler

| Script                          | Açıklama                                              |
| ------------------------------- | ----------------------------------------------------- |
| `npm run dev`                   | Otomatik yeniden yükleme ile geliştirme sunucusu      |
| `npm run dev:debug`             | Node hata ayıklayıcısı ile geliştirme sunucusu        |
| `npm run build`                 | TypeScript derle ve Sentry kaynak haritalarını yükle  |
| `npm run start`                 | Derlenmiş üretim sunucusunu çalıştır (`dist/index.js`)|
| `npm run lint`                  | ESLint çalıştır                                       |
| `npm run format`                | Prettier ile kaynak dosyaları formatla                |
| `npm run drizzle:generate`      | Şema değişikliklerinden migrasyon dosyaları oluştur   |
| `npm run drizzle:migrate`       | Bekleyen veritabanı migrasyonlarını çalıştır          |
| `npm run drizzle:studio`        | Görsel DB inceleme için Drizzle Studio'yu aç          |
