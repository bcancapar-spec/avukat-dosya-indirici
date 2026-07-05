# Avukat Dosya İndirici — Kullanım ve Kurulum Kılavuzu

Bu kılavuz, "Avukat Dosya İndirici" Chrome uzantısının kurulumunu ve
kullanımını adım adım, teknik bilgi gerektirmeden anlatır. Genel bir
tanıtım için ana [README](./README.md) dosyasına bakabilirsiniz; bu
belge kurulum ve kullanım sürecinin ayrıntılı, sorun giderme dahil
tam rehberidir.

## İçindekiler

1. [Ön Koşullar](#1-ön-koşullar)
2. [Kurulum](#2-kurulum)
3. [Uzantıyı Sabitleme](#3-uzantıyı-sabitleme)
4. [Kullanım](#4-kullanım)
5. [Sık Sorulan Sorular](#5-sık-sorulan-sorular)
6. [Sorun Giderme](#6-sorun-giderme)
7. [Güncelleme](#7-güncelleme)
8. [Kaldırma](#8-kaldırma)
9. [Destek ve İletişim](#9-destek-ve-iletişim)

---

## 1. Ön Koşullar

Kuruluma başlamadan önce şunlara sahip olduğunuzdan emin olun:

- **Google Chrome** tarayıcısı (sürüm 111 veya üzeri). Chrome sürümünüzü
  öğrenmek için adres çubuğuna `chrome://settings/help` yazabilirsiniz.
- **UYAP Avukat Portalı** üzerinde aktif, vekaleti olan bir kullanıcı
  hesabı (baro sicil numaranız ve UYAP şifreniz).
- İndirilen evrakların kaydedileceği bir bilgisayar (uzantı yalnızca
  masaüstü Chrome'da çalışır; mobil Chrome desteklenmez).

## 2. Kurulum

Bu uzantı Chrome Web Mağazası'nda yayınlanmadığı için "paketlenmemiş
öğe" (unpacked extension) olarak manuel kurulum gerektirir. Bu, Google
tarafından imzalanmamış uzantılar için standart ve güvenli bir
yöntemdir; yalnızca Chrome'un kendi "Geliştirici Modu" özelliğini
kullanır.

### 2.1. Dosyaları İndirin

1. Bu deponun ana sayfasında (üstte) yeşil **"Code"** butonuna tıklayın
2. Açılan menüden **"Download ZIP"** seçeneğine tıklayın
3. İndirilen ZIP dosyasını (`avukat-dosya-indirici-main.zip` benzeri bir
   isimle) bilgisayarınızda kolay bulacağınız bir yere (örneğin
   Masaüstü) **çıkartın** — sağ tıklayıp "Tümünü Ayıkla" (Extract All)
   seçeneğini kullanabilirsiniz

### 2.2. Chrome'da Geliştirici Modunu Açın

1. Google Chrome'u açın
2. Adres çubuğuna şunu yazıp Enter'a basın:
   ```
   chrome://extensions
   ```
3. Sayfanın **sağ üst köşesinde** bulunan **"Geliştirici modu"**
   (Developer mode) anahtarını bulun ve **açık** konuma getirin

### 2.3. Uzantıyı Yükleyin

1. Sol üstte üç yeni buton belirecek; **"Paketlenmemiş öğe yükle"**
   (Load unpacked) butonuna tıklayın
2. Açılan pencerede, 2.1 adımında çıkardığınız klasörü bulun ve seçin
   (klasörün **içine girmeyin**, klasörün kendisini seçin — klasörün
   adı muhtemelen `avukat-dosya-indirici-main` gibi bir şey olacaktır)
3. "Klasör Seç" (Select Folder) butonuna tıklayın

Uzantı artık listeye eklenmiş olmalı; kart üzerinde "Avukat Dosya
İndirici" (veya "UYAP Evrak Indirici") adını ve bir sürüm numarası
görmelisiniz.

## 3. Uzantıyı Sabitleme

Uzantıya kolay erişim için araç çubuğuna sabitleyebilirsiniz:

1. Chrome'un sağ üst köşesindeki **yapboz parçası** (puzzle piece)
   ikonuna tıklayın
2. Açılan listede "Avukat Dosya İndirici" öğesini bulun
3. Yanındaki **pin (raptiye)** ikonuna tıklayın

Artık uzantı ikonu doğrudan araç çubuğunda görünecek.

## 4. Kullanım

### 4.1. UYAP'a Giriş Yapın

1. Yeni bir sekmede [avukat.uyap.gov.tr](https://avukat.uyap.gov.tr)
   adresine gidin
2. Kendi UYAP kullanıcı adı ve şifrenizle giriş yapın

### 4.2. Bir Dosyanın Evrak Sayfasına Gidin

Vekaletinizin bulunduğu bir dosyayı seçip, o dosyanın evrak/belge
listesinin göründüğü sayfaya gidin.

### 4.3. Uzantıyı Çalıştırın

1. Chrome araç çubuğundaki uzantı ikonuna tıklayın; bir açılır pencere
   (popup) belirecektir
2. Popup içinde, sayfadaki evrakların bir listesini görmeniz
   beklenir
3. İstediğiniz filtreleme seçeneklerini uygulayın (evrak türü, tarih
   aralığı gibi seçenekler mevcutsa)
4. İndirme işlemini başlatan butona tıklayın

### 4.4. İndirme Sürecini Takip Edin

- İndirme sırasında bir ilerleme göstergesi görünür
- İşlem tamamlandığında, dosyalar Chrome'un varsayılan indirme
  klasörüne (genelde `İndirilenler` / `Downloads`) kaydedilir
- Bağlantı kesilirse veya işlem yarıda kalırsa, uzantının "devam etme"
  özelliği sayesinde kaldığınız yerden tekrar başlatabilirsiniz

### 4.5. Hata Raporunu İnceleyin

İndirme tamamlandıktan sonra, varsa başarısız olan evraklar için bir
hata özeti gösterilir. Bu durumda ilgili evrakı UYAP üzerinden manuel
olarak kontrol etmeniz önerilir.

## 5. Sık Sorulan Sorular

**S: Uzantı, UYAP şifremi görüyor mu veya saklıyor mu?**
C: Hayır. Uzantı, sizin zaten giriş yapmış olduğunuz tarayıcı
oturumunuzu kullanır; hiçbir kullanıcı adı/şifre bilgisini görmez,
saklamaz veya başka bir yere göndermez.

**S: İndirilen evraklar nereye gidiyor, bir sunucuya yükleniyor mu?**
C: Hayır. Tüm evraklar doğrudan UYAP'tan sizin bilgisayarınıza iner;
hiçbir üçüncü taraf sunucuya veri gönderilmez.

**S: Uzantı Chrome Web Mağazası'ndan neden indirilemiyor?**
C: Uzantı şu an mağazada yayınlanmamıştır; yalnızca bu depo üzerinden,
manuel kurulum yöntemiyle dağıtılmaktadır.

**S: Uzantı hangi tarayıcılarda çalışır?**
C: Yalnızca masaüstü Google Chrome'da (sürüm 111+) test edilmiştir.
Chromium tabanlı diğer tarayıcılarda (Edge, Brave vb.) çalışması
muhtemeldir ancak test edilmemiştir.

## 6. Sorun Giderme

**Sorun: "Paketlenmemiş öğe yükle" butonuna tıklayınca hata alıyorum**
- Seçtiğiniz klasörde `manifest.json` dosyasının bulunduğundan emin
  olun. ZIP dosyasını çıkardığınızda bazen bir üst klasör
  oluşabilir — `manifest.json`'ın doğrudan seçtiğiniz klasörün
  içinde olması gerekir.

**Sorun: Uzantı ikonuna tıklayınca hiçbir şey olmuyor**
- `chrome://extensions` sayfasına gidip uzantının **etkin (enabled)**
  olduğundan emin olun
- Sayfayı yenileyin (F5) ve tekrar deneyin
- Chrome'u tamamen kapatıp yeniden açmayı deneyin

**Sorun: Popup açılıyor ama evrak listesi boş görünüyor**
- UYAP oturumunuzun hâlâ aktif olduğundan emin olun (oturum zaman
  aşımına uğramış olabilir, sayfayı yenileyip tekrar giriş yapın)
- Doğru sayfada (dosyanın evrak listesi sayfası) olduğunuzdan emin
  olun

**Sorun: İndirme işlemi yarıda duruyor veya hata veriyor**
- İnternet bağlantınızı kontrol edin
- UYAP portalının o an yoğun/yavaş olması mümkündür; bir süre
  bekleyip tekrar deneyin
- Uzantının "devam etme" özelliğini kullanarak kaldığınız yerden
  tekrar başlatın

**Yukarıdaki adımlar sorunu çözmezse**, bölüm 9'daki iletişim
kanalından bize ulaşın.

## 7. Güncelleme

Uzantı otomatik güncellenmez (Chrome Web Mağazası'nda olmadığı için).
Yeni bir sürüm yayınlandığında güncellemek için:

1. Bu depodan güncel ZIP dosyasını tekrar indirin (bölüm 2.1)
2. Yeni sürümü bir klasöre çıkarın
3. `chrome://extensions` sayfasında mevcut uzantıyı bulun,
   **"Kaldır"** (Remove) ile eski sürümü kaldırın
4. Yeni klasörü, bölüm 2.3'teki adımlarla tekrar "Paketlenmemiş öğe
   yükle" ile ekleyin

## 8. Kaldırma

1. `chrome://extensions` sayfasına gidin
2. "Avukat Dosya İndirici" kartında **"Kaldır"** (Remove) butonuna
   tıklayın
3. Onay isteğinde **"Kaldır"**a tekrar tıklayın

Kaldırma işlemi, daha önce indirilmiş evrakları etkilemez; yalnızca
uzantının kendisini Chrome'dan siler.

## 9. Destek ve İletişim

Bu kılavuzda çözüm bulamadığınız bir sorunla karşılaşırsanız, bu
depoda bir **Issue** açarak bildirebilirsiniz:

1. Bu deponun üst menüsünde **"Issues"** sekmesine gidin
2. **"New issue"** butonuna tıklayın
3. Şu bilgileri eklemeniz sorunun daha hızlı çözülmesine yardımcı olur:
   - Ne yapmaya çalışıyordunuz
   - Ne beklediniz
   - Ne oldu (hata mesajı veya ekran görüntüsü varsa ekleyin)
   - Chrome sürümünüz (`chrome://settings/help`)

---

*Bu kılavuz, Avukat Dosya İndirici uzantısının [LICENSE](./LICENSE)
dosyasında belirtilen kullanım koşullarına tabidir.*
