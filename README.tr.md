# Sunucu Dokümantasyonu

## Genel Bakış

Bu sunucu, kullanıcılar, şirketler, borçlular, alacaklılar, abonelikler ve görev takibi için kapsamlı bir API sağlayan [Fastify](https://www.fastify.io/) ve [tRPC](https://trpc.io/) ile oluşturulmuş bir Node.js arka ucudur. Veri depolama için PostgreSQL ([Drizzle ORM](https://orm.drizzle.team/)), önbellekleme ve oturum yönetimi için Redis kullanır ve harici web servisleri, e-posta bildirimleri ve SMS servisleriyle entegrasyonu destekler.

---

## Mimarisi

- **Giriş Noktası:** `src/index.ts`
- **Çatılar:** Fastify, tRPC
- **Veritabanı:** PostgreSQL (Drizzle ORM)
- **Önbellek/Oturum:** Redis
- **Kuyruk Sistemi:** Arka plan iş işleme için BullMQ
- **API Yapısı:** Tüm uç noktalar `/trpc` altında tRPC router'ları ile sunulur.

---

## Temel Özellikler

### 1. Kullanıcı Yönetimi

- Kullanıcılar için **CRUD işlemleri** (oluşturma, okuma, güncelleme, silme, toplu silme)
- **Bcrypt** ile parola şifreleme
- **Rol tabanlı alanlar** (rol, e-posta vb.)
- Kullanıcı listeleri için **sayfalama, sıralama ve arama**
- Kullanıcı listelerinin Redis'te **önbelleğe alınması**

### 2. Şirket Yönetimi

- Şirketler için **CRUD işlemleri**
- **Şirket seçme ve seçili şirketi getirme** (oturum tabanlı)
- Şirket listeleri için **sayfalama, sıralama ve arama**
- Şirket listelerinin Redis'te **önbelleğe alınması**

### 3. Borçlu & Alacaklı Yönetimi

- Seçili şirket ve dönem için **borçlu ve alacaklı listelerini çekme**
- **Harici web servisleriyle entegrasyon** (HTTP POST, oturum tabanlı kimlik doğrulama)
- Web servisi yanıtları için **hata yönetimi**

### 4. Abonelik Yönetimi

- Abonelikler için **CRUD işlemleri** (domain, SSL, hosting, mail)
- **Abonelik müşteri yönetimi** iletişim tercihleri ile
- **Otomatik süre dolumu bildirimleri** e-posta ve SMS ile
- **Arka plan iş işleme** abonelik süre dolumu hatırlatıcıları için

### 5. Görev Takibi

- **Müşteri yönetimi** abonelik takibi için
- **Abonelik süre dolumu izleme** otomatik bildirimlerle
- **E-posta ve SMS entegrasyonu** müşteri iletişimi için

---

## API Uç Noktaları (tRPC Router'ları)

Tüm uç noktalar `/trpc` altında sunulmaktadır.

- `/trpc/user` - Kullanıcı yönetimi
- `/trpc/company` - Şirket yönetimi
- `/trpc/debtor` - Borçlu verisi (harici entegrasyon)
- `/trpc/creditor` - Alacaklı verisi (harici entegrasyon)
- `/trpc/subscription` - Abonelik yönetimi
- `/trpc/subscriptionCustomer` - Abonelik müşteri yönetimi

Her router, CRUD ve iş mantığı işlemleri için birden fazla prosedür (sorgu ve mutasyon) sunar.

---

## Veritabanı Şeması

### Kullanıcılar Tablosu

| Alan         | Tip       | Açıklama           |
| ------------ | --------- | ------------------ |
| id           | serial    | Birincil anahtar   |
| name         | varchar   | Kullanıcı adı      |
| email        | varchar   | Kullanıcı e-posta  |
| phone        | varchar   | Kullanıcı telefon  |
| password     | varchar   | Şifrelenmiş parola |
| role         | varchar   | Kullanıcı rolü     |
| creationDate | timestamp | Oluşturulma zamanı |
| updatedOn    | timestamp | Son güncelleme     |

### Şirketler Tablosu

| Alan               | Tip       | Açıklama                  |
| ------------------ | --------- | ------------------------- |
| id                 | serial    | Birincil anahtar          |
| code               | varchar   | Şirket kodu               |
| name               | varchar   | Şirket adı                |
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

### Abonelikler Tablosu

| Alan             | Tip       | Açıklama                        |
| ---------------- | --------- | ------------------------------- |
| id               | serial    | Birincil anahtar                |
| startDate        | date      | Abonelik başlangıç tarihi       |
| endDate          | date      | Abonelik bitiş tarihi           |
| subscriptionType | enum      | Tip: domain, ssl, hosting, mail |
| userId           | integer   | Abonelik müşterisine referans   |
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

---

## Kimlik Doğrulama & Oturum Yönetimi

- **Oturumlar**, Redis ile birlikte `fastify-session` kullanılarak yönetilir.
- **Oturum verisi**, seçili şirket ve web servisi oturum kimliklerini içerir.
- **Parola şifreleme**, yapılandırılabilir salt round ile bcrypt kullanır.
- **Açık bir giriş (login) uç noktası yoktur**; kimlik doğrulama muhtemelen oturum ve harici web servisi girişi ile sağlanır.

---

## Önbellekleme

- **Kullanıcı ve şirket listeleri**, performans için Redis'te önbelleğe alınır.
- **Önbellek anahtarları**, sayfalama, sıralama ve arama parametrelerine göre oluşturulur.
- **Önbellek süresi (TTL)** yapılandırılabilir.

---

## Kuyruk Sistemi & Arka Plan İşçileri

- **BullMQ** arka plan iş işleme için kullanılır
- **Abonelik süre dolumu işçisi** süresi dolacak abonelikleri kontrol etmek için günlük çalışır
- **E-posta bildirimleri** 30, 15 ve 7 gün içinde süresi dolacak abonelikler için gönderilir
- **SMS bildirimleri** NetGSM entegrasyonu ile gönderilir
- **İşçi süreçleri** `npm run dev:worker` veya `npm run start:worker` ile ayrı olarak çalıştırılabilir

### Mevcut İşçiler

- **Abonelik Süre Dolumu İşçisi** (`src/services/queue-system/workers/subscription-expiry-worker.ts`)
  - 30, 15 ve 7 gün içinde süresi dolacak abonelikleri kontrol eder
  - Müşteri tercihlerine göre e-posta ve SMS bildirimleri gönderir
  - Her 24 saatte bir otomatik olarak çalışır

---

## Harici Entegrasyonlar

- **Borçlu ve alacaklı verileri**, şirket kimlik bilgileriyle harici bir web servisinden (SIS) çekilir.
- **Her harici istekten önce oturum tabanlı kimlik doğrulama** yapılır.
- **Yanıtlar** ayrıştırılır ve hatalar HTTP ve iş mantığına göre yönetilir.
- **E-posta servisi** entegrasyonu abonelik bildirimleri için
- **SMS servisi** entegrasyonu NetGSM ile abonelik hatırlatıcıları için

---

## Metrikler & Sıkıştırma

- **Prometheus metrikleri** `/metrics` altında sunulur.
- **Gzip sıkıştırma** global olarak etkindir.

---

## Ortam Değişkenleri

- `PORT` - Sunucu portu
- `CORS_ORIGIN` - İzin verilen CORS kökenleri
- `REDIS_SECRET` - Redis şifresi
- `SESSION_SECRET` - Oturum anahtarı
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` - PostgreSQL bağlantısı
- `REDIS_URI` - Redis bağlantı URI'si
- `NETGSM_USERNAME`, `NETGSM_PASSWORD` - NetGSM SMS servisi kimlik bilgileri
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` - E-posta servisi yapılandırması

---

## Proje Yapısı

- `src/index.ts` - Ana sunucu girişi
- `src/trpc/router/` - tRPC router'ları (user, company, debtor, creditor, subscription, subscriptionCustomer)
- `src/db/schema/` - Veritabanı şema tanımları
- `src/services/` - İş mantığı, Redis, web servisi entegrasyonu, kuyruk sistemi
- `src/services/queue-system/` - Arka plan iş işleme (BullMQ)
- `src/services/queue-system/workers/` - Arka plan işçileri
- `src/types/` - TypeScript tipleri
- `src/utils/` - Yardımcı fonksiyonlar (e-posta, formatlama)

---

## İstemci Uygulaması

Proje, aşağıdaki teknolojilerle oluşturulmuş bir Vue.js 3 ön uç uygulaması içerir:

- **Çatı:** Vue 3 Composition API ile
- **UI Kütüphanesi:** Vuetify 3
- **Durum Yönetimi:** Pinia
- **Yönlendirme:** Vue Router
- **HTTP İstemcisi:** tRPC client
- **Derleme Aracı:** Vite
- **TypeScript:** Tam TypeScript desteği

### İstemci Özellikleri

- **KPI'lar ve hızlı erişim** ile Dashboard
- **Kullanıcı Yönetimi** (sadece admin)
- **Şirket Yönetimi** (sadece admin)
- **Harici veri entegrasyonu** ile Borçlu & Alacaklı Yönetimi
- **Süre dolumu takibi** ile Abonelik Yönetimi
- **Abonelik müşterileri** için Görev Takibi
- **Genel raporlama** işlevselliği ile Raporlar
- **Mobil destek** ile Duyarlı Tasarım

### İstemci Navigasyon Yapısı

- **Ana Sayfa** - İstatistikler ve hızlı erişim ile Dashboard
- **Borçlular & Alacaklılar** - Harici veri entegrasyonu
- **Görev Takibi** - Abonelik ve müşteri yönetimi
- **Yönetim** - Kullanıcı ve şirket yönetimi (sadece admin)
- **Siparişler** - Sipariş yönetimi (planlanmış)
- **Raporlar** - Genel raporlama işlevselliği

---

## Nasıl Çalıştırılır

### Sunucu Kurulumu

1. Sunucu dizinine gidin: `cd server`
2. Bağımlılıkları yükleyin: `npm install`
3. Ortam değişkenlerini `.env` dosyasında ayarlayın.
4. Veritabanı migrasyonlarını çalıştırın: `npm run drizzle:migrate`
5. Sunucuyu başlatın: `npm run dev`
6. (İsteğe bağlı) Arka plan işçilerini başlatın: `npm run dev:worker`
7. API'ye şu adresten erişin: `http://localhost:<PORT>/trpc`

### İstemci Kurulumu

1. İstemci dizinine gidin: `cd client`
2. Bağımlılıkları yükleyin: `npm install`
3. Geliştirme sunucusunu başlatın: `npm run dev`
4. Uygulamaya şu adresten erişin: `http://localhost:5173`

### Tam Stack Geliştirme

1. Sunucuyu başlatın (`server/` dizininden): `npm run dev`
2. İstemciyi başlatın (`client/` dizininden): `npm run dev`
3. İstemci otomatik olarak sunucu API'sine bağlanacaktır

### Mevcut Scriptler

- `npm run dev` - Geliştirme sunucusunu başlat
- `npm run dev:worker` - Geliştirme ortamında arka plan işçilerini başlat
- `npm run dev:debug` - Hata ayıklama ile sunucuyu başlat
- `npm run build` - Üretim için derle
- `npm run start` - Üretim sunucusunu başlat
- `npm run start:worker` - Üretim ortamında arka plan işçilerini başlat
- `npm run drizzle:generate` - Veritabanı migrasyonları oluştur
- `npm run drizzle:migrate` - Veritabanı migrasyonlarını çalıştır
- `npm run drizzle:studio` - Veritabanı yönetimi için Drizzle Studio'yu aç
