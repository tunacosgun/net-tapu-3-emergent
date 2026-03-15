-- Seed: Hukuki Metinler + Bilgilendirme İçerikleri
-- Bu script eksik CMS içeriklerini ekler.
-- Çalıştır: docker exec -i $(docker ps -qf name=postgres) psql -U postgres -d nettapu < scripts/seed-content.sql

-- 1. Kullanım Koşulları
INSERT INTO admin.pages (id, title, slug, page_type, status, content, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Kullanım Koşulları',
  'kullanim-kosullari',
  'legal_info',
  'published',
  '[{"type":"heading","data":{"text":"Kullanım Koşulları","level":2}},{"type":"text","data":{"content":"Bu kullanım koşulları, NetTapu platformunu (''Platform'') kullanan tüm kullanıcılar (''Kullanıcı'') için geçerlidir. Platformu kullanarak bu koşulları kabul etmiş sayılırsınız."}},{"type":"heading","data":{"text":"1. Hizmet Kapsamı","level":3}},{"type":"text","data":{"content":"NetTapu, gayrimenkul ilan yayınlama, canlı ihale düzenleme ve arsa alım-satım süreçlerinde aracılık hizmeti sunar. Platform üzerinden yapılan tüm işlemler Türkiye Cumhuriyeti mevzuatına tabidir."}},{"type":"heading","data":{"text":"2. Üyelik ve Hesap Güvenliği","level":3}},{"type":"text","data":{"content":"Kullanıcılar doğru ve güncel bilgilerle üyelik oluşturmalıdır. Hesap güvenliğinden kullanıcı sorumludur. Şüpheli aktivite durumunda platform hesabı askıya alabilir."}},{"type":"heading","data":{"text":"3. İhale Kuralları","level":3}},{"type":"text","data":{"content":"Canlı ihaleye katılım için teminat bedeli (kaparo) yatırılması zorunludur. İhale süreci boyunca verilen teklifler bağlayıcıdır. İhaleyi kazanan kullanıcı belirtilen sürede ödeme yükümlülüğünü yerine getirmelidir."}},{"type":"heading","data":{"text":"4. Ödeme ve İade","level":3}},{"type":"text","data":{"content":"Tüm ödemeler güvenli sanal POS altyapısı üzerinden gerçekleştirilir. İhale kaybeden kullanıcıların kaporası otomatik olarak iade edilir. Cayma hakkı ve iade koşulları için ilgili yasal metne bakınız."}},{"type":"heading","data":{"text":"5. Sorumluluk Reddi","level":3}},{"type":"text","data":{"content":"Platform, ilan sahiplerinin verdiği bilgilerin doğruluğunu garanti etmez. Kullanıcılar tapu ve imar sorgulamasını bizzat yapmalıdır. NetTapu, üçüncü taraf hizmetlerinden kaynaklanan aksaklıklardan sorumlu tutulamaz."}}]',
  NOW(), NOW()
) ON CONFLICT (slug) DO NOTHING;

-- 2. Gizlilik Politikası
INSERT INTO admin.pages (id, title, slug, page_type, status, content, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Gizlilik Politikası',
  'gizlilik-politikasi',
  'legal_info',
  'published',
  '[{"type":"heading","data":{"text":"Gizlilik Politikası","level":2}},{"type":"text","data":{"content":"NetTapu olarak kişisel verilerinizin korunmasına büyük önem veriyoruz. Bu politika, hangi verilerinizi topladığımızı, nasıl kullandığımızı ve koruduğumuzu açıklar."}},{"type":"heading","data":{"text":"1. Toplanan Veriler","level":3}},{"type":"text","data":{"content":"Üyelik bilgileri (ad, soyad, e-posta, telefon), işlem geçmişi, ihale katılım bilgileri, çerez verileri ve cihaz bilgileri toplanmaktadır."}},{"type":"heading","data":{"text":"2. Veri Kullanım Amaçları","level":3}},{"type":"text","data":{"content":"Hizmet sunumu, güvenlik, yasal yükümlülükler, iletişim ve pazarlama (onay ile) amaçlarıyla kullanılır."}},{"type":"heading","data":{"text":"3. Veri Güvenliği","level":3}},{"type":"text","data":{"content":"SSL şifreleme, güvenli sunucular ve erişim kontrolleri ile verileriniz korunur. Üçüncü taraflarla yalnızca yasal zorunluluk veya hizmet gereği paylaşılır."}},{"type":"heading","data":{"text":"4. Haklarınız","level":3}},{"type":"text","data":{"content":"KVKK kapsamında verilerinize erişim, düzeltme, silme ve itiraz haklarınız bulunmaktadır. Taleplerinizi kvkk@nettapu.com adresine iletebilirsiniz."}}]',
  NOW(), NOW()
) ON CONFLICT (slug) DO NOTHING;

-- 3. KVKK Aydınlatma Metni
INSERT INTO admin.pages (id, title, slug, page_type, status, content, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'KVKK Aydınlatma Metni',
  'kvkk-aydinlatma',
  'legal_info',
  'published',
  '[{"type":"heading","data":{"text":"Kişisel Verilerin Korunması Kanunu (KVKK) Aydınlatma Metni","level":2}},{"type":"text","data":{"content":"6698 sayılı Kişisel Verilerin Korunması Kanunu (''KVKK'') kapsamında, veri sorumlusu sıfatıyla NetTapu tarafından kişisel verileriniz aşağıda açıklanan çerçevede işlenmektedir."}},{"type":"heading","data":{"text":"Veri Sorumlusu","level":3}},{"type":"text","data":{"content":"TR Eser Group / NetTapu platformu veri sorumlusudur."}},{"type":"heading","data":{"text":"İşlenen Kişisel Veriler","level":3}},{"type":"text","data":{"content":"Kimlik bilgileri, iletişim bilgileri, finansal bilgiler, işlem güvenliği bilgileri, pazarlama verileri işlenmektedir."}},{"type":"heading","data":{"text":"İşleme Amaçları","level":3}},{"type":"text","data":{"content":"Sözleşme ifası, yasal yükümlülük, meşru menfaat ve açık rıza hukuki sebeplerine dayanılarak; hizmet sunumu, ödeme işlemleri, ihale yönetimi, güvenlik ve iletişim amaçlarıyla işlenir."}},{"type":"heading","data":{"text":"Haklarınız","level":3}},{"type":"text","data":{"content":"KVKK m.11 kapsamında; verilerinizin işlenip işlenmediğini öğrenme, düzeltme talep etme, silme/yok etme talep etme, üçüncü kişilere aktarıldığını öğrenme ve itiraz haklarınız mevcuttur."}}]',
  NOW(), NOW()
) ON CONFLICT (slug) DO NOTHING;

-- 4. Çerez Politikası
INSERT INTO admin.pages (id, title, slug, page_type, status, content, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Çerez Politikası',
  'cerez-politikasi',
  'legal_info',
  'published',
  '[{"type":"heading","data":{"text":"Çerez (Cookie) Politikası","level":2}},{"type":"text","data":{"content":"NetTapu web sitesi ve uygulamaları, hizmet kalitesini artırmak amacıyla çerezler kullanmaktadır."}},{"type":"heading","data":{"text":"Zorunlu Çerezler","level":3}},{"type":"text","data":{"content":"Oturum yönetimi, güvenlik ve temel site işlevleri için gereklidir. Devre dışı bırakılamaz."}},{"type":"heading","data":{"text":"Analiz Çerezleri","level":3}},{"type":"text","data":{"content":"Ziyaretçi istatistikleri ve site performansı analizi için kullanılır."}},{"type":"heading","data":{"text":"Pazarlama Çerezleri","level":3}},{"type":"text","data":{"content":"Kişiselleştirilmiş reklam ve içerik sunumu amacıyla kullanılır. Onayınızla etkinleştirilir."}},{"type":"heading","data":{"text":"Çerez Tercihleri","level":3}},{"type":"text","data":{"content":"Tarayıcı ayarlarınızdan çerezleri yönetebilir veya silebilirsiniz. Zorunlu çerezler dışındaki çerezleri reddetme hakkınız saklıdır."}}]',
  NOW(), NOW()
) ON CONFLICT (slug) DO NOTHING;

-- 5. Mesafeli Satış Sözleşmesi
INSERT INTO admin.pages (id, title, slug, page_type, status, content, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Mesafeli Satış Sözleşmesi',
  'mesafeli-satis-sozlesmesi',
  'legal_info',
  'published',
  '[{"type":"heading","data":{"text":"Mesafeli Satış Sözleşmesi","level":2}},{"type":"text","data":{"content":"İşbu sözleşme, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği kapsamında düzenlenmiştir."}},{"type":"heading","data":{"text":"1. Taraflar","level":3}},{"type":"text","data":{"content":"Satıcı: TR Eser Group / NetTapu. Alıcı: Platform üzerinden işlem yapan kullanıcı."}},{"type":"heading","data":{"text":"2. Sözleşme Konusu","level":3}},{"type":"text","data":{"content":"İşbu sözleşme, platform üzerinden gerçekleştirilen gayrimenkul alım-satım ve ihale işlemlerinin koşullarını düzenler."}},{"type":"heading","data":{"text":"3. Cayma Hakkı","level":3}},{"type":"text","data":{"content":"Gayrimenkul satışları, Mesafeli Sözleşmeler Yönetmeliği kapsamında cayma hakkı istisnası dahilindedir. Ancak platform, iyi niyet çerçevesinde cayma süreçlerini kolaylaştırır. Detaylar için Cayma Hakkı sayfasına bakınız."}},{"type":"heading","data":{"text":"4. Ödeme ve Teslimat","level":3}},{"type":"text","data":{"content":"Ödemeler güvenli sanal POS ile alınır. Tapu devir işlemleri yasal süreçlere uygun olarak gerçekleştirilir."}}]',
  NOW(), NOW()
) ON CONFLICT (slug) DO NOTHING;

-- 6. Watermark admin ayarı mevcut olduğunu göster (system_settings'e rehber notu)
INSERT INTO admin.system_settings (key, value, updated_at)
VALUES ('watermark_help_text', '"Admin Paneli > Sistem > Ayarlar bölümünden ''watermark_logo'' anahtarıyla logo URL''si girerek filigranı değiştirebilirsiniz."', NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
