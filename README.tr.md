# Sunucu Dokümantasyonu

## Genel Bakış

Bu sunucu, kullanıcılar, şirketler, borçlular ve alacaklılar için yönetim sağlayan [Fastify](https://www.fastify.io/) ve [tRPC](https://trpc.io/) ile oluşturulmuş bir Node.js arka ucudur. Veri depolama için PostgreSQL ([Drizzle ORM](https://orm.drizzle.team/)), önbellekleme ve oturum yönetimi için Redis kullanır ve harici web servisleriyle entegrasyonu destekler.

---

## Mimarisi

- **Giriş Noktası:** `src/index.ts`
- **Çatılar:** Fastify, tRPC
- **Veritabanı:** PostgreSQL (Drizzle ORM)
- **Önbellek/Oturum:** Redis
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

---

## API Uç Noktaları (tRPC Router'ları)

Tüm uç noktalar `/trpc` altında sunulmaktadır.

- `/trpc/user` - Kullanıcı yönetimi
- `/trpc/company` - Şirket yönetimi
- `/trpc/debtor` - Borçlu verisi (harici entegrasyon)
- `/trpc/creditor` - Alacaklı verisi (harici entegrasyon)

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

## Harici Entegrasyonlar

- **Borçlu ve alacaklı verileri**, şirket kimlik bilgileriyle harici bir web servisinden (SIS) çekilir.
- **Her harici istekten önce oturum tabanlı kimlik doğrulama** yapılır.
- **Yanıtlar** ayrıştırılır ve hatalar HTTP ve iş mantığına göre yönetilir.

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

---

## Proje Yapısı

- `src/index.ts` - Ana sunucu girişi
- `src/trpc/router/` - tRPC router'ları (user, company, debtor, creditor)
- `src/db/schema/` - Veritabanı şema tanımları
- `src/services/` - İş mantığı, Redis, web servisi entegrasyonu
- `src/types/` - TypeScript tipleri

---

## Nasıl Çalıştırılır

1. Bağımlılıkları yükleyin: `npm install`
2. Ortam değişkenlerini `.env` dosyasında ayarlayın.
3. Sunucuyu başlatın: `npm run dev` (veya uygun script)
4. API'ye şu adresten erişin: `http://localhost:<PORT>/trpc`
